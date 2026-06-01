# Requirements Document

## Introduction

This feature extends the existing TikTok scraping application to support Instagram Reels with the same full pipeline: search/fetch → transcribe → AI enrich → TTS → download. The integration follows a "duplicate with `insta_` prefix" architecture — all Instagram-specific files are new, while shared platform-agnostic files (download-video, generate-tts, check-files, etc.) remain unchanged. Zero modifications to existing TikTok functionality are permitted. A platform switch in the UI allows toggling between TikTok and Instagram panels, each fully independent with its own state.

## Glossary

- **App**: The Next.js web application that serves the UI and API routes
- **Insta_Fetch_Channel_API**: The API route at `/api/insta_fetch-channel` that fetches Instagram Reels by profile URL, hashtag, or keyword using Apify actors
- **Insta_Fetch_Videos_API**: The API route at `/api/insta_fetch-videos` that fetches Instagram Reels by direct Reel URLs using Apify actors
- **Insta_Transcribe_API**: The API route at `/api/insta_transcribe-videos` that downloads Reel audio via yt-dlp and transcribes it using the OpenAI Whisper API
- **Insta_Enrich_API**: The API route at `/api/insta_enrich-metadata` that sends Reel metadata and transcriptions to OpenAI GPT-4o-mini for enrichment
- **Insta_Prompt_API**: The API route at `/api/insta_enrich-metadata/prompt` that reads and writes the Instagram-specific AI prompt file (`insta_ai-prompt.txt`)
- **Insta_Normalizer**: The module at `lib/insta_normalize.ts` that maps Instagram Apify actor response fields to the shared `ChannelVideoRow` type
- **Insta_ChannelForm**: The React component at `components/insta_ChannelForm.tsx` that provides the Instagram search form with URL validation
- **Insta_Panel**: The React component at `components/insta_Panel.tsx` that contains the full Instagram workflow UI (search, select, transcribe, enrich, TTS, download)
- **Platform_Switch**: The UI toggle at the top of the main page that switches between TikTok and Instagram panels
- **ChannelVideoRow**: The shared TypeScript type representing a normalized video/reel row with fields: videoId, title, description, views, likes, hashtags, videoUrl, comments, publishDate
- **Apify_Actor**: A third-party scraping service on the Apify platform that extracts data from Instagram
- **Profile_Actor**: The Apify actor `scrapium/instagram-reels-scraper` used to scrape Reels from an Instagram profile
- **Hashtag_Actor**: The Apify actor `apify/instagram-hashtag-scraper` used to scrape Reels by hashtag or keyword
- **Whisper_API**: The OpenAI audio transcription endpoint at `https://api.openai.com/v1/audio/transcriptions`
- **Reel_Shortcode**: The alphanumeric identifier in an Instagram Reel URL (e.g., `DO8cvGViIPu` in `https://www.instagram.com/reel/DO8cvGViIPu/`)
- **Reel_URL_Pattern**: The regex `/\/reel\/([A-Za-z0-9_-]+)/` used to extract Reel shortcodes from Instagram URLs
- **Insta_Actors_Config**: The `instaActors` section in `apify-actors.json` that defines Instagram-specific Apify actor configurations

## Requirements

### Requirement 1: Apify Actors Configuration for Instagram

**User Story:** As a developer, I want Instagram Apify actor configurations stored in `apify-actors.json`, so that the application can dynamically select the correct scraper for Instagram operations.

#### Acceptance Criteria

1. THE App SHALL contain an `instaActors` section in `apify-actors.json` with at least two actor entries: one for profile scraping (Profile_Actor) and one for hashtag/keyword scraping (Hashtag_Actor)
2. WHEN the Insta_Fetch_Channel_API loads actor configuration, THE Insta_Fetch_Channel_API SHALL read from the `instaActors` section of `apify-actors.json`
3. THE App SHALL preserve the existing `transcriptActors` section in `apify-actors.json` without modification

### Requirement 2: Fetch Instagram Reels by Channel/Hashtag/Keyword

**User Story:** As a user, I want to search for Instagram Reels by profile URL, hashtag, or keyword, so that I can discover content to process.

#### Acceptance Criteria

