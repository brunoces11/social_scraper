import { runActorAndGetResults } from "@/lib/apify";
import { normalizeInstagramChannelVideos, normalizeInstagramHashtagVideos } from "@/lib/insta_normalize";
import actorsConfig from "@/apify-actors.json";
import {
  finalizeSearchRows,
  hasSearchInput,
  SearchRequestError,
  SearchRequestParams,
  SearchResult,
  toMaxVideos,
  toProxyCountryCode,
} from "@/lib/search/shared";
import { ChannelVideoRow } from "@/types";

type InstagramActorConfig = {
  id: string;
  name: string;
  inputUrlField: string;
};

function getInstagramActors() {
  const instaActors = (actorsConfig.instaActors || []) as InstagramActorConfig[];
  const profileActor = instaActors.find((a) => a.name === "Profile_Actor");
  const hashtagActor = instaActors.find((a) => a.name === "Hashtag_Actor");

  if (!profileActor || !hashtagActor) {
    throw new SearchRequestError("Instagram actor configuration not found", 500);
  }

  return { profileActor, hashtagActor };
}

export async function fetchInstagramChannelSearch(params: SearchRequestParams): Promise<SearchResult> {
  const { profileUrl, keyword, hashtag, maxVideos = 50, countryCode = "BR", accountId } = params;

  if (!hasSearchInput(params)) {
    throw new SearchRequestError("Fill in at least one field: Profile URL, keyword, or hashtag.", 400);
  }

  if (profileUrl) {
    const instagramUrlPattern = /^https?:\/\/(www\.)?instagram\.com\/[\w.]+\/?$/;
    if (!instagramUrlPattern.test(profileUrl.trim())) {
      throw new SearchRequestError("Invalid URL. Use the format: https://www.instagram.com/username", 400);
    }
  }

  const { profileActor, hashtagActor } = getInstagramActors();
  let allRows: ChannelVideoRow[] = [];

  if (profileUrl) {
    try {
      const profileInput: Record<string, unknown> = {
        [profileActor.inputUrlField]: profileUrl.trim(),
        resultsPerPage: toMaxVideos(maxVideos),
        proxyCountryCode: toProxyCountryCode(countryCode),
      };

      const profileRawItems = await runActorAndGetResults(profileActor.id, profileInput, accountId);
      const profileRows = normalizeInstagramChannelVideos(profileRawItems);
      allRows = allRows.concat(profileRows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new SearchRequestError(`Error fetching profile data: ${message}`, 500);
    }
  }

  if (hashtag || keyword) {
    try {
      const hashtagInput: Record<string, unknown> = {
        [hashtagActor.inputUrlField]: [(hashtag || keyword || "").trim().replace(/^#/, "")],
        resultsPerPage: toMaxVideos(maxVideos),
        proxyCountryCode: toProxyCountryCode(countryCode),
      };

      const hashtagRawItems = await runActorAndGetResults(hashtagActor.id, hashtagInput, accountId);
      const hashtagRows = normalizeInstagramHashtagVideos(hashtagRawItems);
      allRows = allRows.concat(hashtagRows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new SearchRequestError(`Error fetching hashtag/keyword data: ${message}`, 500);
    }
  }

  const uniqueRows = Array.from(new Map(allRows.map((row) => [row.videoUrl, row])).values());

  return finalizeSearchRows(uniqueRows, { channelUrl: profileUrl, keyword, hashtag });
}
