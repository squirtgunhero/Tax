import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { zipSync, strToU8 } from "fflate";
import { estimateIncomeTax } from "../lib/tax";
import {
  activeCongress,
  selectCongressLayer,
  parseMembers,
} from "../lib/data/representatives";
import { archiveFiles, csvRows, njDocument } from "../lib/data/nj-legislation";
import { normalizeDirectory } from "../lib/data/discovery";
import { approvedPDF, parseWorkbook } from "../lib/data/documents";
import { reconcileNJCurrent } from "../lib/data/nj-current";
import {
  saveSnapshot,
  readSnapshot,
  sha256,
  parseSnapshot,
} from "../lib/data/storage";

test("2026 tax illustration matches every published single/joint bracket base and standard deduction", () => {
  for (const [gross, tax] of [
    ["16100", "0.00"],
    ["28500", "1240.00"],
    ["66500", "5800.00"],
    ["121800", "17966.00"],
    ["217875", "41024.00"],
    ["272325", "58448.00"],
    ["656700", "192979.25"],
  ])
    assert.equal(estimateIncomeTax(gross, "single").estimatedTax, tax);
  assert.equal(estimateIncomeTax("57000", "joint").estimatedTax, "2480.00");
  assert.equal(estimateIncomeTax("800900", "joint").estimatedTax, "206583.50");
  assert.equal(estimateIncomeTax("0", "single").estimatedTax, "0.00");
  assert.throws(() => estimateIncomeTax("-1", "single"));
  assert.throws(() => estimateIncomeTax("1e6", "single"));
});
test("Congress boundaries select active term, never a future layer from Census", () => {
  assert.equal(activeCongress(new Date("2027-01-03T16:59:59Z")), 119);
  assert.equal(activeCongress(new Date("2027-01-03T17:00:00Z")), 120);
  assert.equal(
    selectCongressLayer(
      [
        { id: 0, name: "120th Congressional Districts" },
        { id: 4, name: "119th Congressional Districts" },
      ],
      119,
    ).id,
    4,
  );
  assert.throws(() => selectCongressLayer([], 119));
});
test("official CSV preserves multiline quoted values and missing vote choices", () => {
  const rows = csvRows(
    new TextEncoder().encode(
      '"Bill","Full_Name","Legislator_Vote","Note"\r\n"A794","O\'Scanlon, Declan J.",,"line one\r\nline two"\r\n',
    ),
  );
  assert.equal(rows[0].Full_Name, "O'Scanlon, Declan J.");
  assert.equal(rows[0].Legislator_Vote, "");
  assert.equal(rows[0].Note, "line one\r\nline two");
  assert.throws(() => csvRows(new TextEncoder().encode("a,b\n1,2,3")));
});
test("NJ fiscal documents map only a recognized official session path; modified display number is not an ID", () => {
  const bill = JSON.parse(
    readFileSync(new URL("./fixtures/nj-A425.json", import.meta.url), "utf8"),
  );
  assert.notEqual(bill.ActualBillNumber, "A425");
  assert.equal(bill.BillType.trim() + bill.BillNumber, "A425");
  const row = {
    Document: "\\\\NJOLS7\\LEGAPPS$\\2026BILL\\A0500\\425_E1.DOCX",
    DocType: "FE",
    Comment: "as introduced",
    Pages: "3",
    ModDate: "8/7/2026",
  };
  assert.equal(
    njDocument(row, 2026).url,
    "https://pub.njleg.gov/Bills/2026/A0500/425_E1.PDF",
  );
  assert.equal(njDocument(row, 2024).url, null);
  assert.equal(
    njDocument({ ...row, Document: "https://evil.example/file" }, 2026).url,
    null,
  );
});
test("archive parser ignores unapproved members and rejects invalid archives", () => {
  const zipped = zipSync({
    "MAINBILL.TXT": strToU8("a,b\n1,2"),
    "../private.txt": strToU8("private"),
  });
  assert.deepEqual(Object.keys(archiveFiles(zipped, /^MAINBILL\.TXT$/)), [
    "MAINBILL.TXT",
  ]);
  assert.throws(() => archiveFiles(strToU8("not a zip"), /.*/));
});
test("current NJ expended and obligated components must reconcile, including negative adjustments", () => {
  const row = {
    budget_fiscal_year: "2027",
    fy_through_date: "2026-09-30",
    ibno_agency: "HEALTH",
    expenditure_desc: "test",
    organization_name: "test",
    statewide_program: "test",
    funding_category: "FEDERAL",
    expenditure_category: "GRANTS",
    payee_name: "test",
    obligation_amt: "-10.00",
    expended_amt: "100.01",
    ytd_amt: "90.01",
  };
  assert.equal(reconcileNJCurrent(row).expended_amt, "100.01");
  assert.throws(() => reconcileNJCurrent({ ...row, ytd_amt: "100.01" }));
});
test("GovInfo discovery preserves directory modification ordering and rejects external links", () => {
  const html =
    '<table><tr data-name="BILLSTATUS-119hr1.xml"><td><a href="/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr1.xml">1</a></td><td data-label="Last Modified (GMT)">12-Nov-2026 10:00</td></tr><tr data-name="BILLSTATUS-119hr2.xml"><td><a href="https://evil.example/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr2.xml">2</a></td><td data-label="Last Modified (GMT)">12-Nov-2026 11:00</td></tr></table>';
  const rows = normalizeDirectory(html, 119, "hr");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].modifiedAt, "2026-11-12T10:00:00.000Z");
  assert.throws(() => normalizeDirectory("<html/>", 119, "hr"));
});
test("document allowlist rejects SSRF, redirects in query strings, and nonofficial publishers", () => {
  assert.equal(
    approvedPDF("https://www.irs.gov/pub/irs-drop/rp-25-32.pdf"),
    "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf",
  );
  for (const url of [
    "http://127.0.0.1/secret.pdf",
    "https://www.nj.gov.evil.example/treasury/omb/publications/x.pdf",
    "https://www.nj.gov/treasury/omb/publications/x.pdf?redirect=https://evil.example",
    "https://www.nj.gov/treasury/omb/publications/../../../x.pdf",
  ])
    assert.throws(() => approvedPDF(url));
});
test("workbook parser preserves cached values and missing cells, never executes formulas", () => {
  const files = {
    "xl/workbook.xml": strToU8(
      '<workbook><sheets><sheet name="Summary" r:id="r1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Billions of dollars</t></is></c><c r="B1"><f>1+1</f><v>2</v></c><c r="C1"><f>EXTERNAL()</f></c></row></sheetData></worksheet>',
    ),
  };
  const sheet = parseWorkbook(zipSync(files));
  assert.equal(sheet.rows[0].cells[0].value, "Billions of dollars");
  assert.equal(sheet.rows[0].cells[1].value, "2");
  assert.equal(sheet.rows[0].cells[2].value, null);
});
test("snapshots survive a separate process and reject checksum corruption", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ledger-store-"));
  const previous = process.env.LEDGER_DATA_DIR;
  process.env.LEDGER_DATA_DIR = directory;
  try {
    const s = await saveSnapshot(
      "test:durable",
      { amount: "123.45", source: { retrievedAt: "2026-11-12T00:00:00Z" } },
      10000,
    );
    assert.equal((await readSnapshot("test:durable"))?.sha256, s.sha256);
    assert.throws(() =>
      parseSnapshot(
        JSON.stringify({ ...s, value: { amount: "999" } }),
        "test:durable",
      ),
    );
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        "import {readSnapshot} from './lib/data/storage.ts'; const s=await readSnapshot('test:durable'); process.stdout.write(JSON.stringify(s?.value));",
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, LEDGER_DATA_DIR: directory },
        encoding: "utf8",
      },
    );
    assert.equal(JSON.parse(output).amount, "123.45");
  } finally {
    if (previous === undefined) delete process.env.LEDGER_DATA_DIR;
    else process.env.LEDGER_DATA_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
test("official IRS fixture has the verified source checksum", () => {
  const bytes = readFileSync(
    new URL("./fixtures/irs-rp-25-32.pdf", import.meta.url),
  );
  assert.equal(
    sha256(bytes),
    "e9ada115fb43a4af5ea326ca91edd40ab0bf29b9be01d2c13d7b8fa96214635b",
  );
});

test("purchasing records retain missing official amounts as unknown rather than zero", async () => {
  const { normalizePurchase } = await import("../lib/data/procurement");
  const row = {
    fiscal_year: "2026",
    fy_through_date: "30-Jun-26",
    department_agency_desc: "CORRECTIONS",
    commodity_sector_desc: "Radio Communication",
    vendor_name: "MO",
  };
  assert.equal(normalizePurchase(row).amount, null);
  assert.equal(normalizePurchase({ ...row, ytd_amt: "0" }).amount, "0");
  assert.throws(() => normalizePurchase({ ...row, ytd_amt: "unreported" }));
});
