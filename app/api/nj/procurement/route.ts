import { NextRequest } from "next/server";
import { getProcurement } from "@/lib/data/procurement";
import { respond } from "@/lib/data/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export function GET(req: NextRequest) {
  return respond(() => getProcurement(req.nextUrl.searchParams));
}
