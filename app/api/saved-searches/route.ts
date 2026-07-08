import { NextRequest, NextResponse } from "next/server";
import { listSavedSearchesForPlatform, loadSearchFromXls, deleteRowsFromXls, addToBlacklist } from "@/lib/xls";

export async function GET(req: NextRequest) {
  try {
    const filename = req.nextUrl.searchParams.get("file");
    const platform = req.nextUrl.searchParams.get("platform") || "tiktok";

    if (filename) {
      const rows = loadSearchFromXls(filename, platform);
      return NextResponse.json({ rows });
    }

    const searches = listSavedSearchesForPlatform(platform);
    return NextResponse.json({ searches });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { filename, videoUrls, platform = "tiktok" } = await req.json();

    if (!filename || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: "Invalid parameters." }, { status: 400 });
    }

    const deleted = deleteRowsFromXls(filename, videoUrls, platform);
    addToBlacklist(videoUrls, platform);
    return NextResponse.json({ deleted, message: `${deleted} record(s) removed from XLSX and added to blacklist.` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
