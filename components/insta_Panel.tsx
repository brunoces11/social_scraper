"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import InstaChannelForm, { type InstaSearchParams } from "@/components/insta_ChannelForm";
import VideoResultsTable from "@/components/VideoResultsTable";
import TranscriptResultsTable from "@/components/TranscriptResultsTable";
import { ChannelVideoRow, TranscriptRow } from "@/types";
import { normalizeTranscripts } from "@/lib/normalize";

export default function InstaPanel() {
  const [channelRows, setChannelRows] = useState<ChannelVideoRow[]>([]);
  const [selectedVideoUrls, setSelectedVideoUrls] = useState<string[]>([]);
  const [transcriptRows, setTranscriptRows] = useState<TranscriptRow[]>([]);
  const [isFetchingChannel, setIsFetchingChannel] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [detailLogs, setDetailLogs] = useState<string[]>([]);
  const [apifyCredits, setApifyCredits] = useState<{ usedUsd: number; limitUsd: number; remainingUsd: number } | null>(null);
  const [isRunningAI, setIsRunningAI] = useState(false);
  const [runAIStatus, setRunAIStatus] = useState<string | null>(null);
  const [apifyAccounts, setApifyAccounts] = useState<{ id: string; label: string; default: boolean }[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const selectedAccountIdRef = useRef<string>("");
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [elevenlabsAccounts, setElevenlabsAccounts] = useState<{ id: string; label: string; default: boolean }[]>([]);
  const [selectedElevenLabsAccountId, setSelectedElevenLabsAccountId] = useState<string>("");
  const selectedElevenLabsAccountIdRef = useRef<string>("");
  const [elevenlabsVoices, setElevenlabsVoices] = useState<{ id: string; name: string; default: boolean }[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [elevenlabsCredits, setElevenlabsCredits] = useState<{ characterCount: number; characterLimit: number; characterRemaining: number } | null>(null);
  const [currentXlsFile, setCurrentXlsFile] = useState<string>("");

  const fetchCredits = useCallback(async (accountId?: string) => {
    try {
      const accId = accountId || selectedAccountIdRef.current;
      const url = accId ? `/api/apify-credits?accountId=${accId}` : "/api/apify-credits";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setApifyCredits(data);
        return data.usedUsd as number;
      }
    } catch { /* silent */ }
    return null;
  }, []);

  const fetchElevenLabsCredits = useCallback(async (accountId?: string) => {
    try {
      const accId = accountId || selectedElevenLabsAccountIdRef.current;
      const url = accId ? `/api/elevenlabs-credits?accountId=${accId}` : "/api/elevenlabs-credits";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setElevenlabsCredits(data);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    // Load Apify accounts
    fetch("/api/apify-accounts")
      .then((r) => r.json())
      .then((data) => {
        const accounts = data.accounts || [];
        setApifyAccounts(accounts);
        const defaultAcc = accounts.find((a: { default: boolean }) => a.default);
        const accId = defaultAcc?.id || accounts[0]?.id || "";
        if (accId) {
          setSelectedAccountId(accId);
          selectedAccountIdRef.current = accId;
          fetchCredits(accId);
        }
      })
      .catch(() => { fetchCredits(); });

    // Load ElevenLabs accounts
    fetch("/api/elevenlabs-accounts")
      .then((r) => r.json())
      .then((data) => {
        const accounts = data.accounts || [];
        setElevenlabsAccounts(accounts);
        const defaultAcc = accounts.find((a: { default: boolean }) => a.default);
        const accId = defaultAcc?.id || accounts[0]?.id || "";
        if (accId) {
          setSelectedElevenLabsAccountId(accId);
          selectedElevenLabsAccountIdRef.current = accId;
          fetchElevenLabsCredits(accId);
        }
      })
      .catch(() => { fetchElevenLabsCredits(); });

    // Load ElevenLabs voices
    fetch("/api/elevenlabs-voices")
      .then((r) => r.json())
      .then((data) => {
        const voices = data.voices || [];
        setElevenlabsVoices(voices);
        const defaultVoice = voices.find((v: { default: boolean }) => v.default);
        if (defaultVoice) setSelectedVoiceId(defaultVoice.id);
        else if (voices.length > 0) setSelectedVoiceId(voices[0].id);
      })
      .catch(() => {});
  }, [fetchCredits, fetchElevenLabsCredits]);

  const handleSearch = useCallback(async (params: InstaSearchParams) => {
    setError(null);
    setDetailLogs([]);
    setIsFetchingChannel(true);
    try {
      const res = await fetch("/api/insta_fetch-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileUrl: params.profileUrl,
          keyword: params.keyword,
          hashtag: params.hashtag,
          maxVideos: params.maxVideos,
          countryCode: params.countryCode,
          accountId: selectedAccountIdRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to fetch channel");
        return;
      }
      setChannelRows(data.rows || []);
      setSelectedVideoUrls([]);
      setTranscriptRows([]);
      setCurrentXlsFile(data.savedFile || "");
      setDetailLogs([`✅ Fetched ${data.rows?.length || 0} videos`]);
      fetchCredits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsFetchingChannel(false);
    }
  }, [fetchCredits]);

  const handleTranscribe = useCallback(async () => {
    if (selectedVideoUrls.length === 0) {
      setError("Select at least one video");
      return;
    }
    setError(null);
    setIsTranscribing(true);
    setTranscriptStatus("Transcribing...");
    try {
      const videosMeta = channelRows.filter((r) => selectedVideoUrls.includes(r.videoUrl));
      const res = await fetch("/api/insta_transcribe-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrls: selectedVideoUrls,
          videosMeta,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Transcription failed");
        return;
      }
      setDetailLogs(data.debugLogs || []);
      setTranscriptStatus(`✅ Transcribed ${data.savedFiles?.length || 0} files`);
      // Normalize transcripts
      const normalized = normalizeTranscripts(data.savedFiles || [], channelRows);
      setTranscriptRows(normalized);
      fetchCredits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsTranscribing(false);
    }
  }, [selectedVideoUrls, channelRows, fetchCredits]);

  const handleRunAI = useCallback(async () => {
    if (selectedVideoUrls.length === 0) {
      setError("Select at least one video");
      return;
    }
    setError(null);
    setIsRunningAI(true);
    setRunAIStatus("Running AI enrichment...");
    try {
      const videosMeta = channelRows.filter((r) => selectedVideoUrls.includes(r.videoUrl));
      const videos = videosMeta.map((m) => ({
        videoId: m.videoId,
        title: m.title,
        description: m.description,
        hashtags: m.hashtags.join(", "),
        transcription: transcriptRows.find((t) => t.title === m.title)?.transcript || "",
      }));

      const res = await fetch("/api/insta_enrich-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videos,
          videosMeta: videosMeta.map((m) => ({
            ...m,
            hashtags: m.hashtags.join(", "),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "AI enrichment failed");
        return;
      }
      setDetailLogs(data.debugLogs || []);
      setRunAIStatus(`✅ Enriched ${data.savedFiles?.length || 0} files`);
      fetchCredits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsRunningAI(false);
    }
  }, [selectedVideoUrls, channelRows, transcriptRows, fetchCredits]);

  const handleGenerateTTS = useCallback(async () => {
    if (selectedVideoUrls.length === 0) {
      setError("Select at least one video");
      return;
    }
    setError(null);
    setIsDownloading(true);
    setDownloadStatus("Generating TTS...");
    try {
      const res = await fetch("/api/generate-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrls: selectedVideoUrls,
          accountId: selectedElevenLabsAccountIdRef.current,
          voiceId: selectedVoiceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "TTS generation failed");
        return;
      }
      setDetailLogs(data.debugLogs || []);
      setDownloadStatus(`✅ Generated ${data.savedFiles?.length || 0} audio files`);
      fetchElevenLabsCredits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsDownloading(false);
    }
  }, [selectedVideoUrls, selectedVoiceId, fetchElevenLabsCredits]);

  const handleDownloadVideos = useCallback(async () => {
    if (selectedVideoUrls.length === 0) {
      setError("Select at least one video");
      return;
    }
    setError(null);
    setIsDownloading(true);
    setDownloadStatus("Downloading videos...");
    try {
      const res = await fetch("/api/download-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrls: selectedVideoUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Download failed");
        return;
      }
      setDetailLogs(data.debugLogs || []);
      setDownloadStatus(`✅ Downloaded ${data.savedFiles?.length || 0} videos`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsDownloading(false);
    }
  }, [selectedVideoUrls]);

  const handleDownloadAll = useCallback(async () => {
    if (selectedVideoUrls.length === 0) {
      setError("Select at least one video");
      return;
    }
    setError(null);
    setIsDownloadingAll(true);
    setDetailLogs(["Starting full pipeline..."]);
    try {
      // Step 1: Check files
      setDetailLogs((prev) => [...prev, "Step 1: Checking existing files..."]);
      const checkRes = await fetch("/api/check-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrls: selectedVideoUrls }),
      });
      const checkData = await checkRes.json();
      const urlsToProcess = checkData.urlsToProcess || selectedVideoUrls;

      // Step 2: Transcribe
      setDetailLogs((prev) => [...prev, `Step 2: Transcribing ${urlsToProcess.length} videos...`]);
      const videosMeta = channelRows.filter((r) => urlsToProcess.includes(r.videoUrl));
      const transcribeRes = await fetch("/api/insta_transcribe-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrls: urlsToProcess, videosMeta }),
      });
      const transcribeData = await transcribeRes.json();
      setDetailLogs((prev) => [...prev, `✅ Transcribed ${transcribeData.savedFiles?.length || 0} files`]);

      // Step 3: Enrich
      setDetailLogs((prev) => [...prev, "Step 3: Running AI enrichment..."]);
      const videos = videosMeta.map((m) => ({
        videoId: m.videoId,
        title: m.title,
        description: m.description,
        hashtags: m.hashtags.join(", "),
        transcription: "",
      }));
      const enrichRes = await fetch("/api/insta_enrich-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videos, videosMeta }),
      });
      const enrichData = await enrichRes.json();
      setDetailLogs((prev) => [...prev, `✅ Enriched ${enrichData.savedFiles?.length || 0} files`]);

      // Step 4: Generate TTS
      setDetailLogs((prev) => [...prev, "Step 4: Generating TTS..."]);
      const ttsRes = await fetch("/api/generate-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrls: urlsToProcess,
          accountId: selectedElevenLabsAccountIdRef.current,
          voiceId: selectedVoiceId,
        }),
      });
      const ttsData = await ttsRes.json();
      setDetailLogs((prev) => [...prev, `✅ Generated ${ttsData.savedFiles?.length || 0} audio files`]);

      // Step 5: Download videos
      setDetailLogs((prev) => [...prev, "Step 5: Downloading videos..."]);
      const dlRes = await fetch("/api/download-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrls: urlsToProcess }),
      });
      const dlData = await dlRes.json();
      setDetailLogs((prev) => [...prev, `✅ Downloaded ${dlData.savedFiles?.length || 0} videos`]);

      setDetailLogs((prev) => [...prev, "✅ Full pipeline completed!"]);
      fetchCredits();
      fetchElevenLabsCredits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsDownloadingAll(false);
    }
  }, [selectedVideoUrls, channelRows, selectedVoiceId, fetchCredits, fetchElevenLabsCredits]);

  const handleOpenPromptModal = useCallback(async () => {
    try {
      const res = await fetch("/api/insta_enrich-metadata/prompt");
      const data = await res.json();
      setPromptText(data.prompt || "");
      setShowPromptModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prompt");
    }
  }, []);

  const handleSavePrompt = useCallback(async () => {
    setIsSavingPrompt(true);
    try {
      const res = await fetch("/api/insta_enrich-metadata/prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      });
      if (res.ok) {
        setShowPromptModal(false);
        setDetailLogs((prev) => [...prev, "✅ Prompt saved"]);
      } else {
        setError("Failed to save prompt");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save prompt");
    } finally {
      setIsSavingPrompt(false);
    }
  }, [promptText]);

  return (
    <div className="panel">
      <h2>📸 Instagram Reels</h2>

      <InstaChannelForm onSubmit={handleSearch} isLoading={isFetchingChannel} />

      {error && <div className="error-box">{error}</div>}

      {apifyCredits && (
        <div className="credits-box">
          Apify: ${apifyCredits.usedUsd.toFixed(2)} / ${apifyCredits.limitUsd.toFixed(2)} (${apifyCredits.remainingUsd.toFixed(2)} remaining)
        </div>
      )}

      {elevenlabsCredits && (
        <div className="credits-box">
          ElevenLabs: {elevenlabsCredits.characterCount} / {elevenlabsCredits.characterLimit} characters ({elevenlabsCredits.characterRemaining} remaining)
        </div>
      )}

      {channelRows.length > 0 && (
        <>
          <div className="results-section">
            <h3>Search Results ({channelRows.length})</h3>
            <VideoResultsTable
              rows={channelRows}
              selectedVideoUrls={selectedVideoUrls}
              onSelectionChange={setSelectedVideoUrls}
            />
          </div>

          <div className="action-buttons">
            <button
              onClick={handleTranscribe}
              disabled={isTranscribing || selectedVideoUrls.length === 0}
              className="btn btn-secondary"
            >
              {isTranscribing ? "Transcribing..." : "🎙️ Transcribe"}
            </button>
            <button
              onClick={handleRunAI}
              disabled={isRunningAI || selectedVideoUrls.length === 0}
              className="btn btn-secondary"
            >
              {isRunningAI ? "Running AI..." : "🤖 Run AI"}
            </button>
            <button
              onClick={handleGenerateTTS}
              disabled={isDownloading || selectedVideoUrls.length === 0}
              className="btn btn-secondary"
            >
              {isDownloading ? "Generating..." : "🔊 Generate TTS"}
            </button>
            <button
              onClick={handleDownloadVideos}
              disabled={isDownloading || selectedVideoUrls.length === 0}
              className="btn btn-secondary"
            >
              {isDownloading ? "Downloading..." : "📥 Download Videos"}
            </button>
            <button
              onClick={handleDownloadAll}
              disabled={isDownloadingAll || selectedVideoUrls.length === 0}
              className="btn btn-primary"
            >
              {isDownloadingAll ? "Processing..." : "⚡ Download All"}
            </button>
            <button
              onClick={handleOpenPromptModal}
              className="btn btn-secondary"
            >
              ✏️ Edit Prompt
            </button>
          </div>

          {transcriptStatus && <div className="status-box">{transcriptStatus}</div>}
          {runAIStatus && <div className="status-box">{runAIStatus}</div>}
          {downloadStatus && <div className="status-box">{downloadStatus}</div>}

          {transcriptRows.length > 0 && (
            <div className="results-section">
              <h3>Transcripts ({transcriptRows.length})</h3>
              <TranscriptResultsTable rows={transcriptRows} />
            </div>
          )}
        </>
      )}

      {detailLogs.length > 0 && (
        <div className="logs-section">
          <h3>Logs</h3>
          <div className="logs-box">
            {detailLogs.map((log, i) => (
              <div key={i} className="log-line">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {showPromptModal && (
        <div className="modal-overlay" onClick={() => setShowPromptModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Instagram AI Prompt</h3>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="prompt-textarea"
              rows={10}
            />
            <div className="modal-buttons">
              <button
                onClick={handleSavePrompt}
                disabled={isSavingPrompt}
                className="btn btn-primary"
              >
                {isSavingPrompt ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setShowPromptModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
