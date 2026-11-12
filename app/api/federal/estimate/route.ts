import { NextRequest } from "next/server";
import { getEstimate } from "@/lib/data/documents";
import { respond } from "@/lib/data/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export function GET(req: NextRequest) {
  return respond(() => getEstimate(req.nextUrl.searchParams));
}
