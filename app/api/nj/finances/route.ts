import { NextRequest } from "next/server";
import { getNJ } from "@/lib/data/nj";
import { respond } from "@/lib/data/route";
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return respond(() => getNJ(req.nextUrl.searchParams));
}
