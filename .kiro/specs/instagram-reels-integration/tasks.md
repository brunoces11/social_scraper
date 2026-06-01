# Implementation Plan: Instagram Reels Integration

## Overview

This implementation adds Instagram Reels support to the existing TikTok scraping application using a "duplicate with `insta_` prefix" architecture. All Instagram-specific files are new, shared platform-agnostic files remain unchanged, and zero modifications are made to existing TikTok functionality. The implementation follows a data flow: Search → Fetch → Normalize → Transcribe → Enrich → TTS → Download, with a platform switch UI allowing users to toggle between TikTok and Instagram panels.

## Tasks

### Phase 1: Backup and Configuration

- [x] 1. Create backup copies of all shared files
  - Create `bk_download-video.ts` backup of `app/api/download-video/route.ts`
  - Create `bk_generate-tts.ts` backup of `app/api/generate-tts/route.ts`
  - Create `bk_check-files.ts` backup of `app/api/check-files/route.ts`
  - Create `bk_check-transcripts.ts` backup of `app/api/check-transcripts/route.ts`
  - Create `bk_normalize.ts` backup of `lib/normalize.ts`
  - Create `bk_apify.ts` backup of `lib/apify.ts`
  - Create `bk_apify-accounts.ts` backup of `lib/apify-accounts.ts`
  - Create `bk_elevenlabs-accounts.ts` backup of `lib/elevenlabs-accounts.ts`
  - Create `bk_xls.ts` backup of `lib/xls.ts`
  - Create `bk_types.ts` backup of `types/index.ts`
  - Create `bk_VideoResultsTable.tsx` backup of `components/VideoResultsTable.tsx`
  - Create `bk_TranscriptResultsTable.tsx` backup of `components/TranscriptResultsTable.tsx`
  - Create `bk_CsvDownloadButton.tsx` backup of `components/CsvDownloadButton.tsx`
  - Create `bk_SavedSearches.tsx` backup of `components/SavedSearches.tsx`
  - Create `bk_globals.css` backup of `app/globals.css`
  - _Requirements: 12.1, 12.2_

- [x] 2. Create backup copies of files being modified
  - Create `bk_page.tsx` backup of `app/page.tsx`
  - Create `bk_apify-actors.json` backup of `apify-actors.json`
  - Create `bk_layout.tsx` backup of `app/layout.tsx`
  - _Requirements: 12.2_

- [x] 3. Add Instagram Apify actors configuration to apify-actors.json
  - Add `instaActors` section with Profile_Actor (`scrapium/instagram-reels-scraper`) configuration
  - Add Hashtag_Actor (`apify/instagram-hashtag-scraper`) configuration
  - Preserve existing `transcriptActors` section without modification
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 4. Create default Instagram AI prompt file
  - Create `insta_ai-prompt.txt` in project root with Instagram-specific enrichment prompt
  - Prompt should be tailored for Instagram Reels content optimization
  - _Requirements: 14.1_

### Phase 2: Instagram API Routes - Fetch Operations

- [x] 5. Implement Instagram fetch-channel API route
  - Create `app/api/insta_fetch-channel/route.ts`
  - Accept profile URL, hashtag, and keyword parameters
  - Validate Instagram profile URL against pattern `https://(www.)?instagram.com/{username}/`
  - Load actor configuration from `instaActors` section of `apify-actors.json`
  - Call Profile_Actor for profile URLs using `runActorAndGetResults`
  - Call Hashtag_Actor for hashtags and keywords
  - Merge results when both profile URL and hashtag are provided
  - Return 400 error if no search parameters provided
  - Return 500 error if Apify actor fails
  - Sort results by views in descending order
  - Save results to XLS file using `saveSearchToXls` utility
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 6. Implement Instagram fetch-videos API route
  - Create `app/api/insta_fetch-videos/route.ts`
  - Accept array of Instagram Reel URLs
  - Return 400 error if empty array or no URLs provided
  - Call appropriate Apify actor to fetch Reel data
  - Filter out blacklisted URLs using `getBlacklist` utility
  - Sort results by views in descending order
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

### Phase 3: Instagram Normalization

