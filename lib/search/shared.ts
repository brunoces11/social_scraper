import { ChannelVideoRow } from "@/types";
import { buildSearchLabel, getBlacklist, saveSearchToXls } from "@/lib/xls";
import type { PlatformId } from "@/lib/platforms";

export type SearchRequestParams = {
  channelUrl?: string;
  profileUrl?: string;
  keyword?: string;
  hashtag?: string;
  maxVideos?: number;
  monthsBack?: number;
  countryCode?: string;
  accountId?: string;
};

export type SearchResult = {
  rows: ChannelVideoRow[];
  savedFile: string;
};

export class SearchRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SearchRequestError";
    this.status = status;
  }
}

export function hasSearchInput(params: SearchRequestParams): boolean {
  return Boolean(params.channelUrl || params.profileUrl || params.keyword || params.hashtag);
}

export function toMaxVideos(value: unknown): number {
  return Number(value) || 50;
}

export function toProxyCountryCode(value: unknown): string {
  return typeof value === "string" && value ? value : "None";
}

export function finalizeSearchRows(
  allRows: ChannelVideoRow[],
  labelParams: { channelUrl?: string; keyword?: string; hashtag?: string; monthsBack?: number | null },
  platform: PlatformId = "tiktok"
): SearchResult {
  const blacklist = getBlacklist(platform);
  const rows = allRows.filter((r) => !blacklist.has(r.videoUrl));

  rows.sort((a, b) => b.views - a.views);

  let savedFile = "";
  try {
    const label = buildSearchLabel({
      ...labelParams,
      itemCount: platform === "youtube" ? rows.length : undefined,
    });
    const xlsRows = rows.map((r) => ({
      video_title: r.title,
      views: r.views,
      description: r.description,
      likes: r.likes,
      hashtags: r.hashtags.join(", "),
      video_url: r.videoUrl,
      comments: r.comments ?? "",
      publish_date: r.publishDate ?? "",
    }));
    savedFile = saveSearchToXls(label, xlsRows, platform);
  } catch (xlsErr) {
    console.error("Error saving XLS:", xlsErr);
  }

  return { rows, savedFile };
}