1. WHEN a valid Instagram profile URL is provided, THE Insta_Fetch_Channel_API SHALL call the Profile_Actor with the profile URL and return normalized results as ChannelVideoRow arrays
2. WHEN a hashtag is provided, THE Insta_Fetch_Channel_API SHALL call the Hashtag_Actor with the hashtag and return normalized results as ChannelVideoRow arrays
3. WHEN a keyword is provided, THE Insta_Fetch_Channel_API SHALL call the Hashtag_Actor with the keyword and return normalized results as ChannelVideoRow arrays
4. WHEN both a profile URL and a hashtag are provided, THE Insta_Fetch_Channel_API SHALL execute both actor calls and merge the results into a single ChannelVideoRow array
5. IF no search parameter (profile URL, hashtag, or keyword) is provided, THEN THE Insta_Fetch_Channel_API SHALL return a 400 error with a descriptive message
6. IF the Apify actor run fails, THEN THE Insta_Fetch_Channel_API SHALL return a 500 error with the actor error message
7. WHEN results are returned, THE Insta_Fetch_Channel_API SHALL sort the ChannelVideoRow array by views in descending order
8. WHEN results are returned, THE Insta_Fetch_Channel_API SHALL save the results to an XLS file using the existing `saveSearchToXls` utility

### Requirement 3: Fetch Instagram Reels by Direct URLs

**User Story:** As a user, I want to fetch Reel data by pasting direct Instagram Reel URLs, so that I can process specific Reels I already know about.

#### Acceptance Criteria

1. WHEN an array of Instagram Reel URLs is provided, THE Insta_Fetch_Videos_API SHALL call the appropriate Apify actor and return normalized results as ChannelVideoRow arrays
2. IF an empty array or no URLs are provided, THEN THE Insta_Fetch_Videos_API SHALL return a 400 error with a descriptive message
3. WHEN results are returned, THE Insta_Fetch_Videos_API SHALL filter out blacklisted URLs using the existing `getBlacklist` utility
4. WHEN results are returned, THE Insta_Fetch_Videos_API SHALL sort the ChannelVideoRow array by views in descending order

### Requirement 4: Instagram Field Normalization

**User Story:** As a developer, I want Instagram API responses normalized to the shared ChannelVideoRow type, so that all downstream components (tables, transcription, enrichment) work without modification.

#### Acceptance Criteria

1. WHEN the Profile_Actor returns results, THE Insta_Normalizer SHALL map `reel_id` to `videoId`, `caption_text` to `title` and `description`, `play_count` to `views`, `like_count` to `likes`, `comment_count` to `comments`, `hashtags` to `hashtags`, `reel_url` to `videoUrl`, `taken_at_iso` to `publishDate`, and `author_username` to the author portion of the constructed videoUrl
2. WHEN the Hashtag_Actor returns results, THE Insta_Normalizer SHALL map `id` to `videoId`, `caption` to `description`, `likesCount` to `likes`, `commentsCount` to `comments`, `videoPlayCount` to `views`, `timestamp` to `publishDate`, `hashtags` to `hashtags`, `url` to `videoUrl`, and `ownerUsername` to the author portion of the constructed videoUrl
3. WHEN a field is missing or null in the actor response, THE Insta_Normalizer SHALL use a safe default: empty string for string fields, zero for numeric fields, and empty array for array fields
4. THE Insta_Normalizer SHALL truncate the `title` field to 80 characters, consistent with the existing TikTok normalizer behavior

### Requirement 5: Transcribe Instagram Reels via OpenAI Whisper

**User Story:** As a user, I want to transcribe Instagram Reels audio to text, so that I can use the transcriptions for AI enrichment and TTS generation.

#### Acceptance Criteria

1. WHEN an array of Reel URLs and video metadata are provided, THE Insta_Transcribe_API SHALL download each Reel audio using yt-dlp, send the audio to the Whisper_API, and save the transcription as a `.txt` file in the `downloads/` directory
2. THE Insta_Transcribe_API SHALL use the existing `OPENAI_API_KEY` environment variable to authenticate with the Whisper_API
3. WHEN a transcription is saved, THE Insta_Transcribe_API SHALL use the same file naming convention as the TikTok transcriber: `{tier}_{views}-{MMMaa}-{sanitized_title}.txt`
4. THE Insta_Transcribe_API SHALL extract the Reel_Shortcode from Instagram URLs using the Reel_URL_Pattern regex `/\/reel\/([A-Za-z0-9_-]+)/` for video ID matching
5. WHEN the `.txt` file is saved, THE Insta_Transcribe_API SHALL include metadata fields (Title, Description, Hashtags, Transcription, Views, Likes, Link, Date) in the same format as the TikTok transcriber
6. IF yt-dlp fails to download a Reel, THEN THE Insta_Transcribe_API SHALL save a `.txt` file with `ERRO:` prefix in the Transcription field and continue processing remaining Reels
7. IF the Whisper_API returns an error, THEN THE Insta_Transcribe_API SHALL save a `.txt` file with `ERRO:` prefix in the Transcription field and continue processing remaining Reels
8. WHEN all Reels are processed, THE Insta_Transcribe_API SHALL return a summary with counts of saved files, errors, and Reels without transcription

