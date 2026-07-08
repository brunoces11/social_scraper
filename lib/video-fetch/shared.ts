import { ChannelVideoRow } from "@/types";
import { getBlacklist, saveSearchToXls } from "@/lib/xls";
import type { PlatformId } from "@/lib/platforms";

export type VideoFetchRequestParams = {
  videoUrls?: string[];
  xlsLabel?: string;
  accountId?: string;
};

export type VideoFetchResult = {
  rows: ChannelVideoRow[];
  savedFile: string;
};

export class VideoFetchRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "VideoFetchRequestError";
    this.status = status;
  }
}

export function assertVideoUrls(videoUrls: unknown): asserts videoUrls is string[] {
  if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
    throw new VideoFetchRequestError("No URLs provided.", 400);
  }
}

export function finalizeVideoFetchRows(
  allRows: ChannelVideoRow[],
  xlsLabel?: string,
  platform: PlatformId = "tiktok"
): VideoFetchResult {
  const blacklist = getBlacklist(platform);
  const rows = allRows.filter((r) => !blacklist.has(r.videoUrl));
  rows.sort((a, b) => b.views - a.views);

  let savedFile = "";
  try {
    const label = xlsLabel || "batch_upload";
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
