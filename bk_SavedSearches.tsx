"use client";

import { useEffect, useState } from "react";
import type { PlatformId } from "@/lib/platforms";

type SavedSearch = { filename: string; label: string };

type SavedSearchesProps = {
  platform: PlatformId;
  onLoad: (rows: Record<string, unknown>[], filename: string) => void;
};

export default function SavedSearches({ platform, onLoad }: SavedSearchesProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelected("");
    fetch(`/api/saved-searches?platform=${encodeURIComponent(platform)}`)
      .then((r) => r.json())
      .then((d) => setSearches(d.searches || []))
      .catch(() => setSearches([]));
  }, [platform]);

  const handleLoad = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/saved-searches?platform=${encodeURIComponent(platform)}&file=${encodeURIComponent(selected)}`);
      const data = await res.json();
      onLoad(data.rows || [], selected);
    } catch {
      onLoad([], "");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="saved-searches">
      <h2>Saved Searches</h2>
      <div className="saved-search-row">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="language-select"
          style={{ flex: 1 }}
          disabled={searches.length === 0}
        >
          <option value="">
            {searches.length === 0 ? "No saved searches for this platform yet" : "Select a previous search..."}
          </option>
          {searches.map((search) => (
            <option key={search.filename} value={search.filename}>
              {search.label} ({search.filename})
            </option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          onClick={handleLoad}
          disabled={!selected || loading}
        >
          {loading ? "Loading..." : "Load search"}
        </button>
      </div>
    </div>
  );
}
