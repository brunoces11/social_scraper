import { NextRequest, NextResponse } from "next/server";
import { fetchYouTubeChannelSearch } from "@/lib/search/youtube";
import { SearchRequestError } from "@/lib/search/shared";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await fetchYouTubeChannelSearch(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (error instanceof SearchRequestError) {
      return NextResponse.json({ error: message }, { status: error.status });
    }

    if (message.includes("TIMEOUT")) {
      return NextResponse.json({ error: message }, { status: 504 });
    }

    return NextResponse.json({ error: `Error fetching data: ${message}` }, { status: 500 });
  }
}
