"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PlatformSearchForm, { type PlatformSearchParams } from "@/components/PlatformSearchForm";
import VideoResultsTable from "@/components/VideoResultsTable";
import TranscriptResultsTable from "@/components/TranscriptResultsTable";
import { ChannelVideoRow, TranscriptRow } from "@/types";

function isYouTubeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(url.hostname);
  } catch {
    return false;
  }
}

function toVideoMeta(row: ChannelVideoRow) {
  return {
    title: row.title,
    views: row.views,
    likes: row.likes,
    comments: row.comments || 0,
    description: row.description,
    hashtags: row.hashtags.join(", "),
    videoUrl: row.videoUrl,
    publishDate: row.publishDate || "",
  };
}

export default function YouTubePanel() {
  const [channelRows, setChannelRows] = useState<ChannelVideoRow[]>([]);
  const [selectedVideoUrls, setSelectedVideoUrls] = useState<string[]>([]);
  const [transcriptRows, setTranscriptRows] = useState<TranscriptRow[]>([]);
  const [isFetchingChannel, setIsFetchingChannel] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRunningAI, setIsRunningAI] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [detailLogs, setDetailLogs] = useState<string[]>([]);
  const [singleVideoUrl, setSingleVideoUrl] = useState("");
  const [singleVideoError, setSingleVideoError] = useState<string | null>(null);
  const [resultLabel, setResultLabel] = useState("YouTube");
  const [currentXlsFile, setCurrentXlsFile] = useState("");
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [apifyCredits, setApifyCredits] = useState<{ usedUsd: number; limitUsd: number; remainingUsd: number } | null>(null);
  const [apifyAccounts, setApifyAccounts] = useState<{ id: string; label: string; default: boolean }[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const selectedAccountIdRef = useRef("");

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
    } catch {
      // silent
    }
    return null;
  }, []);

  useEffect(() => {
    fetch("/api/apify-accounts")
      .then((response) => response.json())
      .then((data) => {
        const accounts = data.accounts || [];
        setApifyAccounts(accounts);
        const defaultAccount = accounts.find((account: { default: boolean }) => account.default);
        const accountId = defaultAccount?.id || accounts[0]?.id || "";
        if (accountId) {
          setSelectedAccountId(accountId);
          selectedAccountIdRef.current = accountId;
          fetchCredits(accountId);
        }
      })
      .catch(() => {
        fetchCredits();
      });
  }, [fetchCredits]);

  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    selectedAccountIdRef.current = accountId;
    fetchCredits(accountId);
  };

  const handleSearch = useCallback(async (params: PlatformSearchParams) => {
    setError(null);
    setStatus("Fetching YouTube data...");
    setDetailLogs([]);
    setIsFetchingChannel(true);
    setChannelRows([]);
    setSelectedVideoUrls([]);
    setTranscriptRows([]);

    const labelParts = [];
    if (params.channelUrl) labelParts.push(params.channelUrl);
    if (params.keyword) labelParts.push(`"${params.keyword}"`);
    if (params.hashtag) labelParts.push(`#${params.hashtag}`);
    setResultLabel(labelParts.join(" - ") || "YouTube Search");

    const creditsBefore = await fetchCredits();

    try {
      const res = await fetch("/api/youtube_fetch-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, accountId: selectedAccountIdRef.current }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error fetching YouTube data.");
        return;
      }

      const rows = data.rows || [];
      setChannelRows(rows);
      setSelectedVideoUrls(rows.map((row: ChannelVideoRow) => row.videoUrl));
      if (data.savedFile) setCurrentXlsFile(data.savedFile);
      setStatus(`Fetched ${rows.length} YouTube video(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error fetching YouTube data.");
    } finally {
      setIsFetchingChannel(false);
      const creditsAfter = await fetchCredits();
      if (creditsBefore != null && creditsAfter != null) {
        const spent = Math.max(0, creditsAfter - creditsBefore);
        if (spent > 0) setDetailLogs((prev) => [...prev, `Apify credits used: $${spent.toFixed(4)}`]);
      }
    }
  }, [fetchCredits]);

  const handleFetchVideos = useCallback(async (videoUrls: string[], xlsLabel: string) => {
    setError(null);
    setStatus(`Fetching ${videoUrls.length} YouTube video(s)...`);
    setDetailLogs([]);
    setIsFetchingChannel(true);
    setChannelRows([]);
    setSelectedVideoUrls([]);
    setTranscriptRows([]);
    setResultLabel(xlsLabel);

    try {
      const res = await fetch("/api/youtube_fetch-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrls, xlsLabel, accountId: selectedAccountIdRef.current }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error fetching YouTube video data.");
        return;
      }

      const rows = data.rows || [];
      setChannelRows(rows);
      setSelectedVideoUrls(rows.map((row: ChannelVideoRow) => row.videoUrl));
      if (data.savedFile) setCurrentXlsFile(data.savedFile);
      setStatus(`Fetched ${rows.length} YouTube video(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error fetching YouTube video data.");
    } finally {
      setIsFetchingChannel(false);
      fetchCredits();
    }
  }, [fetchCredits]);

  const handleSingleVideoSubmit = () => {
    setSingleVideoError(null);
    const url = singleVideoUrl.trim();
    if (!isYouTubeUrl(url)) {
      setSingleVideoError("Invalid URL. Use a YouTube video, Shorts, playlist, hashtag, or channel URL.");
      return;
    }
    handleFetchVideos([url], "youtube_single_video");
  };

  const handleBatchFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    const fileName = file.name.replace(/\.txt$/i, "") || "youtube_batch_upload";
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
      const valid = lines.filter(isYouTubeUrl);
      const invalidCount = lines.length - valid.length;

      if (valid.length === 0) {
        setSingleVideoError("No valid YouTube URLs found in the file.");
        return;
      }

      setSingleVideoError(invalidCount > 0 ? `Skipped ${invalidCount} invalid line(s).` : null);
      handleFetchVideos(valid, fileName);
    };
    reader.readAsText(file);
  };

  const getSelectedRows = useCallback(
    () => channelRows.filter((row) => selectedVideoUrls.includes(row.videoUrl)),
    [channelRows, selectedVideoUrls]
  );

  const handleTranscribe = useCallback(async (): Promise<TranscriptRow[]> => {
    const selectedRows = getSelectedRows();
    if (selectedRows.length === 0) {
      setError("Select at least one video.");
      return [];
    }

    setError(null);
    setStatus(`Transcribing ${selectedRows.length} YouTube video(s)...`);
    setIsTranscribing(true);
    setDetailLogs([]);

    try {
      const res = await fetch("/api/youtube_transcribe-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrls: selectedRows.map((row) => row.videoUrl),
          videosMeta: selectedRows.map(toVideoMeta),
          accountId: selectedAccountIdRef.current,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error transcribing YouTube videos.");
        if (data.debugLogs) setDetailLogs(data.debugLogs);
        return [];
      }

      const normalized = data.transcriptRows || [];
      setTranscriptRows(normalized);
      setDetailLogs(data.debugLogs || []);
      setStatus(`Saved ${data.savedFiles?.length || 0} transcript file(s).`);
      fetchCredits();
      return normalized;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error transcribing YouTube videos.");
      return [];
    } finally {
      setIsTranscribing(false);
    }
  }, [fetchCredits, getSelectedRows]);

  const handleRunAI = useCallback(async (transcriptsOverride?: TranscriptRow[]) => {
    const selectedRows = getSelectedRows();
    if (selectedRows.length === 0) {
      setError("Select at least one video.");
      return;
    }

    const transcripts = transcriptsOverride || transcriptRows;
    setError(null);
    setStatus("Running YouTube AI enrichment...");
    setIsRunningAI(true);

    try {
      const videos = selectedRows.map((row) => ({
        videoId: row.videoId,
        title: row.title,
        description: row.description,
        hashtags: row.hashtags.join(", "),
        transcription: transcripts.find((transcript) => transcript.videoUrl === row.videoUrl)?.transcript || "",
      }));

      const res = await fetch("/api/youtube_enrich-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videos,
          videosMeta: selectedRows.map(toVideoMeta),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "YouTube AI enrichment failed.");
        return;
      }

      setDetailLogs(data.debugLogs || []);
      setStatus(`Saved ${data.savedFiles?.length || 0} enriched file(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error running YouTube AI enrichment.");
    } finally {
      setIsRunningAI(false);
    }
  }, [getSelectedRows, transcriptRows]);

  const handleDownloadVideos = useCallback(async () => {
    const selectedRows = getSelectedRows();
    if (selectedRows.length === 0) {
      setError("Select at least one video.");
      return;
    }

    setError(null);
    setStatus(`Downloading ${selectedRows.length} YouTube video(s)...`);
    setIsDownloading(true);

    try {
      const res = await fetch("/api/download-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrls: selectedRows.map((row) => row.videoUrl),
          titles: selectedRows.map((row) => row.title),
          viewsList: selectedRows.map((row) => row.views),
          publishDates: selectedRows.map((row) => row.publishDate || ""),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error downloading YouTube videos.");
        return;
      }

      const logs = (data.results || []).map((result: { status: string; filename?: string; url: string; error?: string }) =>
        result.status === "ok" ? `Saved ${result.filename}` : `Failed ${result.url}: ${result.error}`
      );
      setDetailLogs(logs);
      setStatus(data.message || "Download completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error downloading YouTube videos.");
    } finally {
      setIsDownloading(false);
    }
  }, [getSelectedRows]);

  const handleDownloadAll = useCallback(async () => {
    const transcripts = await handleTranscribe();
    await handleRunAI(transcripts);
    await handleDownloadVideos();
  }, [handleTranscribe, handleRunAI, handleDownloadVideos]);

  const handleOpenPrompt = async () => {
    try {
      const res = await fetch("/api/youtube_enrich-metadata/prompt");
      const data = await res.json();
      setPromptText(data.prompt || "");
      setShowPromptModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load YouTube prompt.");
    }
  };

  const handleSavePrompt = async () => {
    setIsSavingPrompt(true);
    try {
      const res = await fetch("/api/youtube_enrich-metadata/prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      });
      if (!res.ok) {
        setError("Failed to save YouTube prompt.");
        return;
      }
      setShowPromptModal(false);
      setStatus("YouTube prompt saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save YouTube prompt.");
    } finally {
      setIsSavingPrompt(false);
    }
  };

  return (
    <div className="panel">
      <div className="header-row">
        <div>
          <h1>YouTube Scraper & Transcript Tool</h1>
          <p className="subtitle">Local research tool - extract data, subtitles, and videos from YouTube</p>
        </div>
        <div className="header-controls">
          <button className="btn btn-prompt" onClick={handleOpenPrompt} title="Edit AI prompt">
            Settings
          </button>
          {apifyAccounts.length > 1 && (
            <div className="header-control-item">
              <span className="header-control-label">Apify API</span>
              <select
                className="actor-selector"
                value={selectedAccountId}
                onChange={(event) => handleAccountChange(event.target.value)}
              >
                {apifyAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.label}</option>
                ))}
              </select>
            </div>
          )}
          {apifyCredits && (
            <div className="header-control-item">
              <span className="header-control-label">Credits</span>
              <div className="credits-badge">
                ${apifyCredits.remainingUsd.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      <PlatformSearchForm platform="youtube" onSubmit={handleSearch} isLoading={isFetchingChannel} />

      <div className="single-video-section">
        <div className="single-video-cols">
          <div className="single-video-row">
            <input
              type="text"
              placeholder="Paste a YouTube video, Shorts, playlist, channel, or hashtag URL"
              value={singleVideoUrl}
              onChange={(event) => { setSingleVideoUrl(event.target.value); setSingleVideoError(null); }}
              disabled={isFetchingChannel}
              onKeyDown={(event) => { if (event.key === "Enter") handleSingleVideoSubmit(); }}
            />
            <button className="btn btn-primary" onClick={handleSingleVideoSubmit} disabled={!singleVideoUrl.trim() || isFetchingChannel}>
              Load URL
            </button>
          </div>
          <div className="batch-upload-divider">or</div>
          <label className="btn btn-primary batch-upload-btn">
            Upload .txt
            <input type="file" accept=".txt" onChange={handleBatchFileUpload} hidden />
          </label>
        </div>
        {singleVideoError && <div className="single-video-error">{singleVideoError}</div>}
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="error-dismiss">x</button>
        </div>
      )}

      {(isFetchingChannel || isTranscribing || isRunningAI || isDownloading) && status && (
        <div className="loading">
          <div className="spinner" />
          {status}
        </div>
      )}

      {!isFetchingChannel && !isTranscribing && !isRunningAI && !isDownloading && status && (
        <div className="transcript-summary">{status}</div>
      )}

      {channelRows.length > 0 && (
        <div className="action-bar">
          <div className="transcript-actions">
            <button className="btn btn-transcript" onClick={() => handleTranscribe()} disabled={isTranscribing || selectedVideoUrls.length === 0}>
              {isTranscribing ? "Transcribing..." : "Download Transcript"}
            </button>
            <button className="btn btn-run-ai" onClick={() => handleRunAI()} disabled={isRunningAI || selectedVideoUrls.length === 0}>
              {isRunningAI ? "Running AI..." : "Run AI"}
            </button>
            <button className="btn btn-download" onClick={handleDownloadVideos} disabled={isDownloading || selectedVideoUrls.length === 0}>
              {isDownloading ? "Downloading..." : "Download selected videos"}
            </button>
            <button className="btn btn-download-all" onClick={handleDownloadAll} disabled={isTranscribing || isRunningAI || isDownloading || selectedVideoUrls.length === 0}>
              Download all
            </button>
          </div>
        </div>
      )}

      {detailLogs.length > 0 && (
        <div className="detail-logs">
          <div className="detail-logs-header">
            <span>Execution log ({detailLogs.length} events)</span>
            <button onClick={() => setDetailLogs([])} className="error-dismiss">x</button>
          </div>
          <div className="detail-logs-body">
            {detailLogs.map((log, index) => (
              <div key={index} className={`log-line ${log.includes("Failed") || log.includes("ERROR") ? "log-error" : log.includes("Saved") ? "log-success" : "log-info"}`}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      <VideoResultsTable
        rows={channelRows}
        selectedVideoUrls={selectedVideoUrls}
        onSelectionChange={setSelectedVideoUrls}
        label={currentXlsFile || resultLabel}
      />

      <TranscriptResultsTable rows={transcriptRows} />

      {showPromptModal && (
        <div className="modal-overlay" onClick={() => setShowPromptModal(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <span>YouTube AI Prompt</span>
              <button onClick={() => setShowPromptModal(false)} className="error-dismiss">x</button>
            </div>
            <textarea
              className="prompt-textarea"
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
              rows={16}
              placeholder="Enter the system prompt for YouTube AI enrichment..."
            />
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleSavePrompt} disabled={isSavingPrompt}>
                {isSavingPrompt ? "Saving..." : "Save"}
              </button>
              <button className="btn btn-csv" onClick={() => setShowPromptModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
