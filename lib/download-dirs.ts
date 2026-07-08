import fs from "fs";
import path from "path";
import { normalizePlatform, type PlatformId } from "@/lib/platforms";

const DOWNLOAD_ROOT = path.join(process.cwd(), "downloads");

const PLATFORM_DOWNLOAD_FOLDERS: Record<PlatformId, string> = {
  instagram: "INSTAGRAM",
  tiktok: "TIKTOK",
  youtube: "YOUTUBE",
};

export function inferPlatformFromUrl(url: string): PlatformId | null {
  const lower = url.toLowerCase();

  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes("instagram.com")) return "instagram";
  if (lower.includes("tiktok.com")) return "tiktok";

  return null;
}

export function resolvePlatform(value: unknown, fallback: PlatformId = "tiktok"): PlatformId {
  return normalizePlatform(value, fallback);
}

export function resolvePlatformFromPayload(
  platform: unknown,
  urls: unknown,
  fallback: PlatformId = "tiktok"
): PlatformId {
  if (platform) return resolvePlatform(platform, fallback);

  if (Array.isArray(urls)) {
    const inferred = urls.map((url) => (typeof url === "string" ? inferPlatformFromUrl(url) : null)).find(Boolean);
    if (inferred) return inferred;
  }

  return fallback;
}

export function getDownloadDir(platform: PlatformId): string {
  return path.join(DOWNLOAD_ROOT, PLATFORM_DOWNLOAD_FOLDERS[platform]);
}

export function ensureDownloadDir(platform: PlatformId): string {
  const downloadDir = getDownloadDir(platform);
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }
  return downloadDir;
}

