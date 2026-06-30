import { NextRequest, NextResponse } from "next/server";
import { readPlatformPrompt, writePlatformPrompt } from "@/lib/platform-prompts";

export async function GET() {
  return NextResponse.json({ prompt: readPlatformPrompt("youtube") });
}

export async function PUT(request: NextRequest) {
  const { prompt } = await request.json();
  if (typeof prompt !== "string") {
    return NextResponse.json({ error: "Invalid prompt" }, { status: 400 });
  }
  try {
    writePlatformPrompt("youtube", prompt);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
