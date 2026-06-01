#!/usr/bin/env node

/**
 * Test script to find a working Apify account
 * Tests all available accounts until one works
 */

const BASE_URL = "https://api.apify.com/v2";
const POLL_INTERVAL_MS = 5000;
const MAX_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// All available Apify accounts from .env.local
const ACCOUNTS = [
  {
    id: "acc_1",
    label: "tutorial.master.brasil@gmail.com",
    token: "apify_api_ddYrXwWmDCU1AFVkm79DaaDHu34Lz72VfCNu"
  },
  {
    id: "acc_2",
    label: "alecrim.bruno@gmail.com",
    token: "apify_api_3n6iDYgtmrjg54gyv2Cl9ZlUEFlSgS4zRoPn"
  },
  {
    id: "acc_3",
    label: "3dreamplace@gmail.com",
    token: "apify_api_P6PTNSi3mfHPQvyl6EJKlNnyWZYTtF3RuvDt"
  },
  {
    id: "acc_4",
    label: "megadrive",
    token: "apify_api_EKtdwlIGM6bUhIcZ7YuMUFAIapb0EJ3K4iae"
  }
];

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
      hashtags: ["travel"],
      resultsPerPage: 5,
      proxyCountryCode: "BR"
    }
  }
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testActorWithAccount(account, actorKey, actor) {
  try {
    const actorIdForUrl = actor.id.replace("/", "~");
    const runUrl = `${BASE_URL}/acts/${actorIdForUrl}/runs?token=${account.token}&waitForFinish=120`;

    const runResponse = await fetch(runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actor.testInput),
    });

    if (!runResponse.ok) {
      const text = await runResponse.text();
      throw new Error(`HTTP ${runResponse.status}: ${text}`);
    }

    let runData = await runResponse.json();
    const runId = runData.data?.id;

    if (!runId) {
      throw new Error("No run ID returned");
    }

    // Poll until finished
    const startTime = Date.now();
    let pollCount = 0;

    while (runData.data?.status === "RUNNING" || runData.data?.status === "READY") {
      if (Date.now() - startTime > MAX_TIMEOUT_MS) {
        throw new Error("TIMEOUT: Actor did not finish within 2 minutes");
      }

      pollCount++;
      await sleep(POLL_INTERVAL_MS);

      const pollUrl = `${BASE_URL}/acts/${actorIdForUrl}/runs/${runId}?token=${account.token}`;
      const pollResponse = await fetch(pollUrl);

      if (!pollResponse.ok) {
        throw new Error(`Polling failed (${pollResponse.status})`);
      }

      runData = await pollResponse.json();
    }

    const finalStatus = runData.data?.status;
    if (finalStatus !== "SUCCEEDED") {
      const statusMessage = runData.data?.statusMessage || "";
      throw new Error(`Actor failed: ${finalStatus} — ${statusMessage}`);
    }

    // Fetch results
    const datasetId = runData.data?.defaultDatasetId;
    if (!datasetId) {
      throw new Error("No dataset ID returned");
    }

    const datasetUrl = `${BASE_URL}/datasets/${datasetId}/items?token=${account.token}`;
    const datasetResponse = await fetch(datasetUrl);

    if (!datasetResponse.ok) {
      throw new Error(`Dataset fetch failed (${datasetResponse.status})`);
    }

    const items = await datasetResponse.json();
    return { success: true, itemsCount: items.length, items };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testAccountWithBothActors(account) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Testing Account: ${account.label} (${account.id})`);
  console.log(`Token: ${account.token.substring(0, 20)}...`);
  console.log("=".repeat(70));

  const results = {};

  // Test Profile Actor
  console.log(`\n  Testing Profile_Actor...`);
  results.profile = await testActorWithAccount(account, "profile", ACTORS.profile);
  if (results.profile.success) {
    console.log(`  ✅ SUCCESS - Retrieved ${results.profile.itemsCount} items`);
  } else {
    console.log(`  ❌ FAILED - ${results.profile.error}`);
  }

  // Test Hashtag Actor
  console.log(`\n  Testing Hashtag_Actor...`);
  results.hashtag = await testActorWithAccount(account, "hashtag", ACTORS.hashtag);
  if (results.hashtag.success) {
    console.log(`  ✅ SUCCESS - Retrieved ${results.hashtag.itemsCount} items`);
  } else {
    console.log(`  ❌ FAILED - ${results.hashtag.error}`);
  }

  const bothPassed = results.profile.success && results.hashtag.success;
  console.log(`\n  Result: ${bothPassed ? "✅ BOTH PASSED" : "❌ AT LEAST ONE FAILED"}`);

  return { account, results, bothPassed };
}

async function main() {
  console.log(`\n${"#".repeat(70)}`);
  console.log(`# Apify Multi-Account Test - Finding Working Account`);
  console.log("#".repeat(70));
  console.log(`\nTesting ${ACCOUNTS.length} accounts...`);
  console.log(`Base URL: ${BASE_URL}`);

  const allResults = [];
  let workingAccount = null;

  for (const account of ACCOUNTS) {
    const result = await testAccountWithBothActors(account);
    allResults.push(result);

    if (result.bothPassed && !workingAccount) {
      workingAccount = account;
      console.log(`\n🎉 FOUND WORKING ACCOUNT: ${account.label}`);
      break; // Stop testing once we find a working account
    }
  }

  // Summary
  console.log(`\n${"#".repeat(70)}`);
  console.log(`# Test Summary`);
  console.log("#".repeat(70));

  for (const result of allResults) {
    const status = result.bothPassed ? "✅" : "❌";
    console.log(`\n${status} ${result.account.label}`);
    console.log(`   Profile_Actor: ${result.results.profile.success ? "✅" : "❌"}`);
    if (!result.results.profile.success) {
      console.log(`      Error: ${result.results.profile.error}`);
    }
    console.log(`   Hashtag_Actor: ${result.results.hashtag.success ? "✅" : "❌"}`);
    if (!result.results.hashtag.success) {
      console.log(`      Error: ${result.results.hashtag.error}`);
    }
  }

  console.log(`\n${"#".repeat(70)}`);
  if (workingAccount) {
    console.log(`\n✅ WORKING ACCOUNT FOUND!`);
    console.log(`\nAccount: ${workingAccount.label}`);
    console.log(`ID: ${workingAccount.id}`);
    console.log(`Token: ${workingAccount.token}`);
    console.log(`\nTo use this account, update .env.local:`);
    console.log(`Set "default": true for ${workingAccount.id}`);
    console.log(`Set "default": false for all other accounts`);
    console.log(`\nThen restart the server: npm run dev`);
  } else {
    console.log(`\n❌ NO WORKING ACCOUNT FOUND`);
    console.log(`\nAll accounts have exceeded their monthly usage limit.`);
    console.log(`Options:`);
    console.log(`1. Wait for the next billing cycle`);
    console.log(`2. Increase the usage limit in Apify console`);
    console.log(`3. Create a new Apify account`);
  }
  console.log(`\n${"#".repeat(70)}\n`);

  process.exit(workingAccount ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
