"use client";

import { useState } from "react";
import type { PlatformId } from "@/lib/platforms";
import { COUNTRIES } from "@/components/searchCountries";

export type PlatformSearchParams = {
  channelUrl?: string;
  profileUrl?: string;
  keyword: string;
  hashtag: string;
  maxVideos: number;
  countryCode: string;
  monthsBack?: number;
};

type PlatformSearchFormProps = {
  platform: Extract<PlatformId, "tiktok" | "instagram" | "youtube">;
  onSubmit: (params: PlatformSearchParams) => void;
  isLoading: boolean;
};

type PlatformFormConfig = {
  urlField: "channelUrl" | "profileUrl";
  urlInputId: string;
  urlLabel: string;
  urlPlaceholder: string;
  keywordPlaceholder: string;
  hashtagPlaceholder: string;
  invalidUrlMessage?: string;
  validateUrl?: (value: string) => boolean;
};

const PLATFORM_FORM_CONFIGS: Record<PlatformSearchFormProps["platform"], PlatformFormConfig> = {
  tiktok: {
    urlField: "channelUrl",
    urlInputId: "channel-url",
    urlLabel: "Channel URL",
    urlPlaceholder: "https://www.tiktok.com/@usuario",
    keywordPlaceholder: "e.g. artificial intelligence",
    hashtagPlaceholder: "e.g. ai, technology",
  },
  instagram: {
    urlField: "profileUrl",
    urlInputId: "profile-url",
    urlLabel: "Profile URL",
    urlPlaceholder: "https://www.instagram.com/username/",
    keywordPlaceholder: "e.g. travel, fitness",
    hashtagPlaceholder: "e.g. travel, fitness",
    invalidUrlMessage: "Invalid Instagram profile URL",
    validateUrl: (value) => {
      if (!value.trim()) return true;
      return /^https:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._-]+\/?$/.test(value.trim());
    },
  },
  youtube: {
    urlField: "channelUrl",
    urlInputId: "channel-url",
    urlLabel: "Channel URL",
    urlPlaceholder: "https://www.youtube.com/@channel",
    keywordPlaceholder: "e.g. documentaries",
    hashtagPlaceholder: "e.g. education, science",
  },
};

export default function PlatformSearchForm({ platform, onSubmit, isLoading }: PlatformSearchFormProps) {
  const config = PLATFORM_FORM_CONFIGS[platform];
  const [url, setUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [hashtag, setHashtag] = useState("");
  const [maxVideos, setMaxVideos] = useState(50);
  const [monthsBack, setMonthsBack] = useState("");
  const [countryCode, setCountryCode] = useState("BR");

  const hasAnyInput = url.trim() || keyword.trim() || hashtag.trim();
  const isUrlValid = config.validateUrl ? config.validateUrl(url) : true;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAnyInput || !isUrlValid) return;
    onSubmit({
      [config.urlField]: url.trim(),
      keyword: keyword.trim(),
      hashtag: hashtag.trim(),
      maxVideos,
      countryCode,
      ...(platform === "youtube" && Number(monthsBack) > 0 ? { monthsBack: Number(monthsBack) } : {}),
    });
  };

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode);

  return (
    <form onSubmit={handleSubmit} className="channel-form">
      <div className="form-row">
        <div className="form-group form-group-country">
          <label htmlFor="country">Region</label>
          <select
            id="country"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            disabled={isLoading}
            className="country-select"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group form-group-url">
          <label htmlFor={config.urlInputId}>{config.urlLabel}</label>
          <input
            id={config.urlInputId}
            type="text"
            placeholder={config.urlPlaceholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
          />
          {url && !isUrlValid && config.invalidUrlMessage && (
            <div className="form-error">{config.invalidUrlMessage}</div>
          )}
        </div>
        <div className="form-group form-group-keyword">
          <label htmlFor="keyword">Keyword</label>
          <input
            id="keyword"
            type="text"
            placeholder={config.keywordPlaceholder}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="form-group form-group-hashtag">
          <label htmlFor="hashtag">Hashtag</label>
          <input
            id="hashtag"
            type="text"
            placeholder={config.hashtagPlaceholder}
            value={hashtag}
            onChange={(e) => setHashtag(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="form-group form-group-max">
          <label htmlFor="max-videos">Max</label>
          <input
            id="max-videos"
            type="number"
            min={1}
            max={1000}
            value={maxVideos}
            onChange={(e) => setMaxVideos(Number(e.target.value) || 50)}
            disabled={isLoading}
          />
        </div>
        {platform === "youtube" && (
          <div className="form-group form-group-months">
            <label htmlFor="months-back">Months</label>
            <input
              id="months-back"
              type="number"
              min={1}
              max={120}
              placeholder="12"
              value={monthsBack}
              onChange={(e) => setMonthsBack(e.target.value)}
              disabled={isLoading}
            />
          </div>
        )}
        <div className="form-group form-group-btn">
          <button type="submit" disabled={isLoading || !hasAnyInput || !isUrlValid} className="btn btn-primary">
            {isLoading ? "Searching..." : "🔍 Search"}
          </button>
        </div>
      </div>
      {selectedCountry && (
        <div className="form-hint">
          {selectedCountry.flag} Searching content from region: {selectedCountry.name}
        </div>
      )}
    </form>
  );
}