- [x] 7. Implement Instagram field normalizer
  - Create `lib/insta_normalize.ts`
  - Implement `normalizeInstagramChannelVideos` function for Profile_Actor responses
  - Map `reel_id` → `videoId`, `caption_text` → `title` and `description`, `play_count` → `views`, `like_count` → `likes`, `comment_count` → `comments`, `hashtags` → `hashtags`, `reel_url` → `videoUrl`, `taken_at_iso` → `publishDate`
  - Implement `normalizeInstagramHashtagVideos` function for Hashtag_Actor responses
  - Map `id` → `videoId`, `caption` → `description`, `likesCount` → `likes`, `commentsCount` → `comments`, `videoPlayCount` → `views`, `timestamp` → `publishDate`, `hashtags` → `hashtags`, `url` → `videoUrl`
  - Use safe defaults for missing fields (empty string for strings, 0 for numbers, empty array for arrays)
  - Truncate `title` field to 80 characters
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

### Phase 4: Instagram Transcription

- [x] 8. Implement Instagram transcribe-videos API route
  - Create `app/api/insta_transcribe-videos/route.ts`
  - Accept array of Reel URLs and video metadata
  - Download each Reel audio using yt-dlp
  - Send audio to OpenAI Whisper API using `OPENAI_API_KEY` environment variable
  - Extract Reel shortcode from URLs using regex `/\/reel\/([A-Za-z0-9_-]+)/`
  - Save transcriptions as `.txt` files in `downloads/` directory
  - Use file naming convention: `{tier}_{views}-{MMMaa}-{sanitized_title}.txt`
  - Include metadata fields in saved files: Title, Description, Hashtags, Transcription, Views, Likes, Link, Date
  - If yt-dlp fails, save `.txt` file with `ERRO:` prefix in Transcription field and continue
  - If Whisper API fails, save `.txt` file with `ERRO:` prefix in Transcription field and continue
  - Return summary with counts of saved files, errors, and Reels without transcription
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

### Phase 5: Instagram AI Enrichment

- [x] 9. Implement Instagram enrich-metadata API route
  - Create `app/api/insta_enrich-metadata/route.ts`
  - Accept array of Reel metadata with transcriptions
  - Read system prompt from `insta_ai-prompt.txt`, fall back to default if missing
  - Send data to OpenAI GPT-4o-mini for enrichment
  - Process Reels in batches of 10 to avoid API timeouts
  - Retry once if batch fails, continue to next batch if retry also fails
  - Save enriched `.txt` files with `LLM_` prefixed fields
  - Use same file naming convention and content format as TikTok enricher
  - Include `LLM_Title`, `LLM_Description`, `LLM_Hashtags`, `LLM_Transcription` fields followed by original metadata
  - Return list of enriched video objects (`llmVideos`) for TTS generation
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 10. Implement Instagram prompt management API route
  - Create `app/api/insta_enrich-metadata/prompt/route.ts`
  - Implement GET endpoint to return contents of `insta_ai-prompt.txt` or default prompt
  - Implement PUT endpoint to write prompt to `insta_ai-prompt.txt`
  - Operate independently from TikTok prompt file (`ai-prompt.txt`)
  - _Requirements: 7.1, 7.2, 7.3_

### Phase 6: Instagram UI Components

- [x] 11. Implement Instagram search form component
  - Create `components/insta_ChannelForm.tsx`
  - Provide input fields for Instagram profile URL, keyword, hashtag, max results, country/region selection
  - Validate profile URL against pattern `https://(www.)?instagram.com/{username}/`
  - Enable search button only when at least one search parameter is provided
  - Disable all input fields and search button while search is in progress
  - Display selected country/region with flag emoji, consistent with TikTok ChannelForm
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 12. Implement Instagram panel component
  - Create `components/insta_Panel.tsx`
  - Display search results in VideoResultsTable component with selection checkboxes
  - Provide action buttons: Transcribe, Run AI (enrich), Generate TTS, Download Videos, Download All
  - Implement Transcribe button to call Insta_Transcribe_API with selected Reel URLs and metadata
  - Implement Run AI button to call Insta_Enrich_API with selected Reel metadata and transcriptions
  - Implement Download All button to execute full pipeline sequentially: check files → transcribe → enrich → TTS → download, skipping existing files
  - Display Apify credit usage, ElevenLabs/Mistral credit usage, and detailed operation logs
  - Manage independent state: channelRows, selectedVideoUrls, transcriptRows, loading flags, error messages
  - Implement Download Videos button to call shared `/api/download-video` endpoint
  - Implement Generate TTS button to call shared `/api/generate-tts` endpoint
  - Provide prompt editor button to open modal for viewing/editing Instagram AI prompt via Insta_Prompt_API
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

