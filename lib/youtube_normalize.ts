import { ChannelVideoRow } from "@/types";
import { safeNumber, safeString } from "@/lib/normalize-shared";

type UnknownRecord = Record<string, unknown>;

function getNestedField(obj: UnknownRecord, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in (current as UnknownRecord)) {
      return (current as UnknownRecord)[key];
    }
    return undefined;
  }, obj);
}

function firstValue(item: UnknownRecord, fields: string[]): unknown {
  for (const field of fields) {
    const value = getNestedField(item, field);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function extractVideoId(item: UnknownRecord): string {
  const direct = safeString(firstValue(item, [
    "id",
    "videoId",
    "video_id",
    "video.id",
    "snippet.resourceId.videoId",
  ]));
  if (direct) return direct;

  const url = buildVideoUrl(item);
  const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/) || url.match(/\/shorts\/([^?]+)/);
  return match ? match[1] : "";
}

function buildVideoUrl(item: UnknownRecord): string {
  const url = safeString(firstValue(item, [
    "url",
    "videoUrl",
    "videoURL",
    "link",
    "webpageUrl",
    "video.url",
  ]));
  if (url) return url;

  const id = safeString(firstValue(item, ["id", "videoId", "video_id"]));
  return id ? `https://www.youtube.com/watch?v=${id}` : "";
}

function extractHashtags(item: UnknownRecord): string[] {
  const raw = firstValue(item, ["hashtags", "tags", "snippet.tags"]);
  if (Array.isArray(raw)) {
    return raw.map((value) => safeString(value).replace(/^#/, "")).filter(Boolean);
  }

  const description = safeString(firstValue(item, ["description", "text", "snippet.description"]));
  const matches = description.match(/#[\p{L}\p{N}_-]+/gu) || [];
  return matches.map((tag) => tag.replace(/^#/, ""));
}

function ensureHashtagArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => safeString(item).replace(/^#/, "")).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim().replace(/^#/, ""))
      .filter(Boolean);
  }

  return [];
}

function getTranscriptText(item: UnknownRecord): string {
  const raw = firstValue(item, [
    "subtitles",
    "subtitle",
    "transcript",
    "transcription",
    "captions",
    "captions.text",
  ]);

  if (typeof raw === "string") return raw.trim();

  if (Array.isArray(raw)) {
    return raw
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const record = part as UnknownRecord;
          return safeString(record.text || record.content || record.subtitle);
        }
        return "";
      })
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  if (raw && typeof raw === "object") {
    const record = raw as UnknownRecord;
    return safeString(record.text || record.content || record.srt || record.vtt).trim();
  }

  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeYouTubeVideos(rawItems: any[]): ChannelVideoRow[] {
  return rawItems.map((item: UnknownRecord) => {
    const title = safeString(firstValue(item, ["title", "name", "snippet.title"]));
    const description = safeString(firstValue(item, ["description", "text", "snippet.description"])) || title;

    return {
      videoId: extractVideoId(item),
      title: (title || description).substring(0, 80),
      description,
      views: safeNumber(firstValue(item, ["viewCount", "views", "statistics.viewCount"])),
      likes: safeNumber(firstValue(item, ["likes", "likeCount", "statistics.likeCount"])),
      hashtags: extractHashtags(item),
      videoUrl: buildVideoUrl(item),
      comments: safeNumber(firstValue(item, ["commentsCount", "commentCount", "statistics.commentCount"])) || undefined,
      publishDate: safeString(firstValue(item, ["date", "publishedAt", "publishDate", "snippet.publishedAt"])) || undefined,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeYouTubeTranscripts(rawItems: any[], channelRows: ChannelVideoRow[]) {
  const rowsByUrl = new Map(channelRows.map((row) => [row.videoUrl, row]));
  const rowsById = new Map(channelRows.map((row) => [row.videoId, row]));

  return rawItems.map((item: UnknownRecord) => {
    const videoId = extractVideoId(item);
    const videoUrl = buildVideoUrl(item);
    const channelData = rowsByUrl.get(videoUrl) || rowsById.get(videoId);
    const transcript = getTranscriptText(item);

    return {
      videoId: videoId || channelData?.videoId || "",
      title: safeString(firstValue(item, ["title", "name", "snippet.title"])) || channelData?.title || "",
      description: safeString(firstValue(item, ["description", "text", "snippet.description"])) || channelData?.description || "",
      views: safeNumber(firstValue(item, ["viewCount", "views", "statistics.viewCount"])) || channelData?.views || 0,
      likes: safeNumber(firstValue(item, ["likes", "likeCount", "statistics.likeCount"])) || channelData?.likes || 0,
      hashtags: ensureHashtagArray(channelData?.hashtags).length > 0 ? ensureHashtagArray(channelData?.hashtags) : extractHashtags(item),
      videoUrl: videoUrl || channelData?.videoUrl || "",
      transcript,
      transcriptStatus: transcript ? "ok" as const : "failed" as const,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractYouTubeTranscript(item: any): string {
  return getTranscriptText(item as UnknownRecord);
}
