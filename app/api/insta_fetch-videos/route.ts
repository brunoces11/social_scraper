import { NextRequest, NextResponse } from "next/server";
import { runActorAndGetResults } from "@/lib/apify";
import { normalizeInstagramHashtagVideos } from "@/lib/insta_normalize";
import { saveSearchToXls, getBlacklist } from "@/lib/xls";
import actorsConfig from "@/apify-actors.json";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrls, xlsLabel, accountId } = body;

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: "No URLs provided." }, { status: 400 });
    }

    // Get hashtag actor configuration (used for fetching individual Reels)
    const instaActors = actorsConfig.instaActors || [];
    const hashtagActor = instaActors.find((a) => a.name === "Hashtag_Actor");

    if (!hashtagActor) {
      return NextResponse.json(
        { error: "Instagram actor configuration not found" },
        { status: 500 }
      );
    }

    // For Instagram Reels, we need to extract shortcodes and fetch them
    // Using the hashtag actor as a fallback for individual Reel fetching
    const actorId = hashtagActor.id;
    const input = { postURLs: videoUrls };

    const rawItems = await runActorAndGetResults(actorId, input, accountId);
    const allRows = normalizeInstagramHashtagVideos(rawItems);

    const blacklist = getBlacklist();
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
      savedFile = saveSearchToXls(label, xlsRows);
    } catch (xlsErr) {
      console.error("Error saving XLS:", xlsErr);
    }

    return NextResponse.json({ rows, savedFile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Error fetching video data: ${message}` }, { status: 500 });
  }
}
