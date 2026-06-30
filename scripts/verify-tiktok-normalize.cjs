/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const moduleCache = new Map();

function loadTsModule(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (moduleCache.has(resolvedPath)) return moduleCache.get(resolvedPath).exports;

  const source = fs.readFileSync(resolvedPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: resolvedPath,
  }).outputText;

  const moduleLike = { exports: {} };
  moduleCache.set(resolvedPath, moduleLike);

  const localRequire = (id) => {
    if (id.startsWith("@/")) {
      return loadTsModule(path.join(root, `${id.slice(2)}.ts`));
    }
    return require(id);
  };

  const sandbox = {
    require: localRequire,
    module: moduleLike,
    exports: moduleLike.exports,
  };

  vm.runInNewContext(transpiled, sandbox, { filename: resolvedPath });
  return moduleLike.exports;
}

const { normalizeChannelVideos } = loadTsModule(path.join(root, "lib", "normalize.ts"));

if (typeof normalizeChannelVideos !== "function") {
  throw new Error("normalizeChannelVideos export not found");
}

const rows = normalizeChannelVideos([
  {
    id: "7350000000000000001",
    text: "A long TikTok description about AI and automation for creators",
    playCount: "12345",
    diggCount: 678,
    commentCount: "90",
    postPage: "https://www.tiktok.com/@creator/video/7350000000000000001",
    createTimeISO: "2026-05-20T12:00:00.000Z",
    challenges: [{ title: "ai" }, { title: "automation" }],
  },
  {
    videoId: "7350000000000000002",
    title: "Fallback title",
    views: 222,
    likeCount: "33",
    comments: 4,
    webVideoUrl: "https://www.tiktok.com/@creator/video/7350000000000000002",
    publishDate: "2026-05-21",
    hashtags: ["fallback", { name: "creator" }],
  },
  {
    id: "7350000000000000003",
    description: "Build URL from author and id",
    viewCount: "444",
    likes: "55",
    authorMeta: { name: "author_name" },
  },
]);

assert.equal(rows.length, 3);

assert.deepEqual(JSON.parse(JSON.stringify(rows[0])), {
  videoId: "7350000000000000001",
  title: "A long TikTok description about AI and automation for creators",
  description: "A long TikTok description about AI and automation for creators",
  views: 12345,
  likes: 678,
  hashtags: ["ai", "automation"],
  videoUrl: "https://www.tiktok.com/@creator/video/7350000000000000001",
  comments: 90,
  publishDate: "2026-05-20T12:00:00.000Z",
});

assert.deepEqual(JSON.parse(JSON.stringify(rows[1])), {
  videoId: "7350000000000000002",
  title: "Fallback title",
  description: "Fallback title",
  views: 222,
  likes: 33,
  hashtags: ["fallback", "creator"],
  videoUrl: "https://www.tiktok.com/@creator/video/7350000000000000002",
  comments: 4,
  publishDate: "2026-05-21",
});

assert.deepEqual(JSON.parse(JSON.stringify(rows[2])), {
  videoId: "7350000000000000003",
  title: "Build URL from author and id",
  description: "Build URL from author and id",
  views: 444,
  likes: 55,
  hashtags: [],
  videoUrl: "https://www.tiktok.com/@author_name/video/7350000000000000003",
});

console.log("TikTok normalize characterization passed");
