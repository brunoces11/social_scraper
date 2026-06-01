#!/usr/bin/env node

/**
 * Test script to verify Apify Instagram actors connectivity
 * Tests both Profile_Actor and Hashtag_Actor
 */

const BASE_URL = "https://api.apify.com/v2";
const POLL_INTERVAL_MS = 5000;
const MAX_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// Your Apify token (from .env.local)
const APIFY_TOKEN = "apify_api_ddYrXwWmDCU1AFVkm79DaaDHu34Lz72VfCNu";

// Instagram actors to test
const ACTORS = {
  profile: {
    id: "scrapium/instagram-reels-scraper",
    name: "Profile_Actor",
    testInput: {
      profileUrl: "https://www.instagram.com/instagram/",
      resultsPerPage: 5,
      proxyCountryCode: "BR"
    }
  },
  hashtag: {
    id: "apify/instagram-hashtag-scraper",
    name: "Hashtag_Actor",
    testInput: {
      hashtag: "travel",
      resultsPerPage: 5,
      proxyCountryCode: "BR"
    }
  }
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testActor(actorKey, actor) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${actor.name} (${actor.id})`);
  console.log("=".repeat(60));

  try {
    // Convert actor ID format: scrapium/instagram-reels-scraper -> scrapium~instagram-reels-scraper
    const actorIdForUrl = actor.id.replace("/", "~");
    const runUrl = `${BASE_URL}/acts/${actorIdForUrl}/runs?token=${APIFY_TOKEN}&waitForFinish=120`;

    console.log(`\n1️⃣  Starting actor run...`);
    console.log(`   URL: ${runUrl}`);
    console.log(`   Input: ${JSON.stringify(actor.testInput, null, 2)}`);

    const runResponse = await fetch(runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actor.testInput),
    });

    if (!runResponse.ok) {
      const text = await runResponse.text();
      throw new Error(`Failed to start actor (${runResponse.status}): ${text}`);
    }

    let runData = await runResponse.json();
    const runId = runData.data?.id;

    if (!runId) {
      throw new Error("No run ID returned from Apify");
    }

    console.log(`   ✅ Run started: ${runId}`);
    console.log(`   Status: ${runData.data?.status}`);

    // Poll until finished
    console.log(`\n2️⃣  Polling for completion...`);
    const startTime = Date.now();
    let pollCount = 0;

    while (runData.data?.status === "RUNNING" || runData.data?.status === "READY") {
      if (Date.now() - startTime > MAX_TIMEOUT_MS) {
        throw new Error("TIMEOUT: Actor did not finish within 2 minutes");
      }

      pollCount++;
      await sleep(POLL_INTERVAL_MS);

      const pollUrl = `${BASE_URL}/acts/${actorIdForUrl}/runs/${runId}?token=${APIFY_TOKEN}`;
      const pollResponse = await fetch(pollUrl);

      if (!pollResponse.ok) {
        throw new Error(`Polling failed (${pollResponse.status})`);
      }

      runData = await pollResponse.json();
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`   Poll #${pollCount} (${elapsed}s): ${runData.data?.status}`);
    }

    const finalStatus = runData.data?.status;
    console.log(`   ✅ Final status: ${finalStatus}`);

    if (finalStatus !== "SUCCEEDED") {
      const statusMessage = runData.data?.statusMessage || "";
      const exitCode = runData.data?.exitCode;
      throw new Error(`Actor failed: ${finalStatus} — ${statusMessage} (exit: ${exitCode})`);
    }

    // Fetch results
    console.log(`\n3️⃣  Fetching results...`);
    const datasetId = runData.data?.defaultDatasetId;

    if (!datasetId) {
      throw new Error("No dataset ID returned");
    }

    const datasetUrl = `${BASE_URL}/datasets/${datasetId}/items?token=${APIFY_TOKEN}`;
    const datasetResponse = await fetch(datasetUrl);

    if (!datasetResponse.ok) {
      throw new Error(`Dataset fetch failed (${datasetResponse.status})`);
    }

    const items = await datasetResponse.json();
    console.log(`   ✅ Retrieved ${items.length} items`);

    if (items.length > 0) {
      console.log(`\n4️⃣  Sample data (first item):`);
      const firstItem = items[0];
      console.log(`   Keys: ${Object.keys(firstItem).join(", ")}`);
      console.log(`   Sample: ${JSON.stringify(firstItem, null, 2).substring(0, 300)}...`);
    }

    console.log(`\n✅ ${actor.name} TEST PASSED`);
    return { success: true, itemsCount: items.length };

  } catch (error) {
    console.log(`\n❌ ${actor.name} TEST FAILED`);
    console.log(`   Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log(`\n${"#".repeat(60)}`);
  console.log(`# Apify Instagram Actors Connectivity Test`);
  console.log("#".repeat(60));
  console.log(`\nToken: ${APIFY_TOKEN.substring(0, 20)}...`);
  console.log(`Base URL: ${BASE_URL}`);

  const results = {};

  // Test Profile Actor
  results.profile = await testActor("profile", ACTORS.profile);

  // Test Hashtag Actor
  results.hashtag = await testActor("hashtag", ACTORS.hashtag);

  // Summary
  console.log(`\n${"#".repeat(60)}`);
  console.log(`# Test Summary`);
  console.log("#".repeat(60));
  console.log(`\nProfile_Actor: ${results.profile.success ? "✅ PASS" : "❌ FAIL"}`);
  if (results.profile.success) {
    console.log(`  → Retrieved ${results.profile.itemsCount} items`);
  } else {
    console.log(`  → Error: ${results.profile.error}`);
  }

  console.log(`\nHashtag_Actor: ${results.hashtag.success ? "✅ PASS" : "❌ FAIL"}`);
  if (results.hashtag.success) {
    console.log(`  → Retrieved ${results.hashtag.itemsCount} items`);
  } else {
    console.log(`  → Error: ${results.hashtag.error}`);
  }

  const allPassed = results.profile.success && results.hashtag.success;
  console.log(`\n${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);
  console.log("#".repeat(60) + "\n");

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
