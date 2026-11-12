import { NextRequest } from "next/server";
import { discoverBills } from "@/lib/data/discovery";
import { respond } from "@/lib/data/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export function GET(req: NextRequest) {
  return respond(() => discoverBills(req.nextUrl.searchParams));
}
