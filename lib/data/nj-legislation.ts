import { unzipSync } from "fflate";
import { load } from "cheerio";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { cached, DataError, request } from "./http";
import { metadata, pageParam, queryParam } from "./model";
import { sha256 } from "./storage";
export const njSession = () => Math.floor(new Date().getUTCFullYear() / 2) * 2;
const sessionSchema = z.coerce
  .number()
  .int()
  .min(2000)
  .max(2030)
  .refine((n) => n % 2 === 0);
const identifier = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^(A|S|AJR|SJR|ACR|SCR|AR|SR)[1-9][0-9]{0,4}$/);
export function csvRows(bytes: Uint8Array): Record<string, string>[] {
  try {
    return parse(new TextDecoder("windows-1252").decode(bytes), {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
      relax_column_count: false,
    });
  } catch {
    throw new DataError(
      "INVALID_CSV",
      "Official legislative CSV could not be parsed.",
    );
  }
}
export function archiveFiles(bytes: Uint8Array, allow: RegExp) {
  let total = 0;
  try {
    return unzipSync(bytes, {
      filter: (file) => {
        if (!allow.test(file.name)) return false;
        total += file.originalSize;
        if (total > 50_000_000) throw Error("Archive too large");
        return true;
      },
    });
  } catch {
    throw new DataError(
      "INVALID_ARCHIVE",
      "Official archive is invalid or exceeds the decompression limit.",
    );
  }
}
async function archive(url: string) {
  return cached(`official-archive:${url}`, 900000, async () => {
    const bytes = (await request(url, {}, "bytes")) as Uint8Array;
    return {
      base64: Buffer.from(bytes).toString("base64"),
      sha256: sha256(bytes),
      retrievedAt: new Date().toISOString(),
    };
  });
}
async function statusLabels() {
  return cached("nj-status-labels", 86400000, async () => {
    const $ = load(
      (await request(
        "https://www.njleg.state.nj.us/bill-search",
        {},
        true,
      )) as string,
    );
    const labels: Record<string, string> = {};
    $("#CurrentStatus option").each((_, option) => {
      const key = $(option).attr("value");
      if (key) labels[key] = $(option).text().trim();
    });
    if (!Object.keys(labels).length)
      throw new DataError(
        "SCHEMA_CHANGED",
        "Official NJ status definitions were not found.",
      );
    return labels;
  }).catch(() => null);
}
const parsed = new Map<string, Record<string, Record<string, string>[]>>();
async function database(session: number) {
  const url = `https://pub.njleg.gov/leg-databases/${session}data/DB${session}_TEXT.zip`;
  const raw = await archive(url);
  let tables = parsed.get(raw.sha256);
  if (!tables) {
    const files = archiveFiles(
      Buffer.from(raw.base64, "base64"),
      /^(MAINBILL|BILLHIST|BILLSPON|BILLWP|ROSTER|COMMITTEE)\.TXT$/,
    );
    tables = Object.fromEntries(
      Object.entries(files).map(([name, bytes]) => [name, csvRows(bytes)]),
    );
    for (const name of [
      "MAINBILL.TXT",
      "BILLHIST.TXT",
      "BILLSPON.TXT",
      "BILLWP.TXT",
      "ROSTER.TXT",
    ])
      if (!tables[name]?.length)
        throw new DataError(
          "SCHEMA_CHANGED",
          "Official NJ legislative table is missing.",
        );
    if (parsed.size >= 3) parsed.delete(parsed.keys().next().value!);
    parsed.set(raw.sha256, tables);
  }
  return {
    tables,
    source: metadata(
      "NJ Legislature · official legislative database",
      url,
      "legislative-status",
      `${session}–${session + 1} legislative session`,
      { retrievedAt: raw.retrievedAt, sha256: raw.sha256 },
    ),
  };
}
const billRow = z
  .object({
    ActualBillNumber: z.string().min(1),
    BillType: z.string(),
    BillNumber: z.string().regex(/^[0-9]+$/),
    Synopsis: z.string(),
    CurrentStatus: z.string(),
    LDOA: z.string(),
    IntroDate: z.string(),
    ModDate: z.string(),
    FirstPrime: z.string(),
    SecondPrime: z.string(),
    ThirdPrime: z.string(),
  })
  .passthrough();
