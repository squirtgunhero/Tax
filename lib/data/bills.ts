import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import { cached, DataError, json, request } from "./http";
import { metadata, pageParam } from "./model";
const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  processEntities: true,
});
const list = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
export function officialUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      (u.hostname.endsWith(".gov") || u.hostname === "congress.gov")
      ? u.href
      : null;
  } catch {
    return null;
  }
}
const action = z.object({
  actionDate: z.string(),
  text: z.string(),
  recordedVotes: z.object({ recordedVote: z.unknown().optional() }).optional(),
});
const billSchema = z.object({
  number: z.string(),
  type: z.string(),
  congress: z.string(),
  title: z.string(),
  legislationUrl: z.string(),
  updateDate: z.string(),
  introducedDate: z.string(),
  latestAction: z.object({ actionDate: z.string(), text: z.string() }),
  sponsors: z.object({ item: z.unknown() }).optional(),
  actions: z.object({ item: z.unknown() }).optional(),
  cboCostEstimates: z.unknown().optional(),
  textVersions: z.unknown().optional(),
});
export function normalizeBill(xml: string) {
  try {
    return parseBill(xml);
  } catch (e) {
    if (e instanceof DataError) throw e;
    throw new DataError(
      "SCHEMA_CHANGED",
      "Official bill fields are missing or invalid.",
    );
  }
}
function parseBill(xml: string) {
  if (xml.includes("<!DOCTYPE") || XMLValidator.validate(xml) !== true)
    throw new DataError("INVALID_XML", "Official bill XML is invalid.");
  const parsed = billSchema.safeParse(parser.parse(xml)?.billStatus?.bill);
  if (!parsed.success)
    throw new DataError("SCHEMA_CHANGED", "Official bill schema changed.");
  const b = parsed.data;
  const overview = officialUrl(b.legislationUrl);
  if (
    !overview ||
    !["www.congress.gov", "congress.gov"].includes(
      new URL(overview).hostname,
    ) ||
    !new URL(overview).pathname.startsWith("/bill/")
  )
    throw new DataError(
      "SCHEMA_CHANGED",
      "Official bill overview URL is invalid.",
    );
  const actions = list(b.actions?.item).map((a) => action.parse(a));
  const votes = actions.flatMap((a) =>
    list(a.recordedVotes?.recordedVote).map((v) => {
      const r = z
        .object({
          rollNumber: z.string(),
          url: z.string(),
          chamber: z.string(),
          date: z.string(),
          congress: z.string(),
          sessionNumber: z.string(),
        })
        .parse(v);
      return { ...r, url: officialUrl(r.url), action: a.text };
    }),
  );
  const uniqueVotes = [
    ...new Map(
      votes.map((v) => [
        `${v.chamber}:${v.congress}:${v.sessionNumber}:${v.rollNumber}`,
        v,
      ]),
    ).values(),
  ];
  const sponsors = list(b.sponsors?.item).map((s) =>
    z
      .object({
        bioguideId: z.string().regex(/^[A-Z][0-9]{6}$/),
        fullName: z.string(),
        party: z.string(),
        state: z.string(),
      })
      .parse(s),
  );
  const cbo = z
    .object({ item: z.unknown().optional() })
    .safeParse(b.cboCostEstimates);
  const estimates = list(cbo.success ? cbo.data.item : undefined)
    .map((e) =>
      z
        .object({
          title: z.string(),
          url: z.string(),
          pubDate: z.string(),
          description: z.string().optional(),
        })
        .parse(e),
    )
    .map((e) => ({ ...e, url: officialUrl(e.url) }));
  const versionsSchema = z
    .object({ item: z.unknown().optional() })
    .safeParse(b.textVersions);
  const versions = list(
    versionsSchema.success ? versionsSchema.data.item : undefined,
  ).map((v) =>
    z
      .object({
        type: z.string(),
        formats: z.object({ item: z.unknown().optional() }),
      })
      .parse(v),
  );
  const introduced = versions.find((v) =>
    /Introduced in (House|Senate)/.test(v.type),
  );
  const introducedFormat = introduced
    ? list(introduced.formats.item)
        .map((f) => z.object({ url: z.string() }).parse(f))
        .find((f) => officialUrl(f.url))
    : undefined;
  return {
    number: b.number,
    type: b.type,
    congress: b.congress,
    title: b.title,
    url: overview,
    originalTextUrl: introducedFormat
      ? officialUrl(introducedFormat.url)
      : null,
    textVersionsUrl: `${overview}/text`,
    updatedAt: b.updateDate,
    introducedDate: b.introducedDate,
    latestAction: b.latestAction,
    sponsors,
    estimates,
    votes: uniqueVotes,
    actions: actions.map((a) => ({ date: a.actionDate, text: a.text })),
  };
}
export async function getBill(params: URLSearchParams) {
  const p = z
    .object({
      congress: z.coerce.number().int().min(113).max(130).default(119),
      type: z
        .enum([
          "hr",
          "s",
          "hjres",
          "sjres",
          "hconres",
          "sconres",
          "hres",
          "sres",
        ])
        .default("hr"),
      number: z.coerce.number().int().min(1).max(99999),
    })
    .parse(Object.fromEntries(params));
  return cached(`bill:${JSON.stringify(p)}`, 900000, async () => {
    const url = `https://www.govinfo.gov/bulkdata/BILLSTATUS/${p.congress}/${p.type}/BILLSTATUS-${p.congress}${p.type}${p.number}.xml`;
    const bill = normalizeBill((await request(url, {}, true)) as string);
    if (
      Number(bill.number) !== p.number ||
      Number(bill.congress) !== p.congress ||
      bill.type.toLowerCase() !== p.type
    )
      throw new DataError(
        "IDENTITY_MISMATCH",
        "Official bill identifier mismatch.",
      );
    return {
      status: "live",
      bill,
      source: metadata(
        "Library of Congress bill status · GovInfo official bulk data",
        url,
        "legislative-status",
        bill.updatedAt,
      ),
      disclaimer:
        "Legislation is not actual spending. A bill may already be enacted. Fiscal estimates are linked to official CBO documents and apply to the version and baseline named there; no dollar impact is inferred from bill text. Sponsors are not necessarily supporters of every subsequent version. Recorded vote links contain individual votes; voice votes do not have individual roll calls.",
    };
  });
}
// Congress.gov API discovery is optional; exact bill lookup works without a key.
export async function listBills(params: URLSearchParams) {
  const page = pageParam.parse(params.get("page") ?? 1);
  if (!process.env.CONGRESS_API_KEY)
    throw new DataError(
      "CONFIGURATION_REQUIRED",
      "Congress.gov discovery requires a server-side CONGRESS_API_KEY. Exact bill lookup uses official GovInfo data without a key.",
      503,
    );
  return cached(`congress:${page}`, 900000, async () => {
    const url = new URL("https://api.congress.gov/v3/bill");
    url.searchParams.set("api_key", process.env.CONGRESS_API_KEY!);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "20");
    url.searchParams.set("offset", String((page - 1) * 20));
    const data = await json(
      url.href,
      z.object({
        bills: z.array(
          z.object({
            congress: z.number(),
            number: z.string(),
            type: z.string(),
            title: z.string(),
            latestAction: z.object({
              actionDate: z.string(),
              text: z.string(),
            }),
          }),
        ),
        pagination: z.object({ count: z.number() }),
      }),
    );
    return {
      status: "live",
      results: data.bills,
      page,
      hasNext: page * 20 < data.pagination.count,
      source: metadata(
        "Congress.gov API",
        "https://api.congress.gov/v3/bill",
        "legislative-status",
        "Latest updates",
      ),
    };
  });
}
