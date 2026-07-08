import { runActorAndGetResults } from "@/lib/apify";
import { normalizeChannelVideos } from "@/lib/normalize";
import {
  finalizeSearchRows,
  hasSearchInput,
  SearchRequestError,
  SearchRequestParams,
  SearchResult,
  toMaxVideos,
  toProxyCountryCode,
} from "@/lib/search/shared";

export async function fetchTikTokChannelSearch(params: SearchRequestParams): Promise<SearchResult> {
  const { channelUrl, keyword, hashtag, maxVideos = 50, countryCode = "BR", accountId } = params;

  if (!hasSearchInput(params)) {
    throw new SearchRequestError("Fill in at least one field: Channel URL, keyword, or hashtag.", 400);
  }

  const actorId = process.env.APIFY_CHANNEL_ACTOR_ID || "clockworks/tiktok-scraper";

  const input: Record<string, unknown> = {
    resultsPerPage: toMaxVideos(maxVideos),
    proxyCountryCode: toProxyCountryCode(countryCode),
  };

  if (channelUrl) {
    const tiktokUrlPattern = /^https?:\/\/(www\.)?tiktok\.com\/@[\w.]+\/?$/;
    if (!tiktokUrlPattern.test(channelUrl.trim())) {
      throw new SearchRequestError("Invalid URL. Use the format: https://www.tiktok.com/@username", 400);
    }
    input.profiles = [channelUrl.trim()];
  }

  if (keyword) {
    input.searchQueries = [keyword.trim()];
    input.searchSection = "";
    input.maxProfilesPerQuery = 10;
  }

  if (hashtag) {
    const tags = hashtag.split(",").map((t: string) => t.trim().replace(/^#/, "")).filter(Boolean);
    if (tags.length > 0) {
      input.hashtags = tags;
    }
  }

  const rawItems = await runActorAndGetResults(actorId, input, accountId);
  const allRows = normalizeChannelVideos(rawItems);

  return finalizeSearchRows(allRows, { channelUrl, keyword, hashtag }, "tiktok");
}
