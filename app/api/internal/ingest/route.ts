import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { ingest } from "@/lib/data/ingest";
import { DataError } from "@/lib/data/http";
import { respond } from "@/lib/data/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export function GET(req: NextRequest) {
  return respond(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret)
      throw new DataError(
        "CONFIGURATION_REQUIRED",
        "Scheduled ingestion secret is not configured.",
        503,
      );
    const actual = Buffer.from(req.headers.get("authorization") ?? ""),
      expected = Buffer.from(`Bearer ${secret}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new DataError(
        "UNAUTHORIZED",
        "Unauthorized ingestion request.",
        401,
      );
    const report = await ingest();
    if (!report.ok)
      return NextResponse.json(report, {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      });
    return report;
  });
}
