import { NextRequest } from "next/server";
import { locateRepresentatives } from "@/lib/data/representatives";
import { respond } from "@/lib/data/route";
import { DataError } from "@/lib/data/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function POST(req: NextRequest) {
  return respond(async () => {
    if (Number(req.headers.get("content-length") ?? 0) > 2048)
      throw new DataError(
        "INVALID_REQUEST",
        "Address request is too large.",
        413,
      );
    let data: unknown;
    try {
      const raw = await req.text();
      if (raw.length > 2048) throw Error();
      data = JSON.parse(raw);
    } catch {
      throw new DataError("INVALID_REQUEST", "Invalid address request.", 400);
    }
    return locateRepresentatives(data);
  });
}
