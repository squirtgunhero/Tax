import { z } from "zod";
import { cached, DataError, json } from "./http";
import {
  amount,
  fiscalYear,
  metadata,
  yearParam,
  decimalCents,
  dollars,
} from "./model";
const root = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/";
export const debtRow = z.object({
  record_date: z.string(),
  tot_pub_debt_out_amt: amount,
  debt_held_public_amt: amount,
  intragov_hold_amt: amount,
});
export async function getDebt() {
  return cached("debt", 900000, async () => {
    const url = `${root}v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1`;
    const d = await json(url, z.object({ data: z.array(debtRow).min(1) }));
    return {
      status: "live",
      source: metadata(
        "Treasury Fiscal Data · Debt to the Penny",
        url,
        "debt-stock",
        d.data[0].record_date,
      ),
      records: d.data,
      disclaimer:
        "Outstanding debt is a stock measured on this date. It is not spending or a fiscal-year deficit.",
    };
  });
}
const fiscalRow = z.object({
  record_date: z.string(),
  record_fiscal_year: z.string(),
  classification_desc: z.string(),
  current_month_budget_amt: z.string(),
  current_fytd_budget_amt: z.string(),
});
export function normalizeFiscal(rows: z.infer<typeof fiscalRow>[]) {
  const find = (label: string) => {
    const matches = rows.filter(
      (r) => r.classification_desc.toLowerCase() === label.toLowerCase(),
    );
    if (
      matches.length !== 1 ||
      !amount.safeParse(matches[0].current_fytd_budget_amt).success
    )
      throw new DataError(
        "SCHEMA_CHANGED",
        `Treasury ${label} total is missing or ambiguous.`,
      );
    return matches[0].current_fytd_budget_amt;
  };
  const revenue = find("Total Receipts"),
    outlays = find("Total Outlays");
  return {
    revenue,
    outlays,
    deficit: dollars(decimalCents(outlays) - decimalCents(revenue)),
  };
}
export async function getFiscal(params: URLSearchParams) {
  const year = yearParam.parse(params.get("year") ?? fiscalYear());
  return cached(`fiscal:${year}`, 900000, async () => {
    const endpoint = `${root}v1/accounting/mts/mts_table_2`;
    const latest = await json(
      `${endpoint}?filter=record_fiscal_year:eq:${year}&sort=-record_date&page[size]=1`,
      z.object({ data: z.array(fiscalRow) }),
    );
    if (!latest.data.length)
      throw new DataError(
        "NO_DATA",
        "Treasury has no published statement for this fiscal year.",
        404,
      );
    const date = latest.data[0].record_date;
    const url = `${endpoint}?filter=record_date:eq:${date}&page[size]=100`;
    const all = await json(
      url,
      z.object({
        data: z.array(fiscalRow),
        meta: z.object({ "total-pages": z.number() }),
      }),
    );
    if (all.meta["total-pages"] !== 1)
      throw new DataError(
        "SCHEMA_CHANGED",
        "Treasury table exceeds expected page size.",
      );
    const totals = normalizeFiscal(all.data);
    const [receipts, spending] = await Promise.all([
      getBreakdown(date, 4),
      getBreakdown(date, 5),
    ]);
    for (const [items, total] of [
      [receipts.results, totals.revenue],
      [spending.results, totals.outlays],
    ] as const) {
      if (
        items.reduce((sum, r) => sum + decimalCents(r.amount), 0n) !==
        decimalCents(total)
      )
        throw new DataError(
          "RECONCILIATION_FAILED",
          "Treasury categories do not reconcile with reported total.",
        );
    }
    return {
      status: "live",
      fiscalYear: year,
      recordDate: date,
      ...totals,
      receipts: receipts.results,
      spending: spending.results,
      breakdownSources: [receipts.url, spending.url],
      source: metadata(
        "Treasury · Monthly Treasury Statement, Table 2",
        url,
        "actual-cash-flow",
        `${year - 1}-10-01 through ${date}`,
      ),
      disclaimer:
        "Fiscal-year-to-date actual receipts and outlays in USD. Positive deficit means outlays exceed receipts. Estimates in this table are excluded. Federal fiscal years begin October 1.",
    };
  });
}

const breakdownRow = z.object({
  classification_desc: z.string(),
  classification_id: z.string(),
  parent_id: z.string(),
  sequence_level_nbr: z.string(),
  data_type_cd: z.string(),
  current_fytd_net_rcpt_amt: z.string().optional(),
  current_fytd_net_outly_amt: z.string().optional(),
});
export function normalizeBreakdown(
  rows: z.infer<typeof breakdownRow>[],
  field: "current_fytd_net_rcpt_amt" | "current_fytd_net_outly_amt",
) {
  const roots = rows.filter(
    (r) =>
      r.parent_id === "null" &&
      r.sequence_level_nbr === "1" &&
      r.data_type_cd !== "T",
  );
  return roots.map((root) => {
    const children = rows.filter(
      (r) =>
        r.parent_id === root.classification_id &&
        r.data_type_cd === "T" &&
        r.sequence_level_nbr === "2",
    );
    const chosen = amount.safeParse(root[field]).success
      ? root
      : children.length === 1
        ? children[0]
        : undefined;
    if (!chosen || !amount.safeParse(chosen[field]).success)
      throw new DataError(
        "SCHEMA_CHANGED",
        "Treasury category total missing or ambiguous.",
      );
    return {
      name: root.classification_desc.replace(/:$/, ""),
      amount: chosen[field]!,
    };
  });
}
export async function getBreakdown(date: string, table: 4 | 5) {
  const url = `${root}v1/accounting/mts/mts_table_${table}?filter=record_date:eq:${date}&page[size]=1000`;
  const data = await json(
    url,
    z.object({
      data: z.array(breakdownRow),
      meta: z.object({ "total-pages": z.number() }),
    }),
  );
  if (data.meta["total-pages"] !== 1)
    throw new DataError(
      "PAGE_LIMIT",
      "Treasury category table exceeds safe page size.",
    );
  return {
    results: normalizeBreakdown(
      data.data,
      table === 4 ? "current_fytd_net_rcpt_amt" : "current_fytd_net_outly_amt",
    ),
    url,
  };
}
