export type PlatformId = "tiktok" | "instagram" | "youtube";

const PLATFORM_IDS = new Set<PlatformId>(["tiktok", "instagram", "youtube"]);

export function isPlatformId(value: unknown): value is PlatformId {
  return typeof value === "string" && PLATFORM_IDS.has(value as PlatformId);
}

export function normalizePlatform(value: unknown, fallback: PlatformId = "tiktok"): PlatformId {
  return isPlatformId(value) ? value : fallback;
}
