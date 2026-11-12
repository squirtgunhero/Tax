import { NextRequest } from "next/server";
import { z } from "zod";
import { extractPDF } from "@/lib/data/documents";
import { respond } from "@/lib/data/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export function GET(req: NextRequest) {
  return respond(() => {
    const p = z
      .object({
        url: z.string().max(500),
        page: z.coerce.number().int().min(1).max(1000).default(1),
      })
      .parse(Object.fromEntries(req.nextUrl.searchParams));
    return extractPDF(p.url, p.page);
  });
}