### Requirement 6: AI Enrichment for Instagram Reels

**User Story:** As a user, I want to enrich Instagram Reel metadata with AI-generated titles, descriptions, hashtags, and transcriptions, so that the content is optimized for reposting.

#### Acceptance Criteria

1. WHEN an array of Reel metadata with transcriptions is provided, THE Insta_Enrich_API SHALL send the data to OpenAI GPT-4o-mini and save enriched `.txt` files with `LLM_` prefixed fields
2. THE Insta_Enrich_API SHALL read the system prompt from `insta_ai-prompt.txt` if the file exists, and fall back to a default Instagram-specific prompt otherwise
3. THE Insta_Enrich_API SHALL process Reels in batches of 10 to avoid OpenAI API timeouts
4. IF the OpenAI API call fails for a batch, THEN THE Insta_Enrich_API SHALL retry once and continue to the next batch if the retry also fails
5. WHEN an enriched `.txt` file is saved, THE Insta_Enrich_API SHALL use the same file naming convention and content format as the TikTok enricher, with `LLM_Title`, `LLM_Description`, `LLM_Hashtags`, and `LLM_Transcription` fields followed by original metadata
6. THE Insta_Enrich_API SHALL return the list of enriched video objects (`llmVideos`) so the UI can proceed with TTS generation

### Requirement 7: Instagram AI Prompt Management

**User Story:** As a user, I want to view and edit the AI prompt used for Instagram Reel enrichment, so that I can customize the AI output for Instagram-specific content.

#### Acceptance Criteria

1. WHEN a GET request is made, THE Insta_Prompt_API SHALL return the contents of `insta_ai-prompt.txt` if the file exists, or a default Instagram-specific prompt otherwise
2. WHEN a PUT request is made with a prompt string, THE Insta_Prompt_API SHALL write the prompt to `insta_ai-prompt.txt`
3. THE Insta_Prompt_API SHALL operate independently from the TikTok prompt file (`ai-prompt.txt`)

### Requirement 8: Instagram Search Form with URL Validation

**User Story:** As a user, I want a search form tailored for Instagram that validates Instagram URLs, so that I can search for Reels without entering invalid data.

#### Acceptance Criteria

1. THE Insta_ChannelForm SHALL provide input fields for Instagram profile URL, keyword, hashtag, max results, and country/region selection
2. WHEN a profile URL is entered, THE Insta_ChannelForm SHALL validate it against the pattern `https://(www.)?instagram.com/{username}/`
3. THE Insta_ChannelForm SHALL enable the search button only when at least one search parameter (profile URL, keyword, or hashtag) is provided
4. WHILE a search is in progress, THE Insta_ChannelForm SHALL disable all input fields and the search button
5. THE Insta_ChannelForm SHALL display the selected country/region with its flag emoji, consistent with the TikTok ChannelForm

### Requirement 9: Instagram Panel with Full Pipeline

**User Story:** As a user, I want a dedicated Instagram panel that provides the complete workflow (search, select, transcribe, enrich, TTS, download), so that I can process Instagram Reels end-to-end.

#### Acceptance Criteria

1. THE Insta_Panel SHALL display search results in the existing VideoResultsTable component with selection checkboxes
2. THE Insta_Panel SHALL provide action buttons for: Transcribe, Run AI (enrich), Generate TTS, Download Videos, and Download All (full pipeline)
3. WHEN the "Transcribe" button is clicked, THE Insta_Panel SHALL call the Insta_Transcribe_API with the selected Reel URLs and metadata
4. WHEN the "Run AI" button is clicked, THE Insta_Panel SHALL call the Insta_Enrich_API with the selected Reel metadata and transcriptions
5. WHEN the "Download All" button is clicked, THE Insta_Panel SHALL execute the full pipeline sequentially: check existing files → transcribe missing → enrich → generate TTS → download videos, skipping steps where files already exist on disk
6. THE Insta_Panel SHALL display Apify credit usage, ElevenLabs/Mistral credit usage, and detailed operation logs, consistent with the TikTok panel
7. THE Insta_Panel SHALL manage its own independent state (channelRows, selectedVideoUrls, transcriptRows, loading flags, error messages) separate from the TikTok panel
8. WHEN the "Download Videos" button is clicked, THE Insta_Panel SHALL call the existing shared `/api/download-video` endpoint with the selected Reel URLs
9. WHEN the "Generate TTS" button is clicked, THE Insta_Panel SHALL call the existing shared `/api/generate-tts` endpoint with the enriched transcription text
10. THE Insta_Panel SHALL provide a prompt editor button that opens a modal to view and edit the Instagram AI prompt via the Insta_Prompt_API

