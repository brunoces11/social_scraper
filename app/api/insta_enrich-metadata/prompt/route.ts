import { NextRequest, NextResponse } from "next/server";
import { readPlatformPrompt, writePlatformPrompt } from "@/lib/platform-prompts";

export async function GET() {
  return NextResponse.json({ prompt: readPlatformPrompt("instagram") });
}

export async function PUT(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    writePlatformPrompt("instagram", prompt);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
