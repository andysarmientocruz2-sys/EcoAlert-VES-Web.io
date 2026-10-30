import {
  GoogleAuthProvider,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  setPersistence,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
  type UserCredential,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";

type TokenResult = { idToken?: string };

declare global {
  interface Window {
    ecoalert?: {
      platform: "windows" | "android";
      signInWithGoogle: () => Promise<TokenResult>;
    };
    Capacitor?: {
      getPlatform?: () => string;
      isNativePlatform?: () => boolean;
    };
  }
}

export async function prepareAuth(auth: Auth) {
  await setPersistence(auth, Capacitor.isNativePlatform() ? indexedDBLocalPersistence : browserLocalPersistence);
}

export function isNativeShell() {
  return Boolean(window.ecoalert?.signInWithGoogle || Capacitor.isNativePlatform());
}

export function nativePlatform(): "web" | "windows" | "android" {
  if (window.ecoalert?.platform === "windows") return "windows";
  return Capacitor.getPlatform() === "android" ? "android" : "web";
}

async function platformIdToken(): Promise<string | null> {
  if (window.ecoalert?.signInWithGoogle) {
    const result = await window.ecoalert.signInWithGoogle();
    if (!result?.idToken) {
      const error = new Error("Google no devolvió la sesión a la aplicación.") as Error & {
        code?: string;
      };
      error.code = "auth/invalid-credential";
      throw error;
    }
    return result.idToken;
  }
  return null;
}

export async function signInWithBestMethod(
  auth: Auth,
  provider: GoogleAuthProvider
): Promise<UserCredential | null> {
  if (window.ecoalert?.signInWithGoogle) {
    const idToken = await platformIdToken();
    return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  }
  if (Capacitor.isNativePlatform()) {
    // Android selects the Google account natively; Firestore uses the same JS
    // Firebase session/UID as the website and desktop application.
    const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
    const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    const idToken = result.credential?.idToken;
    if (!idToken) throw Object.assign(new Error("Google no devolvió una sesión válida."), { code: "auth/invalid-credential" });
    return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  }
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "auth/popup-blocked") {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw error;
  }
}
