import { runActorAndGetResults } from "@/lib/apify";
import { normalizeYouTubeVideos } from "@/lib/youtube_normalize";
import {
  finalizeSearchRows,
  hasSearchInput,
  SearchRequestError,
  SearchRequestParams,
  SearchResult,
  toMaxVideos,
} from "@/lib/search/shared";

const YOUTUBE_ACTOR_ID = "streamers/youtube-scraper";

function isValidYouTubeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(url.hostname);
  } catch {
    return false;
  }
}

function hashtagToUrl(hashtag: string): string {
  return `https://www.youtube.com/hashtag/${encodeURIComponent(hashtag.replace(/^#/, ""))}`;
}

function toMonthsBack(value: unknown): number | null {
  const months = Number(value);
  if (!Number.isFinite(months) || months <= 0) return null;
  return Math.min(Math.floor(months), 120);
}

export async function fetchYouTubeChannelSearch(params: SearchRequestParams): Promise<SearchResult> {
  const { channelUrl, keyword, hashtag, maxVideos = 50, monthsBack, accountId } = params;
  const popularMonthsBack = toMonthsBack(monthsBack);

  if (!hasSearchInput(params)) {
    throw new SearchRequestError("Fill in at least one field: Channel URL, keyword, or hashtag.", 400);
  }

  const input: Record<string, unknown> = {
    maxResults: toMaxVideos(maxVideos),
    maxResultsShorts: toMaxVideos(maxVideos),
    maxResultStreams: 0,
  };

  const startUrls: { url: string }[] = [];
  if (channelUrl) {
    const trimmed = channelUrl.trim();
    if (!isValidYouTubeUrl(trimmed)) {
      throw new SearchRequestError("Invalid URL. Use a YouTube channel, video, playlist, or hashtag URL.", 400);
    }
    startUrls.push({ url: trimmed });
  }

  if (hashtag) {
    const tags = hashtag.split(",").map((tag) => tag.trim()).filter(Boolean);
    startUrls.push(...tags.map((tag) => ({ url: hashtagToUrl(tag) })));
  }

  if (startUrls.length > 0) {
    input.startUrls = startUrls;
  }

  if (channelUrl && popularMonthsBack) {
    input.oldestPostDate = `${popularMonthsBack} months`;
    input.sortVideosBy = "POPULAR";
  }

  if (keyword && startUrls.length === 0) {
    input.searchQueries = [keyword.trim()];
  }

  const rawItems = await runActorAndGetResults(YOUTUBE_ACTOR_ID, input, accountId);
  const allRows = normalizeYouTubeVideos(rawItems);

  return finalizeSearchRows(allRows, { channelUrl, keyword, hashtag });
}
