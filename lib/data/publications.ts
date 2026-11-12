import { load } from "cheerio";
import { cached, DataError, request } from "./http";
import { metadata } from "./model";
const endpoint = "https://www.nj.gov/treasury/omb/";
export function normalizePublications(html: string) {
  const $ = load(html);
  const documents = new Map<
    string,
    { url: string; title: string; collection: string; kind: string }
  >();
  $("a[href]").each((_, element) => {
    let u: URL;
    try {
      u = new URL($(element).attr("href")!, endpoint);
    } catch {
      return;
    }
    if (
      u.protocol !== "https:" ||
      u.hostname !== "www.nj.gov" ||
      !u.pathname.startsWith("/treasury/omb/publications/") ||
      !u.pathname.toLowerCase().endsWith(".pdf")
    )
      return;
    const fallback = decodeURIComponent(u.pathname.split("/").pop()!)
      .replace(/\.pdf$/i, "")
      .replace(/[-_]/g, " ");
    const text = $(element).text().replace(/\s+/g, " ").trim();
    const title =
      text.length > 5 && !/^(view|download|click here)$/i.test(text)
        ? text
        : (documents.get(u.href)?.title ?? fallback);
    const collection = decodeURIComponent(u.pathname.split("/")[4] ?? "");
    documents.set(u.href, {
      url: u.href,
      title,
      collection,
      kind: /\/\d+approp\//.test(u.pathname)
        ? "appropriation"
        : /\/\d+fr\//.test(u.pathname)
          ? "financial-report"
          : "budget-document",
    });
  });
  if (!documents.size)
    throw new DataError(
      "SCHEMA_CHANGED",
      "OMB publication links were not found.",
    );
  return [...documents.values()];
}
export async function getPublications() {
  return cached("nj-publications", 900000, async () => ({
    status: "live",
    documents: normalizePublications(
      (await request(endpoint, {}, true)) as string,
    ),
    source: metadata(
      "NJ Treasury · Office of Management and Budget",
      endpoint,
      "publication-index",
      "As linked by OMB",
    ),
    disclaimer:
      "Official publication links discovered from OMB. Document contents and fiscal amounts are not extracted or verified. Budget recommendations and appropriations are not actual expenditures. Publication filenames are not evidence of enactment.",
  }));
}
