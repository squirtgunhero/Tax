import { load } from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { extractText } from "unpdf";
import { cached, DataError, request } from "./http";
import { metadata } from "./model";
import { sha256 } from "./storage";
import { archiveFiles } from "./nj-legislation";
import { z } from "zod";
const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  processEntities: true,
});
const many = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
function xml(bytes: Uint8Array) {
  const text = new TextDecoder().decode(bytes);
  if (text.includes("<!DOCTYPE"))
    throw new DataError(
      "INVALID_XML",
      "Document contains unsupported XML declarations.",
    );
  return parser.parse(text);
}
export function parseWorkbook(bytes: Uint8Array, sheet = 0) {
  const files = archiveFiles(
    bytes,
    /^(xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet[0-9]+\.xml))$/,
  );
  if (!files["xl/workbook.xml"] || !files["xl/_rels/workbook.xml.rels"])
    throw new DataError(
      "SCHEMA_CHANGED",
      "Official workbook structure is invalid.",
    );
  const book = xml(files["xl/workbook.xml"]),
    rels = xml(files["xl/_rels/workbook.xml.rels"]);
  const sheets = many<Record<string, string>>(book.workbook.sheets.sheet);
  const selected = sheets[sheet];
  if (!selected)
    throw new DataError("INVALID_SHEET", "Worksheet is not available.", 404);
  const relation = many<Record<string, string>>(
    rels.Relationships.Relationship,
  ).find((r) => r["@_Id"] === selected["@_r:id"]);
  const target = relation?.["@_Target"]
    ?.replace(/^\//, "")
    .replace(/^xl\//, "");
  if (
    !target ||
    !/^worksheets\/sheet[0-9]+\.xml$/.test(target) ||
    !files["xl/" + target]
  )
    throw new DataError("SCHEMA_CHANGED", "Workbook sheet target is invalid.");
  const shared = files["xl/sharedStrings.xml"]
    ? many<Record<string, unknown>>(
        xml(files["xl/sharedStrings.xml"]).sst.si,
      ).map((s) =>
        typeof s.t === "string"
          ? s.t
          : many<Record<string, string>>(s.r as Record<string, string>[])
              .map((r) => r.t ?? "")
              .join(""),
      )
    : [];
  const rows = many<Record<string, unknown>>(
    xml(files["xl/" + target]).worksheet.sheetData.row,
  );
  if (rows.length > 5000)
    throw new DataError(
      "DOCUMENT_LIMIT",
      "Worksheet exceeds the safe parsing limit.",
    );
  const normalized = rows.slice(0, 200).map((row) => ({
    row: Number(row["@_r"]),
    cells: many<Record<string, unknown>>(
      row.c as Record<string, unknown>[],
    ).map((c) => {
      const type = c["@_t"],
        v = c.v;
      let value: string | null = v === undefined ? null : String(v);
      if (type === "s") value = shared[Number(v)] ?? null;
      else if (type === "inlineStr") {
        const inline = c.is as { t?: unknown };
        value = typeof inline?.t === "string" ? inline.t : null;
      }
      return {
        cell: String(c["@_r"]),
        value,
        type:
          type === "s" || type === "inlineStr"
            ? "text"
            : type === "b"
              ? "boolean"
              : "number",
        formula: typeof c.f === "string" ? c.f : null,
      };
    }),
  }));
  return {
    sheets: sheets.map((s, i) => ({ index: i, name: s["@_name"] })),
    selectedSheet: sheet,
    rows: normalized,
    totalRows: rows.length,
    truncated: rows.length > 200,
  };
}
export function approvedPDF(value: string) {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new DataError(
      "INVALID_DOCUMENT",
      "Invalid official document URL.",
      400,
    );
  }
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !u.pathname.toLowerCase().endsWith(".pdf")
  )
    throw new DataError(
      "INVALID_DOCUMENT",
      "Only approved official PDF URLs are supported.",
      400,
    );
  const allowed =
    (u.hostname === "www.nj.gov" &&
      u.pathname.startsWith("/treasury/omb/publications/")) ||
    (u.hostname === "pub.njleg.gov" &&
      /^\/Bills\/20[0-9]{2}\/[AS][0-9]{4}\/[A-Za-z0-9_]+\.PDF$/i.test(
        u.pathname,
      )) ||
    (u.hostname === "www.irs.gov" &&
      u.pathname === "/pub/irs-drop/rp-25-32.pdf");
  if (!allowed)
    throw new DataError(
      "INVALID_DOCUMENT",
      "Document publisher or path is not approved.",
      400,
    );
  return u.href;
}
export async function extractPDF(url: string, page: number) {
  const approved = approvedPDF(url);
  return cached(`pdf:v2:${approved}:${page}`, 86400000, async () => {
    const bytes = (await request(approved, {}, "bytes")) as Uint8Array;
    if (!Buffer.from(bytes.slice(0, 5)).equals(Buffer.from("%PDF-")))
      throw new DataError(
        "INVALID_PDF",
        "Official source did not return a PDF.",
      );
    const documentHash = sha256(bytes);
    const result = await extractText(bytes, { mergePages: false });
    const text = result.text[page - 1];
    if (text === undefined)
      throw new DataError(
        "PAGE_UNAVAILABLE",
        "Document page is not available.",
        404,
      );
    return {
      status: "live",
      page,
      totalPages: result.totalPages,
      text,
      sha256: documentHash,
      source: metadata(
        "Official PDF · extracted page",
        approved,
        "source-document",
        `PDF page ${page}`,
        { cacheTtlSeconds: 86400 },
      ),
      disclaimer:
        "Verbatim extracted source text with page citation and document checksum. Reading order may differ from the original table layout. Values, units, proposals, enacted authority, and actuals are not silently combined; verify table headings in the original PDF.",
    };
  });
}
export async function getEstimate(params: URLSearchParams) {
  const p = z
    .object({
      publication: z.coerce.number().int().min(10000).max(99999),
      sheet: z.coerce.number().int().min(0).max(19).default(0),
    })
    .parse(Object.fromEntries(params));
  return cached(`cbo:${p.publication}:${p.sheet}`, 900000, async () => {
    const url = `https://www.cbo.gov/publication/${p.publication}`,
      html = (await request(url, {}, true)) as string,
      $ = load(html);
    const title = $("h1").first().text().trim();
    const summary = $(".field--name-body")
      .first()
      .find("p")
      .map((_, p) => $(p).text().trim())
      .get()
      .filter(Boolean);
    const links = $("main a[href]")
      .map((_, a) => {
        try {
          return new URL($(a).attr("href")!, url).href;
        } catch {
          return "";
        }
      })
      .get()
      .filter((u) => {
        const v = new URL(u);
        return (
          v.hostname === "www.cbo.gov" &&
          v.pathname.startsWith("/system/files/") &&
          /\.(xlsx|pdf)$/i.test(v.pathname)
        );
      });
    const workbookUrl = links.find((u) => u.endsWith(".xlsx"));
    let workbook = null;
    if (workbookUrl) {
      const bytes = (await request(workbookUrl, {}, "bytes")) as Uint8Array;
      workbook = {
        ...parseWorkbook(bytes, p.sheet),
        url: workbookUrl,
        sha256: sha256(bytes),
      };
    }
    if (!title || (!summary.length && !workbook))
      throw new DataError(
        "SCHEMA_CHANGED",
        "Official CBO estimate content could not be identified.",
      );
    return {
      status: "live",
      title,
      summary,
      documents: [...new Set(links)],
      workbook,
      source: metadata(
        "Congressional Budget Office · official estimate",
        url,
        "fiscal-estimate",
        "Version and time periods stated in source document",
      ),
      disclaimer:
        "These are official estimates, not actual spending. Original worksheet labels, units, fiscal years, and cached numeric values are preserved. Formulas are never executed; missing cached values remain missing. Different bill versions and baselines must not be added together.",
    };
  });
}
