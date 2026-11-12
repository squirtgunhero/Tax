import { NextRequest } from "next/server";
import { getNJCurrent } from "@/lib/data/nj-current";
import { respond } from "@/lib/data/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export function GET(req: NextRequest) {
  return respond(() => getNJCurrent(req.nextUrl.searchParams));
}
