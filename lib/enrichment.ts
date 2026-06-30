import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { PlatformId } from "@/lib/platforms";
import { normalizePlatform } from "@/lib/platforms";
import { readPlatformPrompt } from "@/lib/platform-prompts";
import { buildFilePrefix, sanitizeFilename } from "@/lib/transcription-files";

export const ENRICHMENT_MAX_DURATION = 600;

const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const BATCH_SIZE = 10;

interface VideoForLLM {
  videoId: string;
  title: string;
  description: string;
  hashtags: string;
  transcription: string;
}

interface VideoMeta {
  videoId: string;
  title: string;
  views: number;
  likes: number;
  description: string;
  hashtags: string;
  videoUrl: string;
  publishDate: string;
  transcription: string;
}

interface LLMResponse {
  videos: VideoForLLM[];
}

function buildEnrichedTxtContent(llm: VideoForLLM, meta: VideoMeta): string {
  return `LLM_Title: ${llm.title}

LLM_Description: ${llm.description}

LLM_Hashtags: ${llm.hashtags}

LLM_Transcription: ${llm.transcription}

-----

Title: ${meta.title}

Description: ${meta.description}

Hashtags: ${meta.hashtags}

Transcription: ${meta.transcription}

Views: ${meta.views.toLocaleString("en-US")}

Likes: ${meta.likes.toLocaleString("en-US")}

Link: ${meta.videoUrl}

Date: ${meta.publishDate}`;
}

function buildUserPrompt(platform: PlatformId, videos: VideoForLLM[]): string {
  const target = platform === "instagram" ? "Instagram Reels" : "videos";
  return `Process the following ${target} and return enriched versions:\n\n${JSON.stringify({ videos }, null, 2)}\n\nReturn JSON with format: { "videos": [{ "videoId": "...", "title": "...", "description": "...", "hashtags": "...", "transcription": "..." }] }`;
}

async function callOpenAI(videos: VideoForLLM[], platform: PlatformId): Promise<LLMResponse> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: readPlatformPrompt(platform) },
        { role: "user", content: buildUserPrompt(platform, videos) },
      ],
      temperature: 0.8,
      max_tokens: 16000,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty response");

  return JSON.parse(content) as LLMResponse;
}

export async function handleEnrichmentPost(
  request: NextRequest,
  defaultPlatform: PlatformId
) {
  const debugLogs: string[] = [];

  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    const body = await request.json();
    const platform = normalizePlatform(body.platform, defaultPlatform);
    const { videos, videosMeta } = body as {
      platform?: PlatformId;
      videos: VideoForLLM[];
      videosMeta: VideoMeta[];
    };

    if (!Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json({ error: "No videos provided." }, { status: 400 });
    }

    debugLogs.push(`[INPUT] ${videos.length} video(s) to enrich (batch size: ${BATCH_SIZE})`);

    const metaMap = new Map<string, VideoMeta>();
    for (const m of videosMeta || []) {
      metaMap.set(m.videoId, m);
    }

    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    const allLlmVideos: VideoForLLM[] = [];
    const savedFiles: string[] = [];
    const errors: string[] = [];
    const totalBatches = Math.ceil(videos.length / BATCH_SIZE);

    for (let b = 0; b < totalBatches; b++) {
      const batchStart = b * BATCH_SIZE;
      const batch = videos.slice(batchStart, batchStart + BATCH_SIZE);
      debugLogs.push(`[BATCH ${b + 1}/${totalBatches}] Processing ${batch.length} video(s)...`);

      let batchResult: LLMResponse | null = null;
      try {
        batchResult = await callOpenAI(batch, platform);
      } catch (firstErr) {
        debugLogs.push(`[BATCH ${b + 1}] First attempt failed: ${firstErr instanceof Error ? firstErr.message : "unknown"}, retrying...`);
        try {
          batchResult = await callOpenAI(batch, platform);
        } catch (retryErr) {
          const msg = retryErr instanceof Error ? retryErr.message : "unknown";
          debugLogs.push(`[BATCH ${b + 1}] Retry failed: ${msg}`);
          errors.push(`Batch ${b + 1} failed: ${msg}`);
          continue;
        }
      }

      if (!batchResult || !Array.isArray(batchResult.videos)) {
        debugLogs.push(`[BATCH ${b + 1}] Invalid LLM response - skipping`);
        errors.push(`Batch ${b + 1}: invalid LLM response`);
        continue;
      }

      debugLogs.push(`[BATCH ${b + 1}] LLM returned ${batchResult.videos.length} enriched item(s)`);

      for (const llmItem of batchResult.videos) {
        try {
          const meta = metaMap.get(llmItem.videoId);
          if (!meta) {
            debugLogs.push(`[SKIP] videoId ${llmItem.videoId} not found in videosMeta`);
            continue;
          }

          const safeName = sanitizeFilename(meta.title);
          if (!safeName) {
            debugLogs.push(`[SKIP] empty filename for videoId ${llmItem.videoId}`);
            continue;
          }

          const prefix = buildFilePrefix(meta.views, meta.publishDate);
          const txtContent = buildEnrichedTxtContent(llmItem, meta);
          const txtPath = path.join(DOWNLOAD_DIR, `${prefix}${safeName}.txt`);
          fs.writeFileSync(txtPath, txtContent, "utf-8");
          savedFiles.push(`${prefix}${safeName}.txt`);
          debugLogs.push(`[SAVED] ${prefix}${safeName}.txt (${txtContent.length} chars)`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown";
          errors.push(msg);
          debugLogs.push(`[ERROR] ${msg}`);
        }
      }

      allLlmVideos.push(...batchResult.videos);
    }

    debugLogs.push(`[RESULT] saved=${savedFiles.length}, errors=${errors.length}, totalBatches=${totalBatches}`);
    return NextResponse.json({ savedFiles, errors, debugLogs, downloadDir: DOWNLOAD_DIR, llmVideos: allLlmVideos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg, debugLogs }, { status: 500 });
  }
}
