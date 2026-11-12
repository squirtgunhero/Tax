import { NextRequest } from "next/server";
import { listNJBills } from "@/lib/data/nj-legislation";
import { respond } from "@/lib/data/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export function GET(req: NextRequest) {
  return respond(() => listNJBills(req.nextUrl.searchParams));
}
