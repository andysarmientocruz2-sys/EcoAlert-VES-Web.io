// Reexporta el contrato compartido (copia alineada con shared/progress.mjs)
export const REPORT_POINTS = 50;
export const MAX_POINT_DELTA = 200;

export const NATIVE_LEVELS = [
  { id: 1, name: "Semilla", minPoints: 0, nextPoints: 100 },
  { id: 2, name: "Brote", minPoints: 100, nextPoints: 250 },
  { id: 3, name: "Árbol", minPoints: 250, nextPoints: 500 },
  { id: 4, name: "Bosque", minPoints: 500, nextPoints: 1000 },
  { id: 5, name: "Guardián Verde", minPoints: 1000, nextPoints: 2000 },
  { id: 6, name: "EcoLeyenda", minPoints: 2000, nextPoints: 999999 },
] as const;

const CATEGORIES: Record<string, { categoryId: string; category: string; cloudType: string; webType: string }> = {
  basura: { categoryId: "solidos", category: "Residuos Sólidos", cloudType: "basura", webType: "basura" },
  solidos: { categoryId: "solidos", category: "Residuos Sólidos", cloudType: "basura", webType: "basura" },
  quema: { categoryId: "quema", category: "Quema de Residuos", cloudType: "quema", webType: "quema" },
  aguas: { categoryId: "agua", category: "Contaminación del Agua", cloudType: "agua", webType: "aguas" },
  agua: { categoryId: "agua", category: "Contaminación del Agua", cloudType: "agua", webType: "aguas" },
  escombros: { categoryId: "escombros", category: "Escombros", cloudType: "otro", webType: "escombros" },
  aire: { categoryId: "aire", category: "Contaminación del Aire", cloudType: "aire", webType: "aire" },
  otros: { categoryId: "otro", category: "Otro", cloudType: "otro", webType: "otros" },
  otro: { categoryId: "otro", category: "Otro", cloudType: "otro", webType: "otros" },
};

export interface AccountIdentity {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

export function storedLevel(points: number): number {
  const safe = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  return 1 + Math.floor(safe / 100);
}

export function displayLevel(points: number): { level: string; levelNum: number; nextPoints: number } {
  const safe = Number.isFinite(points) ? Math.max(0, points) : 0;
  const found = [...NATIVE_LEVELS].reverse().find((l) => safe >= l.minPoints) || NATIVE_LEVELS[0];
  return { level: found.name, levelNum: found.id, nextPoints: found.nextPoints };
}

export function buildNewUser(identity: AccountIdentity) {
  return {
    uid: identity.uid,
    email: identity.email || "",
    displayName: identity.displayName || "Usuario",
    photoURL: identity.photoURL || "",
    ecoPoints: 0,
    level: 1,
    achievements: [] as string[],
    reportsCount: 0,
  };
}

export function identityPatch(identity: AccountIdentity, existing: Record<string, unknown> = {}) {
  const patch: Partial<{ email: string; displayName: string; photoURL: string }> = {};
  if (identity.displayName && !existing.displayName) patch.displayName = identity.displayName;
  if (identity.email && identity.email !== existing.email) patch.email = identity.email;
  if (identity.photoURL && !existing.photoURL) patch.photoURL = identity.photoURL;
  return patch;
}

export function mergeAchievements(existing: unknown, stats: { reports: number; points: number }): string[] {
  const have = Array.isArray(existing) ? existing.filter((x): x is string => typeof x === "string") : [];
  const next = [...have];
  const unlock = (id: string, when: boolean) => {
    if (when && !next.includes(id)) next.push(id);
  };
  unlock("first_report", stats.reports >= 1);
  unlock("ten_reports", stats.reports >= 10);
  unlock("fifty_reports", stats.reports >= 50);
  unlock("hundred_reports", stats.reports >= 100);
  unlock("green_citizen", stats.points >= 500);
  return next;
}

export function rewardProgress(data: { ecoPoints?: number; reportsCount?: number; achievements?: unknown } | null | undefined) {
  const points = (Number(data?.ecoPoints) || 0) + REPORT_POINTS;
  const reports = (Number(data?.reportsCount) || 0) + 1;
  return {
    ecoPoints: points,
    reportsCount: reports,
    level: storedLevel(points),
    achievements: mergeAchievements(data?.achievements, { reports, points }),
  };
}

export function buildReportDocs(
  input: {
    webType: string;
    description: string;
    imageUrl?: string | null;
    location?: string;
    lat?: number | null;
    lng?: number | null;
    userId: string;
    userName?: string;
    userPhoto?: string | null;
    source: "web" | "android" | "windows";
    district?: string;
    reference?: string;
  },
  nowIso: string
) {
  const description = input.description.trim();
  const known = CATEGORIES[input.webType] || CATEGORIES.otros;
  const latitude = typeof input.lat === "number" ? input.lat : null;
  const longitude = typeof input.lng === "number" ? input.lng : null;
  const report = {
    userId: input.userId,
    title: description.slice(0, 100),
    description,
    type: known.cloudType,
    categoryId: known.categoryId,
    category: known.category,
    severity: known.categoryId === "quema" || known.categoryId === "agua" ? "alta" : "media",
    location: input.location || "",
    address: input.location || "",
    district: input.district || "Villa El Salvador",
    reference: input.reference || "",
    latitude,
    longitude,
    lat: latitude,
    lng: longitude,
    imageUrl: input.imageUrl || null,
    photoCount: input.imageUrl ? 1 : 0,
    userName: input.userName || "Ciudadano",
    userPhoto: input.userPhoto || null,
    status: "pendiente",
    votes: 0,
    date: nowIso,
    source: input.source,
  };
  const webReport = {
    type: input.webType,
    description,
    imageUrl: input.imageUrl || null,
    location: input.location || "",
    lat: latitude,
    lng: longitude,
    userId: input.userId,
    userName: input.userName || "Ciudadano",
    userPhoto: input.userPhoto || null,
    upvotes: 0,
    status: "pendiente",
  };
  return { report, webReport };
}

export function mapCloudReport(id: string, data: Record<string, unknown>) {
  const categoryId = typeof data.categoryId === "string" ? data.categoryId : "";
  const rawType = typeof data.type === "string" ? data.type : "";
  const known = CATEGORIES[categoryId] || CATEGORIES[rawType] || CATEGORIES.otros;
  const statusRaw = String(data.status || "pendiente").toLowerCase();
  const status =
    statusRaw === "resuelto" || statusRaw === "resolved"
      ? "resuelto"
      : statusRaw === "analyzed" || statusRaw === "proceso" || statusRaw === "revisado" || statusRaw === "in_review"
        ? "proceso"
        : "pendiente";
  const latitude =
    typeof data.latitude === "number"
      ? data.latitude
      : typeof data.lat === "number"
        ? data.lat
        : null;
  const longitude =
    typeof data.longitude === "number"
      ? data.longitude
      : typeof data.lng === "number"
        ? data.lng
        : null;
  const location =
    (typeof data.location === "string" && data.location) ||
    [data.address, data.district].filter((x) => typeof x === "string" && x).join(", ");
  return {
    id,
    type: known.webType,
    description: typeof data.description === "string" ? data.description : "",
    status,
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : null,
    location,
    lat: latitude,
    lng: longitude,
    upvotes: Number(data.votes ?? data.upvotes ?? 0) || 0,
    userName: typeof data.userName === "string" ? data.userName : "Ciudadano",
    userPhoto: typeof data.userPhoto === "string" ? data.userPhoto : null,
    userId: typeof data.userId === "string" ? data.userId : "",
  };
}
