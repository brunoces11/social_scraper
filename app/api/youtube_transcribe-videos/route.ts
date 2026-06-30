import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { runActorAndGetResults } from "@/lib/apify";
import { buildFilePrefix, buildTxtContent, sanitizeFilename, type VideoMeta } from "@/lib/transcription-files";
import { extractYouTubeTranscript, normalizeYouTubeTranscripts } from "@/lib/youtube_normalize";

export const maxDuration = 300;

const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");
const YOUTUBE_ACTOR_ID = "streamers/youtube-scraper";

function getErrorSuffix(message: string): string {
  const msg = message.toLowerCase();
  if (msg.includes("caption") || msg.includes("subtitle") || msg.includes("transcript")) return "_erro_no_caption";
  if (msg.includes("timeout") || msg.includes("timed out")) return "_erro_timeout";
  if (msg.includes("not found") || msg.includes("private")) return "_erro_not_found";
  return "_erro_unknown";
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { videoUrls, videosMeta = [], accountId } = body;
  const debugLogs: string[] = [];

  try {
    debugLogs.push(`[INPUT] videoUrls count: ${videoUrls?.length}, videosMeta count: ${videosMeta?.length}`);

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: "Select at least one video." }, { status: 400 });
    }

    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    const input = {
      startUrls: videoUrls.map((url: string) => ({ url })),
      maxResults: videoUrls.length,
      maxResultsShorts: videoUrls.length,
      maxResultStreams: 0,
      downloadSubtitles: true,
      subtitlesFormat: "plaintext",
    };

    debugLogs.push(`[APIFY] actor=${YOUTUBE_ACTOR_ID}`);
    const rawItems = await runActorAndGetResults(YOUTUBE_ACTOR_ID, input, accountId);
    debugLogs.push(`[APIFY] rawItems count: ${rawItems.length}`);

    const savedFiles: string[] = [];
    const errors: string[] = [];
    const noTranscription: string[] = [];

    for (let i = 0; i < videoUrls.length; i++) {
      const url = videoUrls[i] as string;
      const meta = videosMeta[i] as VideoMeta | undefined;
      const item = rawItems.find((raw) => {
        const record = raw as Record<string, unknown>;
        const rawUrl = String(record.url || record.videoUrl || "");
        const rawId = String(record.id || record.videoId || "");
        return rawUrl === url || (rawId && url.includes(rawId));
      }) as Record<string, unknown> | undefined;

      try {
        if (!meta || !meta.title) {
          debugLogs.push(`[VIDEO ${i}] SKIP: no meta/title found`);
          noTranscription.push(url);
          continue;
        }

        const safeName = sanitizeFilename(meta.title);
        if (!safeName) {
          debugLogs.push(`[VIDEO ${i}] SKIP: sanitized name empty`);
          noTranscription.push(url);
          continue;
        }

        const transcript = item ? extractYouTubeTranscript(item) : "";
        const prefix = buildFilePrefix(meta.views, meta.publishDate);
        let transcriptField = transcript.trim();
        let errorSuffix = "";

        if (!transcriptField) {
          transcriptField = "ERRO: Transcript unavailable - no YouTube subtitles returned by Apify actor";
          errorSuffix = "_erro_no_caption";
          noTranscription.push(url);
          debugLogs.push(`[VIDEO ${i}] NO TRANSCRIPT: ${url}`);
        }

        const txtContent = buildTxtContent(meta, transcriptField);
        const fileName = `${prefix}${safeName}${errorSuffix}.txt`;
        const txtPath = path.join(DOWNLOAD_DIR, fileName);
        fs.writeFileSync(txtPath, txtContent, "utf-8");
        savedFiles.push(fileName);
        debugLogs.push(`[VIDEO ${i}] SAVED: ${fileName}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        errors.push(message);
        noTranscription.push(url);
        debugLogs.push(`[VIDEO ${i}] ERROR: ${message}`);
      }
    }

    const transcriptRows = normalizeYouTubeTranscripts(rawItems, videosMeta);

    debugLogs.push(`[RESULT] savedFiles=${savedFiles.length}, noTranscription=${noTranscription.length}, errors=${errors.length}`);
    return NextResponse.json({
      rawItems,
      transcriptRows,
      savedFiles,
      errors,
      noTranscription,
      debugLogs,
      downloadDir: DOWNLOAD_DIR,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const fallbackSaved: string[] = [];
    const fallbackLogs: string[] = [...debugLogs, `[TRANSCRIBE] YouTube service failed: ${message}`];

    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    for (let i = 0; i < videosMeta.length; i++) {
      const meta = videosMeta[i] as VideoMeta | undefined;
      if (!meta || !meta.title) continue;

      const safeName = sanitizeFilename(meta.title);
      if (!safeName) continue;

      const prefix = buildFilePrefix(meta.views, meta.publishDate);
      const txtContent = buildTxtContent(meta, `ERRO: YouTube transcription service failed - ${message}`);
      const fileName = `${prefix}${safeName}${getErrorSuffix(message)}.txt`;
      const txtPath = path.join(DOWNLOAD_DIR, fileName);
      fs.writeFileSync(txtPath, txtContent, "utf-8");
      fallbackSaved.push(fileName);
      fallbackLogs.push(`[FALLBACK] SAVED: ${fileName}`);
    }

    return NextResponse.json({
      error: null,
      serviceFailed: true,
      serviceError: message,
      rawItems: [],
      transcriptRows: [],
      savedFiles: fallbackSaved,
      errors: [message],
      noTranscription: videoUrls,
      debugLogs: fallbackLogs,
      downloadDir: DOWNLOAD_DIR,
    });
  }
}
