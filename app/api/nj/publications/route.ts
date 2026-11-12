import { getPublications } from "@/lib/data/publications";
import { respond } from "@/lib/data/route";
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
export function GET() {
  return respond(getPublications);
}
