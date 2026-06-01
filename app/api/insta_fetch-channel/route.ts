import { NextRequest, NextResponse } from "next/server";
import { runActorAndGetResults } from "@/lib/apify";
import { normalizeInstagramChannelVideos, normalizeInstagramHashtagVideos } from "@/lib/insta_normalize";
import { buildSearchLabel, saveSearchToXls, getBlacklist } from "@/lib/xls";
import actorsConfig from "@/apify-actors.json";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileUrl, keyword, hashtag, maxVideos = 50, countryCode = "BR", accountId } = body;

    if (!profileUrl && !keyword && !hashtag) {
      return NextResponse.json(
        { error: "Fill in at least one field: Profile URL, keyword, or hashtag." },
        { status: 400 }
      );
    }

    // Validate Instagram profile URL if provided
    if (profileUrl) {
      const instagramUrlPattern = /^https?:\/\/(www\.)?instagram\.com\/[\w.]+\/?$/;
      if (!instagramUrlPattern.test(profileUrl.trim())) {
        return NextResponse.json(
          { error: "Invalid URL. Use the format: https://www.instagram.com/username" },
          { status: 400 }
        );
      }
    }

    // Get actor configurations from apify-actors.json
    const instaActors = actorsConfig.instaActors || [];
    const profileActor = instaActors.find((a) => a.name === "Profile_Actor");
    const hashtagActor = instaActors.find((a) => a.name === "Hashtag_Actor");

    if (!profileActor || !hashtagActor) {
      return NextResponse.json(
        { error: "Instagram actor configuration not found" },
        { status: 500 }
      );
    }

    let allRows: any[] = [];

    // Call Profile_Actor if profile URL is provided
    if (profileUrl) {
      try {
        const profileInput: Record<string, unknown> = {
          [profileActor.inputUrlField]: profileUrl.trim(),
          resultsPerPage: Number(maxVideos) || 50,
          proxyCountryCode: countryCode || "None",
        };

        const profileRawItems = await runActorAndGetResults(profileActor.id, profileInput, accountId);
        const profileRows = normalizeInstagramChannelVideos(profileRawItems);
        allRows = allRows.concat(profileRows);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
          { error: `Error fetching profile data: ${message}` },
          { status: 500 }
        );
      }
    }

    // Call Hashtag_Actor if hashtag or keyword is provided
    if (hashtag || keyword) {
      try {
        const hashtagInput: Record<string, unknown> = {
          [hashtagActor.inputUrlField]: [(hashtag || keyword || "").trim().replace(/^#/, "")],
          resultsPerPage: Number(maxVideos) || 50,
          proxyCountryCode: countryCode || "None",
        };

        const hashtagRawItems = await runActorAndGetResults(hashtagActor.id, hashtagInput, accountId);
        const hashtagRows = normalizeInstagramHashtagVideos(hashtagRawItems);
        allRows = allRows.concat(hashtagRows);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
          { error: `Error fetching hashtag/keyword data: ${message}` },
          { status: 500 }
        );
      }
    }

    // Remove duplicates by videoUrl
    const uniqueRows = Array.from(
      new Map(allRows.map((row) => [row.videoUrl, row])).values()
    );

    // Filter out blacklisted videos
    const blacklist = getBlacklist();
    const rows = uniqueRows.filter((r) => !blacklist.has(r.videoUrl));

    // Sort by views descending
    rows.sort((a, b) => b.views - a.views);

    // Auto-save to XLS
    let savedFile = "";
    try {
      const label = buildSearchLabel({ channelUrl: profileUrl, keyword, hashtag });
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

    if (message.includes("TIMEOUT")) {
      return NextResponse.json({ error: message }, { status: 504 });
    }

    return NextResponse.json(
      { error: `Error fetching data: ${message}` },
      { status: 500 }
    );
  }
}
