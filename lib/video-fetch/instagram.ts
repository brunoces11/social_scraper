import { runActorAndGetResults } from "@/lib/apify";
import { normalizeInstagramHashtagVideos } from "@/lib/insta_normalize";
import actorsConfig from "@/apify-actors.json";
import {
  assertVideoUrls,
  finalizeVideoFetchRows,
  VideoFetchRequestError,
  VideoFetchRequestParams,
  VideoFetchResult,
} from "@/lib/video-fetch/shared";

type InstagramActorConfig = {
  id: string;
  name: string;
};

export async function fetchInstagramVideosByUrl(params: VideoFetchRequestParams): Promise<VideoFetchResult> {
  const { videoUrls, xlsLabel, accountId } = params;
  assertVideoUrls(videoUrls);

  const instaActors = (actorsConfig.instaActors || []) as InstagramActorConfig[];
  const hashtagActor = instaActors.find((a) => a.name === "Hashtag_Actor");

  if (!hashtagActor) {
    throw new VideoFetchRequestError("Instagram actor configuration not found", 500);
  }

  const input = { postURLs: videoUrls };

  const rawItems = await runActorAndGetResults(hashtagActor.id, input, accountId);
  const allRows = normalizeInstagramHashtagVideos(rawItems);

  return finalizeVideoFetchRows(allRows, xlsLabel);
}
