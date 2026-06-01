import { ChannelVideoRow } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeString(value: any): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeNumber(value: any): number {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractHashtags(item: any): string[] {
  // Try "hashtags" array
  if (Array.isArray(item.hashtags)) {
    return item.hashtags.map((h: { name?: string } | string) =>
      typeof h === "string" ? h : h.name || ""
    ).filter(Boolean);
  }
  return [];
}

/**
 * Normalize Instagram Profile_Actor response to ChannelVideoRow
 * Maps Profile_Actor fields to shared ChannelVideoRow type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeInstagramChannelVideos(rawItems: any[]): ChannelVideoRow[] {
  return rawItems.map((item) => {
    // Profile_Actor uses caption_text for title/description
    const desc = safeString(item.caption_text || item.description || "");
    
    // Build author URL if not provided
    let videoUrl = safeString(item.reel_url || item.url || "");
    if (!videoUrl && item.author_username) {
      const reelId = safeString(item.reel_id || item.id || "");
      if (reelId) {
        videoUrl = `https://www.instagram.com/reel/${reelId}/`;
      }
    }

    return {
      videoId: safeString(item.reel_id || item.id),
      title: desc.substring(0, 80),
      description: desc,
      views: safeNumber(item.play_count ?? item.views ?? item.viewCount),
      likes: safeNumber(item.like_count ?? item.likes ?? item.likeCount),
      hashtags: extractHashtags(item),
      videoUrl,
      comments: safeNumber(item.comment_count ?? item.comments ?? item.commentsCount) || undefined,
      publishDate: safeString(item.taken_at_iso || item.timestamp || item.publishDate) || undefined,
    };
  });
}

/**
 * Normalize Instagram Hashtag_Actor response to ChannelVideoRow
 * Maps Hashtag_Actor fields to shared ChannelVideoRow type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeInstagramHashtagVideos(rawItems: any[]): ChannelVideoRow[] {
  return rawItems.map((item) => {
    // Hashtag_Actor uses caption for description
    const desc = safeString(item.caption || item.description || "");
    
    // Build video URL if not provided
    let videoUrl = safeString(item.url || item.videoUrl || "");
    if (!videoUrl && item.ownerUsername) {
      const reelId = safeString(item.id || item.videoId || "");
      if (reelId) {
        videoUrl = `https://www.instagram.com/reel/${reelId}/`;
      }
    }

    return {
      videoId: safeString(item.id || item.videoId),
      title: desc.substring(0, 80),
      description: desc,
      views: safeNumber(item.videoPlayCount ?? item.views ?? item.viewCount),
      likes: safeNumber(item.likesCount ?? item.likes ?? item.likeCount),
      hashtags: extractHashtags(item),
      videoUrl,
      comments: safeNumber(item.commentsCount ?? item.comments ?? item.commentCount) || undefined,
      publishDate: safeString(item.timestamp || item.publishDate || item.taken_at_iso) || undefined,
    };
  });
}
