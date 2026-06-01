import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";

export const maxDuration = 300;

const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");

interface VideoMeta {
  title: string;
  views: number;
  likes: number;
  comments?: number;
  description: string;
  hashtags: string[] | string;
  videoUrl: string;
  publishDate: string;
}

function sanitizeFilename(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 100);
}

const MONTH_ABBR = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function buildFilePrefix(views: number, publishDate: string): string {
  let datePart = "";
  if (publishDate) {
    const d = new Date(publishDate);
    if (!isNaN(d.getTime())) {
      const mmm = MONTH_ABBR[d.getMonth()];
      const aa = String(d.getFullYear()).slice(-2);
      datePart = `${mmm}${aa}`;
    }
  }
  const v = views || 0;
  const tier = v >= 10_000_000 ? "1A" : v >= 1_000_000 ? "2A" : "3A";
  const viewsPart = String(v);
  return datePart ? `${tier}_${viewsPart}-${datePart}-` : `${tier}_${viewsPart}-`;
}

function extractInstagramShortcode(url: string): string {
  const match = url.match(/\/reel\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : "";
}

function formatHashtags(hashtags: string[] | string): string {
  if (Array.isArray(hashtags)) {
    return hashtags.join(", ");
  }
  return String(hashtags || "");
}

function buildTxtContent(meta: VideoMeta, transcript: string): string {
  return `Title: ${meta.title}

Description: ${meta.description}

Hashtags: ${formatHashtags(meta.hashtags)}

Transcription: ${transcript}

Views: ${meta.views.toLocaleString("en-US")}

Likes: ${meta.likes.toLocaleString("en-US")}

Link: ${meta.videoUrl}

Date: ${meta.publishDate}`;
}

async function downloadAudioWithYtDlp(reelUrl: string, outputPath: string): Promise<void> {
  try {
    // Use yt-dlp to download audio from Instagram Reel
    const command = `yt-dlp -f bestaudio --extract-audio --audio-format mp3 --audio-quality 192K -o "${outputPath}" "${reelUrl}"`;
    execSync(command, { stdio: "pipe" });
  } catch (error) {
    throw new Error(`Failed to download audio from ${reelUrl}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function transcribeWithWhisper(audioPath: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable not set");
  }

  try {
    // Read audio file
    const audioBuffer = fs.readFileSync(audioPath);

    // Create FormData for multipart request using native FormData
    const form = new FormData();
    form.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }), path.basename(audioPath));
    form.append("model", "whisper-1");

    // Call OpenAI Whisper API
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Whisper API error: ${response.status} ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return result.text || "";
  } catch (error) {
    throw new Error(`Whisper transcription failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { videoUrls, videosMeta = [] } = body;
  const debugLogs: string[] = [];

  try {
    debugLogs.push(`[INPUT] videoUrls count: ${videoUrls?.length}, videosMeta count: ${videosMeta?.length}`);

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: "Select at least one video." }, { status: 400 });
    }

    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    const savedFiles: string[] = [];
    const errors: string[] = [];
    const noTranscription: string[] = [];

    for (let i = 0; i < videoUrls.length; i++) {
      const reelUrl = videoUrls[i] as string;
      const meta = videosMeta[i] as VideoMeta | undefined;

      try {
        debugLogs.push(`[REEL ${i}] Processing: ${reelUrl.substring(0, 80)}`);

        // Validate metadata
        if (!meta || !meta.title) {
          debugLogs.push(`[REEL ${i}] SKIP: no meta/title found`);
          noTranscription.push(reelUrl);
          continue;
        }

        const safeName = sanitizeFilename(meta.title);
        if (!safeName) {
          debugLogs.push(`[REEL ${i}] SKIP: sanitized name empty`);
          noTranscription.push(reelUrl);
          continue;
        }

        const shortcode = extractInstagramShortcode(reelUrl);
        const prefix = buildFilePrefix(meta.views, meta.publishDate);

        // Download audio
        const tempAudioPath = path.join(DOWNLOAD_DIR, `temp_${shortcode}.mp3`);
        let transcriptField: string;
        let errorSuffix = "";

        try {
          debugLogs.push(`[REEL ${i}] Downloading audio...`);
          await downloadAudioWithYtDlp(reelUrl, tempAudioPath);

          // Transcribe with Whisper
          debugLogs.push(`[REEL ${i}] Transcribing with Whisper...`);
          const transcript = await transcribeWithWhisper(tempAudioPath);

          if (!transcript || !transcript.trim()) {
            transcriptField = "ERRO: Whisper returned empty transcription";
            errorSuffix = "_erro_empty";
            noTranscription.push(reelUrl);
            debugLogs.push(`[REEL ${i}] EMPTY TRANSCRIPT`);
          } else {
            transcriptField = transcript.trim();
            debugLogs.push(`[REEL ${i}] Transcription successful (${transcript.length} chars)`);
          }

          // Clean up temp audio file
          if (fs.existsSync(tempAudioPath)) {
            fs.unlinkSync(tempAudioPath);
          }
        } catch (downloadErr) {
          const errMsg = downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
          transcriptField = `ERRO: ${errMsg}`;
          errorSuffix = "_erro_download";
          noTranscription.push(reelUrl);
          debugLogs.push(`[REEL ${i}] DOWNLOAD/TRANSCRIBE ERROR: ${errMsg}`);

          // Clean up temp audio file if it exists
          if (fs.existsSync(tempAudioPath)) {
            try {
              fs.unlinkSync(tempAudioPath);
            } catch {
              // Ignore cleanup errors
            }
          }
        }

        // Save transcription file
        const txtContent = buildTxtContent(meta, transcriptField);
        const fileName = `${prefix}${safeName}${errorSuffix}.txt`;
        const txtPath = path.join(DOWNLOAD_DIR, fileName);
        fs.writeFileSync(txtPath, txtContent, "utf-8");
        savedFiles.push(fileName);
        debugLogs.push(`[REEL ${i}] SAVED: ${fileName}`);
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : "unknown error";
        debugLogs.push(`[REEL ${i}] ERROR: ${errMsg}`);
        errors.push(errMsg);
        noTranscription.push(reelUrl);
      }
    }

    debugLogs.push(`[RESULT] savedFiles=${savedFiles.length}, noTranscription=${noTranscription.length}, errors=${errors.length}`);
    return NextResponse.json({
      savedFiles,
      errors,
      noTranscription,
      debugLogs,
      downloadDir: DOWNLOAD_DIR,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const fallbackSaved: string[] = [];
    const fallbackLogs: string[] = [...debugLogs, `❌ [TRANSCRIBE] Service failed: ${msg}`];

    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    // Save fallback files with error message
    for (let i = 0; i < videosMeta.length; i++) {
      const meta = videosMeta[i] as VideoMeta | undefined;
      if (!meta || !meta.title) continue;

      const safeName = sanitizeFilename(meta.title);
      if (!safeName) continue;

      const prefix = buildFilePrefix(meta.views, meta.publishDate);
      const txtContent = buildTxtContent(meta, `ERRO: Transcription service failed — ${msg}`);
      const fileName = `${prefix}${safeName}_erro_service.txt`;
      const txtPath = path.join(DOWNLOAD_DIR, fileName);
      fs.writeFileSync(txtPath, txtContent, "utf-8");
      fallbackSaved.push(fileName);
      fallbackLogs.push(`[FALLBACK] SAVED: ${fileName}`);
    }

    return NextResponse.json({
      error: null,
      serviceFailed: true,
      serviceError: msg,
      savedFiles: fallbackSaved,
      errors: [msg],
      noTranscription: videoUrls,
      debugLogs: fallbackLogs,
      downloadDir: DOWNLOAD_DIR,
    });
  }
}
