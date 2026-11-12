import { NextRequest } from "next/server";
import { getVote } from "@/lib/data/votes";
import { respond } from "@/lib/data/route";
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return respond(() => getVote(req.nextUrl.searchParams));
}
