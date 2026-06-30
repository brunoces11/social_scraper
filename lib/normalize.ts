import { ChannelVideoRow, TranscriptRow } from "@/types";
import { extractNamedHashtags, safeNumber, safeString } from "@/lib/normalize-shared";

function cleanWebVtt(raw: string): string {
  if (!raw || !raw.includes("-->")) return raw;
  return raw
    .replace(/^WEBVTT\s*/i, "")           // remove WEBVTT header
    .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g, "") // remove timestamps
    .replace(/\n{2,}/g, "\n")             // collapse multiple newlines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractHashtags(item: any): string[] {
  // Try "challenges" array (common in tiktok-scraper)
  if (Array.isArray(item.challenges)) {
    return item.challenges.map((c: { title?: string }) => c.title || "").filter(Boolean);
  }
  // Try "hashtags" array
  return extractNamedHashtags(item.hashtags);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildVideoUrl(item: any): string {
  if (item.postPage) return item.postPage;
  if (item.webVideoUrl) return item.webVideoUrl;
  if (item.videoUrl) return item.videoUrl;
  if (item.url) return item.url;
  // Build from author + id (apidojo uses channel.username)
  const author = item.channel?.username || item.authorMeta?.name || item.author?.uniqueId || item.author || "";
  const id = item.id || item.videoId || "";
  if (author && id) {
    return `https://www.tiktok.com/@${author}/video/${id}`;
  }
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeChannelVideos(rawItems: any[]): ChannelVideoRow[] {
  return rawItems.map((item) => {
    // clockworks uses "text", apidojo uses "title"
    const desc = safeString(item.text || item.desc || item.title || item.description || "");
    return {
      videoId: safeString(item.id || item.videoId),
      title: desc.substring(0, 80),
      description: desc,
      views: safeNumber(item.playCount ?? item.views ?? item.viewCount),
      likes: safeNumber(item.diggCount ?? item.likes ?? item.likeCount),
      hashtags: extractHashtags(item),
      videoUrl: buildVideoUrl(item),
      comments: safeNumber(item.commentCount ?? item.comments) || undefined,
      publishDate: safeString(item.createTimeISO || item.createTime || item.uploadedAtFormatted || item.publishDate) || undefined,
    };
  });
}

export function normalizeTranscripts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawItems: any[],
  channelRows: ChannelVideoRow[]
): TranscriptRow[] {
  // Build lookup by videoUrl for merging
  const channelMap = new Map<string, ChannelVideoRow>();
  for (const row of channelRows) {
    channelMap.set(row.videoUrl, row);
  }

  return rawItems.map((item) => {
    const videoUrl = safeString(item.videoUrl || item.url || "");
    const channelData = channelMap.get(videoUrl);

    const transcript = cleanWebVtt(safeString(item.transcript || item.text || item.transcription || ""));
    const transcriptStatus: "ok" | "failed" =
      transcript.trim().length > 0 ? "ok" : "failed";

    return {
      videoId: safeString(item.videoId || item.id || channelData?.videoId || ""),
      title: safeString(item.title || channelData?.title || ""),
      description: safeString(item.description || channelData?.description || ""),
      views: safeNumber(item.views ?? channelData?.views ?? 0),
      likes: safeNumber(item.likes ?? channelData?.likes ?? 0),
      hashtags: channelData?.hashtags || extractHashtags(item),
      videoUrl,
      transcript,
      transcriptStatus,
    };
  });
}
