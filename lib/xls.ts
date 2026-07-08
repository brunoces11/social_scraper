import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { normalizePlatform, type PlatformId } from "@/lib/platforms";

const XLS_ROOT_DIR = path.join(process.cwd(), "XLS");
const PLATFORM_XLS_FOLDERS: Record<PlatformId, string> = {
  instagram: "INSTAGRAM",
  tiktok: "TIKTOK",
  youtube: "YOUTUBE",
};

function getXlsDir(platform?: unknown): string {
  const platformId = normalizePlatform(platform, "tiktok");
  return path.join(XLS_ROOT_DIR, PLATFORM_XLS_FOLDERS[platformId]);
}

function resolveXlsPath(filename: string, platform?: unknown): string {
  const safeFilename = path.basename(filename);
  const platformPath = path.join(getXlsDir(platform), safeFilename);
  if (fs.existsSync(platformPath)) return platformPath;

  const legacyPath = path.join(XLS_ROOT_DIR, safeFilename);
  const platformId = normalizePlatform(platform, "tiktok");
  if (fs.existsSync(legacyPath) && inferLegacySearchPlatform(legacyPath) === platformId) {
    return legacyPath;
  }

  return platformPath;
}

function sanitizeName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 80);
}

export function buildSearchLabel(params: {
  channelUrl?: string;
  keyword?: string;
  hashtag?: string;
  itemCount?: number;
  monthsBack?: number | null;
}): string {
  const parts: string[] = [];
  if (params.channelUrl) {
    const match = params.channelUrl.match(/@([\w.]+)/);
    parts.push(match ? match[1] : params.channelUrl);
  }
  if (params.keyword) parts.push(params.keyword);
  if (params.hashtag) parts.push(params.hashtag);
  if (Number.isFinite(params.itemCount)) parts.push(`${params.itemCount}_items`);
  if (Number.isFinite(params.monthsBack)) parts.push(`${params.monthsBack}_months`);
  return parts.join("_") || "busca";
}

export interface SearchRow {
  video_title: string;
  views: number;
  description: string;
  likes: number;
  hashtags: string;
  video_url: string;
  comments: string | number;
  publish_date: string;
}

export function saveSearchToXls(label: string, rows: SearchRow[], platform?: unknown): string {
  const xlsDir = getXlsDir(platform);
  if (!fs.existsSync(xlsDir)) {
    fs.mkdirSync(xlsDir, { recursive: true });
  }

  const safeName = sanitizeName(label);
  const filename = `SCRAPE_${safeName}.xlsx`;
  const filepath = path.join(xlsDir, filename);

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Resultados");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(filepath, buf);

  return filename;
}

export function listSavedSearches(): { filename: string; label: string }[] {
  return listSavedSearchesForPlatform("tiktok");
}

function inferLegacySearchPlatform(filepath: string): PlatformId {
  const filename = path.basename(filepath).toLowerCase();
  if (filename.includes("youtube")) return "youtube";
  if (filename.includes("instagram") || filename.includes("insta")) return "instagram";
  if (filename.includes("tiktok")) return "tiktok";

  try {
    const buf = fs.readFileSync(filepath);
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Partial<SearchRow>>(ws, { raw: false }).slice(0, 50);
    const urls = rows.map((row) => String(row.video_url || "").toLowerCase()).join(" ");
    if (urls.includes("youtube.com") || urls.includes("youtu.be")) return "youtube";
    if (urls.includes("instagram.com")) return "instagram";
    if (urls.includes("tiktok.com")) return "tiktok";
  } catch {
    // Legacy files without readable URLs came from the original TikTok-only flow.
  }

  return "tiktok";
}

export function listSavedSearchesForPlatform(platform?: unknown): { filename: string; label: string }[] {
  const platformId = normalizePlatform(platform, "tiktok");
  const xlsDir = getXlsDir(platform);
  const platformFiles = fs.existsSync(xlsDir) ? fs.readdirSync(xlsDir)
    .filter((f) => f.startsWith("SCRAPE_") && f.endsWith(".xlsx")) : [];
  const legacyFiles = fs.existsSync(XLS_ROOT_DIR) ? fs.readdirSync(XLS_ROOT_DIR)
    .filter((f) => f.startsWith("SCRAPE_") && f.endsWith(".xlsx"))
    .filter((f) => !platformFiles.includes(f))
    .filter((f) => inferLegacySearchPlatform(path.join(XLS_ROOT_DIR, f)) === platformId) : [];

  const files = [
    ...platformFiles.map((filename) => ({ filename, filepath: path.join(xlsDir, filename) })),
    ...legacyFiles.map((filename) => ({ filename, filepath: path.join(XLS_ROOT_DIR, filename) })),
  ]
    .sort((a, b) => {
      const statA = fs.statSync(a.filepath);
      const statB = fs.statSync(b.filepath);
      return statB.mtimeMs - statA.mtimeMs; // newest first
    });

  return files.map(({ filename }) => ({
    filename,
    label: filename.replace("SCRAPE_", "").replace(".xlsx", "").replace(/_/g, " "),
  }));
}

export function loadSearchFromXls(filename: string, platform?: unknown): SearchRow[] {
  const filepath = resolveXlsPath(filename, platform);
  if (!fs.existsSync(filepath)) return [];
  const buf = fs.readFileSync(filepath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<SearchRow>(ws);
}

export function deleteRowsFromXls(filename: string, videoUrls: string[], platform?: unknown): number {
  const filepath = resolveXlsPath(filename, platform);
  if (!fs.existsSync(filepath)) return 0;

  const buf = fs.readFileSync(filepath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<SearchRow>(ws);

  const urlSet = new Set(videoUrls);
  const filtered = rows.filter((r) => !urlSet.has(r.video_url));
  const deleted = rows.length - filtered.length;

  if (deleted > 0) {
    const newWs = XLSX.utils.json_to_sheet(filtered);
    const newWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWb, newWs, "Resultados");
    const newBuf = XLSX.write(newWb, { type: "buffer", bookType: "xlsx" });
    fs.writeFileSync(filepath, newBuf);
  }

  return deleted;
}

function getBlacklistPath(platform?: unknown): string {
  return path.join(getXlsDir(platform), "blacklist.json");
}

export function getBlacklist(platform?: unknown): Set<string> {
  const blacklistPath = getBlacklistPath(platform);
  if (!fs.existsSync(blacklistPath)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(blacklistPath, "utf-8"));
    return new Set(Array.isArray(data) ? data : []);
  } catch {
    return new Set();
  }
}

export function addToBlacklist(videoUrls: string[], platform?: unknown): void {
  const xlsDir = getXlsDir(platform);
  if (!fs.existsSync(xlsDir)) {
    fs.mkdirSync(xlsDir, { recursive: true });
  }
  const current = getBlacklist(platform);
  for (const url of videoUrls) {
    current.add(url);
  }
  fs.writeFileSync(getBlacklistPath(platform), JSON.stringify([...current], null, 2), "utf-8");
}
