import {
  doc, onSnapshot, runTransaction, serverTimestamp, setDoc,
  type Firestore, type DocumentSnapshot, type DocumentData,
} from "firebase/firestore";
import { buildNewUser, identityPatch, rewardProgress, type AccountIdentity } from "./progress";

// All clients use the Firebase UID; names and email addresses are never keys.
export async function ensureAccount(db: Firestore, identity: AccountIdentity) {
  const ref = doc(db, "users", identity.uid);
  await runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) {
      tx.set(ref, { ...buildNewUser(identity), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    } else {
      const patch = identityPatch(identity, snapshot.data());
      if (Object.keys(patch).length) tx.update(ref, { ...patch, updatedAt: serverTimestamp() });
    }
  });
}

export function watchAccount(db: Firestore, uid: string, next: (snapshot: DocumentSnapshot<DocumentData>) => void, error: (error: Error) => void) {
  return onSnapshot(doc(db, "users", uid), { includeMetadataChanges: true }, next, error);
}

export const DEFAULT_PREFERENCES = { notifications: true, publicProfile: true, emailNews: true };
export type Preferences = typeof DEFAULT_PREFERENCES;
export function readPreferences(data: Record<string, unknown> = {}): Preferences {
  return Object.fromEntries(Object.entries(DEFAULT_PREFERENCES).map(([key, fallback]) =>
    [key, typeof data[key] === "boolean" ? data[key] : fallback])) as Preferences;
}

export function watchPreferences(db: Firestore, uid: string, next: (preferences: Preferences) => void, error: (error: Error) => void) {
  return onSnapshot(doc(db, "webProfiles", uid), snap => next(readPreferences(snap.data()?.prefs)), error);
}

export function savePreference(db: Firestore, uid: string, key: keyof Preferences, value: boolean) {
  // Merge only the selected field so another device's preferences survive.
  return setDoc(doc(db, "webProfiles", uid), { prefs: { [key]: value } }, { merge: true });
}

export async function saveReportAndProgress(db: Firestore, uid: string, reportId: string, report: Record<string, unknown>) {
  if (report.userId !== uid) throw new Error("El reporte debe pertenecer a la cuenta actual.");
  const reportRef = doc(db, "reports", reportId);
  const profileRef = doc(db, "users", uid);
  await runTransaction(db, async tx => {
    const [profile, previous] = await Promise.all([tx.get(profileRef), tx.get(reportRef)]);
    if (!profile.exists()) throw new Error("Perfil pendiente de creación");
    if (previous.exists()) {
      if (previous.data().userId !== uid) throw new Error("El reporte pertenece a otra cuenta.");
      return; // Safe retry: an acknowledged or ambiguous commit cannot award twice.
    }
    tx.set(reportRef, { ...report, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    tx.update(profileRef, { ...rewardProgress(profile.data()), updatedAt: serverTimestamp() });
  });
}