### Phase 7: Platform Switch and Layout Updates

- [x] 13. Implement platform switch UI and integrate panels
  - Modify `app/page.tsx` to add Platform_Switch toggle at top of page
  - Display toggle with two options: "TikTok" and "Instagram"
  - When "TikTok" selected, render TikTok panel and hide Instagram panel
  - When "Instagram" selected, render Insta_Panel and hide TikTok panel
  - Default to "TikTok" on initial page load
  - Preserve state of hidden panel when switching platforms
  - Extract existing TikTok logic from `page.tsx` into separate component if needed
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 14. Update page layout and metadata
  - Modify `app/layout.tsx` to update page title to include both platforms (e.g., "TikTok & Instagram Scraper & Transcript Tool")
  - Update page description metadata to reference both TikTok and Instagram
  - _Requirements: 11.1, 11.2_

### Phase 8: Testing and Verification

- [x] 15. Verify Instagram fetch-channel functionality
  - Test fetching Reels by Instagram profile URL
  - Test fetching Reels by hashtag
  - Test fetching Reels by keyword
  - Test merging results when both profile URL and hashtag provided
  - Test error handling for invalid profile URLs
  - Test error handling for missing search parameters
  - Test XLS file generation for search results
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 16. Verify Instagram fetch-videos functionality
  - Test fetching Reels by direct URLs
  - Test blacklist filtering
  - Test error handling for empty URL arrays
  - Test sorting by views in descending order
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 17. Verify Instagram normalization
  - Test Profile_Actor response normalization
  - Test Hashtag_Actor response normalization
  - Test safe defaults for missing fields
  - Test title truncation to 80 characters
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 18. Verify Instagram transcription functionality
  - Test audio download via yt-dlp
  - Test Whisper API transcription
  - Test file naming convention
  - Test metadata field inclusion in saved files
  - Test error handling for failed downloads
  - Test error handling for failed transcriptions
  - Test summary reporting
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 19. Verify Instagram enrichment functionality
  - Test GPT-4o-mini enrichment with custom prompt
  - Test batch processing (10 Reels per batch)
  - Test retry logic for failed batches
  - Test enriched file generation with `LLM_` prefixed fields
  - Test prompt file reading and fallback to default
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 20. Verify Instagram prompt management
  - Test GET endpoint returns `insta_ai-prompt.txt` contents
  - Test GET endpoint returns default prompt if file missing
  - Test PUT endpoint writes to `insta_ai-prompt.txt`
  - Test independence from TikTok prompt file
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 21. Verify Instagram UI components
  - Test Instagram search form validation
  - Test search button enable/disable logic
  - Test input field disable during search
  - Test country/region flag display
  - Test Instagram panel rendering
  - Test action button functionality
  - Test state management independence from TikTok panel
  - Test prompt editor modal
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

- [x] 22. Verify platform switch functionality
  - Test toggle between TikTok and Instagram panels
  - Test default to TikTok on initial load
  - Test state preservation when switching platforms
  - Test both panels render correctly
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 23. Verify layout and metadata updates
  - Test page title includes both platforms
  - Test page description includes both platforms
  - _Requirements: 11.1, 11.2_

- [x] 24. Verify zero impact on TikTok functionality
  - Test existing TikTok fetch-channel API still works
  - Test existing TikTok fetch-videos API still works
  - Test existing TikTok transcribe-videos API still works
  - Test existing TikTok enrich-metadata API still works
  - Test TikTok panel renders and functions correctly
  - Test all shared utilities work for both platforms
  - Test all shared components work for both platforms
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 25. Final checkpoint - Ensure all tests pass and integration complete
  - Ensure all API routes respond correctly
  - Ensure all UI components render without errors
  - Ensure platform switch works smoothly
  - Ensure TikTok functionality remains unchanged
  - Ensure Instagram pipeline works end-to-end
  - Ask the user if questions arise

## Notes

- All Instagram-specific files use `insta_` prefix to avoid conflicts with TikTok files
- Shared files (download-video, generate-tts, check-files, check-transcripts, normalize, apify, etc.) are used by both platforms without modification
- Backup files with `bk_` prefix are created for safety and can be used to restore original TikTok-only behavior
- The platform switch UI allows users to toggle between independent TikTok and Instagram panels
- Each panel maintains its own state and does not affect the other
- All Instagram API routes follow the same patterns as TikTok routes for consistency
- The implementation preserves 100% of existing TikTok functionality