### Requirement 10: Platform Switch UI

**User Story:** As a user, I want a toggle at the top of the page to switch between TikTok and Instagram, so that I can use either platform without navigating to a different page.

#### Acceptance Criteria

1. THE App SHALL display a Platform_Switch toggle at the top of the main page with two options: "TikTok" and "Instagram"
2. WHEN the user selects "TikTok", THE App SHALL render the TikTok panel (extracted from the current `page.tsx` logic) and hide the Instagram panel
3. WHEN the user selects "Instagram", THE App SHALL render the Insta_Panel and hide the TikTok panel
4. THE Platform_Switch SHALL default to "TikTok" on initial page load
5. WHEN the user switches platforms, THE App SHALL preserve the state of the hidden panel so that switching back restores the previous state

### Requirement 11: Layout and Metadata Update

**User Story:** As a user, I want the page title to reflect that the app supports both TikTok and Instagram, so that the browser tab accurately describes the application.

#### Acceptance Criteria

1. THE App SHALL update the page title in `app/layout.tsx` to include both "TikTok" and "Instagram" (e.g., "TikTok & Instagram Scraper & Transcript Tool")
2. THE App SHALL update the page description metadata to reference both platforms

### Requirement 12: Backup Safety Copies

**User Story:** As a developer, I want backup copies of all shared and modified files before any changes, so that I can restore the original TikTok-only behavior if needed.

#### Acceptance Criteria

1. WHEN the implementation begins, THE App SHALL create `bk_` prefixed copies of all shared files that the Instagram pipeline depends on (download-video, generate-tts, check-files, check-transcripts, normalize, apify, apify-accounts, elevenlabs-accounts, xls, types, VideoResultsTable, TranscriptResultsTable, CsvDownloadButton, SavedSearches, globals.css)
2. WHEN the implementation begins, THE App SHALL create `bk_` prefixed copies of the three files being modified (page.tsx, apify-actors.json, layout.tsx)
3. THE App SHALL place backup files in the same directory as their originals with the `bk_` prefix added to the filename

### Requirement 13: Zero Impact on Existing TikTok Functionality

**User Story:** As a user, I want the existing TikTok pipeline to continue working exactly as before, so that adding Instagram support does not break my current workflow.

#### Acceptance Criteria

1. THE App SHALL make zero modifications to any existing TikTok-specific API route files (fetch-channel, fetch-videos, transcribe-videos, enrich-metadata)
2. THE App SHALL make zero modifications to any shared utility files (lib/apify.ts, lib/apify-accounts.ts, lib/elevenlabs-accounts.ts, lib/normalize.ts, lib/xls.ts, types/index.ts)
3. THE App SHALL make zero modifications to any shared component files (VideoResultsTable, TranscriptResultsTable, CsvDownloadButton, SavedSearches)
4. THE App SHALL make zero modifications to the shared API routes (download-video, generate-tts, check-files, check-transcripts, apify-accounts, apify-credits, elevenlabs-accounts, elevenlabs-credits, elevenlabs-voices, saved-searches, apify-actors)
5. WHEN the TikTok panel is active, THE App SHALL call the same API endpoints and use the same logic as the current implementation

### Requirement 14: Instagram-Specific AI Prompt File

**User Story:** As a user, I want a dedicated AI prompt file for Instagram Reels, so that I can customize the AI enrichment independently from TikTok.

#### Acceptance Criteria

1. THE App SHALL create an `insta_ai-prompt.txt` file in the project root with a default prompt tailored for Instagram Reels content optimization
2. THE Insta_Enrich_API SHALL read from `insta_ai-prompt.txt` instead of `ai-prompt.txt`
3. THE Insta_Prompt_API SHALL read from and write to `insta_ai-prompt.txt` instead of `ai-prompt.txt`
