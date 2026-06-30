import { runActorAndGetResults } from "@/lib/apify";
import { normalizeChannelVideos } from "@/lib/normalize";
import {
  assertVideoUrls,
  finalizeVideoFetchRows,
  VideoFetchRequestParams,
  VideoFetchResult,
} from "@/lib/video-fetch/shared";

export async function fetchTikTokVideosByUrl(params: VideoFetchRequestParams): Promise<VideoFetchResult> {
  const { videoUrls, xlsLabel, accountId } = params;
  assertVideoUrls(videoUrls);

  const actorId = "clockworks/tiktok-video-scraper";
  const input = { postURLs: videoUrls };

  const rawItems = await runActorAndGetResults(actorId, input, accountId);
  const allRows = normalizeChannelVideos(rawItems);

  return finalizeVideoFetchRows(allRows, xlsLabel);
}
