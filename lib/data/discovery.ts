import { load } from "cheerio";
import { z } from "zod";
import { cached, DataError, request } from "./http";
import { getBill } from "./bills";
import { metadata, pageParam } from "./model";
export function normalizeDirectory(
  html: string,
  congress: number,
  type: string,
) {
  const $ = load(html);
  const entries: { number: number; modifiedAt: string; url: string }[] = [];
  $("tr[data-name]").each((_, row) => {
    const a = $(row).find("a[href]").first();
    const u = new URL(a.attr("href") ?? "", "https://www.govinfo.gov");
    const match = new RegExp(
      `^/bulkdata/BILLSTATUS/${congress}/${type}/BILLSTATUS-${congress}${type}([0-9]+)\\.xml$`,
    ).exec(u.pathname);
    if (!match || u.hostname !== "www.govinfo.gov") return;
    const modified = $(row)
      .find('td[data-label="Last Modified (GMT)"]')
      .text()
      .trim();
    const timestamp = Date.parse(modified + " GMT");
    if (!Number.isFinite(timestamp))
      throw new DataError(
        "SCHEMA_CHANGED",
        "Official bill directory timestamp is invalid.",
      );
    entries.push({
      number: Number(match[1]),
      modifiedAt: new Date(timestamp).toISOString(),
      url: u.href,
    });
  });
  if (!entries.length)
    throw new DataError(
      "SCHEMA_CHANGED",
      "No official bill records found in GovInfo directory.",
    );
  return [...new Map(entries.map((e) => [e.number, e])).values()].sort(
    (a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || b.number - a.number,
  );
}
export async function discoverBills(params: URLSearchParams) {
  const p = z
    .object({
      congress: z.coerce.number().int().min(113).max(130).default(119),
      type: z.enum(["hr", "s"]).default("hr"),
      page: pageParam.default(1),
    })
    .parse(Object.fromEntries(params));
  return cached(`bill-discovery:${JSON.stringify(p)}`, 900000, async () => {
    const url = `https://www.govinfo.gov/bulkdata/BILLSTATUS/${p.congress}/${p.type}`;
    const directory = await cached(
      `govinfo-directory:${p.congress}:${p.type}`,
      3600000,
      async () => ({
        entries: normalizeDirectory(
          (await request(url, {}, true)) as string,
          p.congress,
          p.type,
        ),
        retrievedAt: new Date().toISOString(),
      }),
    );
    const selected = directory.entries.slice((p.page - 1) * 5, p.page * 5);
    const outcomes = await Promise.allSettled(
      selected.map((e) =>
        getBill(
          new URLSearchParams({
            congress: String(p.congress),
            type: p.type,
            number: String(e.number),
          }),
        ),
      ),
    );
    const results = outcomes.flatMap((r, i) =>
      r.status === "fulfilled"
        ? [{ ...r.value.bill, directoryModifiedAt: selected[i].modifiedAt }]
        : [],
    );
    const unavailable = outcomes.flatMap((r, i) =>
      r.status === "rejected"
        ? [
            {
              number: selected[i].number,
              code:
                r.reason instanceof DataError
                  ? r.reason.code
                  : "NORMALIZATION_FAILED",
            },
          ]
        : [],
    );
    if (selected.length && !results.length)
      throw new DataError(
        "UNAVAILABLE",
        "Selected official bill records could not be loaded.",
        503,
      );
    return {
      status: "live",
      page: p.page,
      hasNext: p.page * 5 < directory.entries.length,
      totalDirectoryEntries: directory.entries.length,
      results,
      unavailable,
      source: metadata(
        "GovInfo · Library of Congress bill-status directory",
        url,
        "legislative-discovery",
        "Directory modification order",
        { directoryRetrievedAt: directory.retrievedAt },
      ),
      disclaimer:
        "Ordered by official bulk-file modification time, not introduction date or fiscal impact. Results include proposed and enacted bills; read each current action. Failed records are identified separately. No Congress.gov API key is needed.",
    };
  });
}
