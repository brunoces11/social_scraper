import { NextRequest, NextResponse } from "next/server";
import { fetchYouTubeVideosByUrl } from "@/lib/video-fetch/youtube";
import { VideoFetchRequestError } from "@/lib/video-fetch/shared";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await fetchYouTubeVideosByUrl(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (error instanceof VideoFetchRequestError) {
      return NextResponse.json({ error: message }, { status: error.status });
    }

    return NextResponse.json({ error: `Error fetching video data: ${message}` }, { status: 500 });
  }
}