export function njDocument(row: Record<string, string>, session: number) {
  const match =
    /\\(\d{4})BILL\\([AS][0-9]{4})\\([A-Za-z0-9_]+)\.(DOCX?|PDF)$/i.exec(
      row.Document ?? "",
    );
  return {
    type: row.DocType,
    comment: row.Comment || null,
    pages: row.Pages || null,
    updatedAt: row.ModDate,
    url:
      match && Number(match[1]) === session
        ? `https://pub.njleg.gov/Bills/${session}/${match[2]}/${match[3]}.PDF`
        : null,
  };
}
function validateRow(r: Record<string, string>) {
  const result = billRow.safeParse(r);
  if (!result.success)
    throw new DataError("SCHEMA_CHANGED", "Official NJ bill fields changed.");
  return result.data;
}
export async function listNJBills(params: URLSearchParams) {
  const p = z
    .object({
      session: sessionSchema.default(njSession()),
      page: pageParam.default(1),
      q: queryParam.default(""),
    })
    .parse(Object.fromEntries(params));
  const db = await database(p.session);
  const labels = await statusLabels();
  const rows = db.tables["MAINBILL.TXT"]
    .map(validateRow)
    .filter(
      (r) =>
        !p.q ||
        [
          r.ActualBillNumber,
          r.Synopsis,
          r.FirstPrime,
          r.SecondPrime,
          r.ThirdPrime,
        ]
          .join(" ")
          .toLowerCase()
          .includes(p.q.toLowerCase()),
    );
  rows.sort(
    (a, b) =>
      Date.parse(b.LDOA) - Date.parse(a.LDOA) ||
      a.ActualBillNumber.localeCompare(b.ActualBillNumber),
  );
  return {
    status: "live",
    session: p.session,
    page: p.page,
    hasNext: p.page * 20 < rows.length,
    count: rows.length,
    results: rows.slice((p.page - 1) * 20, p.page * 20).map((r) => ({
      id: r.BillType.trim() + r.BillNumber,
      displayNumber: r.ActualBillNumber,
      title: r.Synopsis,
      statusCode: r.CurrentStatus,
      statusLabel: labels?.[r.CurrentStatus] ?? null,
      lastAction: r.LDOA,
      sponsor: r.FirstPrime,
      url: `https://www.njleg.state.nj.us/bill-search/${p.session}/${r.BillType.trim() + r.BillNumber}`,
    })),
    source: db.source,
    disclaimer:
      "Official status codes and bill synopses are preserved. A bill or appropriation is not an expenditure; consult its history and original documents.",
  };
}
export async function getNJBill(params: URLSearchParams) {
  const p = z
    .object({ session: sessionSchema.default(njSession()), bill: identifier })
    .parse(Object.fromEntries(params));
  const db = await database(p.session);
  const labels = await statusLabels();
  const raw = db.tables["MAINBILL.TXT"].find(
    (r) => `${r.BillType.trim()}${r.BillNumber}` === p.bill,
  );
  if (!raw)
    throw new DataError(
      "NO_DATA",
      "Bill is not present in the official session database.",
      404,
    );
  const b = validateRow(raw);
  const matches = (r: Record<string, string>) =>
    `${r.BillType.trim()}${r.BillNumber}` === p.bill;
  return {
    status: "live",
    session: p.session,
    bill: {
      id: p.bill,
      displayNumber: b.ActualBillNumber,
      title: b.Synopsis,
      statusCode: b.CurrentStatus,
      statusLabel: labels?.[b.CurrentStatus] ?? null,
      introduced: b.IntroDate,
      lastAction: b.LDOA,
      url: `https://www.njleg.state.nj.us/bill-search/${p.session}/${p.bill}`,
      sponsors: db.tables["BILLSPON.TXT"].filter(matches).map((r) => ({
        name: r.Sponsor,
        type: r.Type,
        status: r.Status,
        date: r.SponDate,
        withdrawnAt: r.WithDate || null,
      })),
      actions: db.tables["BILLHIST.TXT"]
        .filter(matches)
        .sort((a, b) => Number(b.Sequence) - Number(a.Sequence))
        .map((r) => ({
          date: r.DateAction,
          action: r.Action,
          comment: r.Comment || null,
          chamber: r.House,
        })),
      documents: db.tables["BILLWP.TXT"]
        .filter(matches)
        .map((r) => njDocument(r, p.session)),
    },
    source: db.source,
    disclaimer:
      "I = introduced text; FE/FS/FN = source fiscal-document classifications. Fiscal documents apply to the version named in their comments. Dollar impacts are not inferred from a synopsis. Sponsorship and withdrawal status are preserved.",
  };
}
export async function njRoster(session = njSession()) {
  const db = await database(session);
  return db.tables["ROSTER.TXT"]
    .filter((r) => r.LegStatus === "Active")
    .map((r) => ({
      id: r["Roster Key"],
      district: r.District,
      chamber: r.House,
      name: [r.Firstname, r.MidName, r.LastName, r.Suffix]
        .filter(Boolean)
        .join(" "),
      party: r.Party,
      url: `https://www.njleg.state.nj.us/legislative-roster/${encodeURIComponent(r["Roster Key"])}`,
    }));
}
export async function getNJVotes(params: URLSearchParams) {
  const p = z
    .object({
      session: sessionSchema.default(njSession()),
      year: z.coerce.number().int().min(2000).max(2031).optional(),
      bill: identifier,
      chamber: z.enum(["A", "S"]).default("S"),
    })
    .parse(Object.fromEntries(params));
  const years = p.year
    ? [p.year]
    : [p.session, p.session + 1].filter(
        (y) => y <= new Date().getUTCFullYear(),
      );
  if (years.some((y) => y < p.session || y > p.session + 1))
    throw new DataError(
      "INVALID_QUERY",
      "Vote year must be within the selected legislative session.",
      400,
    );
  const sources = [];
  const rows: Record<string, string>[] = [];
  for (const year of years) {
    const url = `https://pub.njleg.gov/votes/${p.chamber}${year}.zip`;
    const raw = await archive(url);
    const files = archiveFiles(
      Buffer.from(raw.base64, "base64"),
      /^[AS][0-9]{4}(?:[^/]*)\.txt$/i,
    );
    if (!Object.keys(files).length)
      throw new DataError(
        "SCHEMA_CHANGED",
        "Vote archive contains no expected CSV file.",
      );
    for (const bytes of Object.values(files)) rows.push(...csvRows(bytes));
    sources.push({ url, retrievedAt: raw.retrievedAt, sha256: raw.sha256 });
  }
  const schema = z.object({
    Bill: z.string(),
    Full_Name: z.string(),
    Session_Date: z.string(),
    CurrentStatus: z.string(),
    Action: z.string(),
    Legislator_Vote: z.string(),
  });
  const groups = new Map<string, z.infer<typeof schema>[]>();
  for (const raw of rows) {
    const v = schema.safeParse(raw);
    if (!v.success)
      throw new DataError("SCHEMA_CHANGED", "Official NJ vote fields changed.");
    const r = v.data;
    if (r.Bill.trim() !== p.bill) continue;
    const key = JSON.stringify([r.Session_Date, r.CurrentStatus, r.Action]);
    const group = groups.get(key) ?? [];
    group.push(r);
    groups.set(key, group);
  }
  return {
    status: "live",
    bill: p.bill,
    chamber: p.chamber,
    groups: [...groups.values()].map((rows) => ({
      date: rows[0].Session_Date,
      action: rows[0].Action,
      statusCode: rows[0].CurrentStatus,
      ambiguous: new Set(rows.map((r) => r.Full_Name)).size !== rows.length,
      members: rows.map((r) => ({
        name: r.Full_Name,
        vote: r.Legislator_Vote || null,
      })),
      totals: {
        yea: rows.filter((r) => r.Legislator_Vote === "Y").length,
        nay: rows.filter((r) => r.Legislator_Vote === "N").length,
        otherOrUnreported: rows.filter(
          (r) => !["Y", "N"].includes(r.Legislator_Vote),
        ).length,
      },
    })),
    sources,
    source: metadata(
      "NJ Legislature · official recorded vote archives",
      "https://www.njleg.state.nj.us/legislative-downloads?downloadType=Votes",
      "recorded-vote",
      years.join(", "),
    ),
    disclaimer:
      "Y and N are source-recorded choices. Blank or other codes remain unreported/other, never inferred as abstentions. Archives lack unique roll IDs; groups with repeated members are flagged ambiguous and must not be interpreted as a single roll call. January session-boundary votes may be in the preceding odd-year archive; a complete historical session reconciliation is not claimed.",
  };
}
