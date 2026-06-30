import { NextRequest } from "next/server";
import { handleEnrichmentPost } from "@/lib/enrichment";

export const maxDuration = 600;

export async function POST(request: NextRequest) {
  return handleEnrichmentPost(request, "tiktok");
}
