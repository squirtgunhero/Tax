import { NextResponse } from "next/server";
import { readObject, storageMode } from "@/lib/data/storage";
import { metrics } from "@/lib/data/telemetry";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const mode = storageMode();
  let lastRun: unknown = null,
    storageReadable = true;
  try {
    const text = await readObject("runs/latest.json");
    lastRun = text ? JSON.parse(text) : null;
  } catch {
    storageReadable = false;
  }
  const report = lastRun as { ok?: boolean; completedAt?: string } | null;
  const stale =
    !report?.completedAt ||
    Date.now() - Date.parse(report.completedAt) > 26 * 3600000;
  const ok =
    storageReadable && mode !== "memory-only" && !stale && report?.ok === true;
  return NextResponse.json(
    {
      status: ok ? "healthy" : "degraded",
      storage: mode,
      storageReadable,
      scheduledIngestionConfigured: !!process.env.CRON_SECRET,
      stale,
      lastRun,
      counters: metrics(),
      note: "Health reflects the last durable ingestion report and this process. It is not a new probe of every upstream source.",
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
