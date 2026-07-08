import { runActorAndGetResults } from "@/lib/apify";
import { normalizeYouTubeVideos } from "@/lib/youtube_normalize";
import {
  assertVideoUrls,
  finalizeVideoFetchRows,
  VideoFetchRequestParams,
  VideoFetchResult,
} from "@/lib/video-fetch/shared";

const YOUTUBE_ACTOR_ID = "streamers/youtube-scraper";

export async function fetchYouTubeVideosByUrl(params: VideoFetchRequestParams): Promise<VideoFetchResult> {
  const { videoUrls, xlsLabel, accountId } = params;
  assertVideoUrls(videoUrls);

  const input = {
    startUrls: videoUrls.map((url) => ({ url })),
    maxResults: videoUrls.length,
    maxResultsShorts: videoUrls.length,
    maxResultStreams: 0,
  };

  const rawItems = await runActorAndGetResults(YOUTUBE_ACTOR_ID, input, accountId);
  const allRows = normalizeYouTubeVideos(rawItems);

  return finalizeVideoFetchRows(allRows, xlsLabel, "youtube");
}
