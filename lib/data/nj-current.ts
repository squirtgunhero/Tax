import { z } from "zod";
import { cached, DataError, json } from "./http";
import { amount, decimalCents, metadata, pageParam, queryParam } from "./model";
const expenditure = z.object({
  budget_fiscal_year: z.string(),
  fy_through_date: z.string(),
  ibno_agency: z.string(),
  expenditure_desc: z.string(),
  organization_name: z.string(),
  statewide_program: z.string(),
  funding_category: z.string(),
  expenditure_category: z.string(),
  payee_name: z.string(),
  obligation_amt: amount,
  expended_amt: amount,
  ytd_amt: amount,
});
const revenue = z
  .object({
    accounting_fiscal_year: z.string(),
    month_ending_date: z.string(),
    department_agency_desc: z.string(),
    revenue_type_desc: z.string(),
    revenue_fund_desc: z.string(),
    revenue_desc: z.string(),
    ytd_amt: amount,
  })
  .passthrough();
const quote = (s: string) => `'${s.replaceAll("'", "''")}'`;
export function reconcileNJCurrent(r: z.infer<typeof expenditure>) {
  if (
    decimalCents(r.obligation_amt) + decimalCents(r.expended_amt) !==
    decimalCents(r.ytd_amt)
  )
    throw new DataError(
      "RECONCILIATION_FAILED",
      "NJ expenditure components do not reconcile with the publisher’s YTD amount.",
    );
  return r;
}
export async function getNJCurrent(params: URLSearchParams) {
  const p = z
    .object({
      kind: z.enum(["expenditure", "revenue"]).default("expenditure"),
      q: queryParam.default(""),
      agency: queryParam.default(""),
      page: pageParam.default(1),
    })
    .parse(Object.fromEntries(params));
  return cached(`nj-current:${JSON.stringify(p)}`, 900000, async () => {
    const exp = p.kind === "expenditure",
      id = exp ? "apet-rp2i" : "k9iw-i8yt",
      endpoint = `https://data.nj.gov/resource/${id}.json`,
      year = exp ? "budget_fiscal_year" : "accounting_fiscal_year",
      date = exp ? "fy_through_date" : "month_ending_date",
      agency = exp ? "ibno_agency" : "department_agency_desc",
      search = exp ? "payee_name" : "revenue_desc";
    const latest = await json(
      `${endpoint}?${new URLSearchParams({ $select: `${year},${date}`, $order: `${year} DESC,${date} DESC`, $limit: "1" })}`,
      z.array(z.record(z.string(), z.string())).min(1),
    );
    const fy = latest[0][year],
      through = latest[0][date];
    if (!/^\d{4}$/.test(fy) || !/^\d{4}-\d{2}-\d{2}T/.test(through))
      throw new DataError("SCHEMA_CHANGED", "NJ reporting period is invalid.");
    const where = [
      `${year}=${fy}`,
      `${date}=${quote(through)}`,
      p.agency ? `${agency}=${quote(p.agency)}` : "",
      p.q
        ? `upper(${search}) like ${quote("%" + p.q.toUpperCase().replaceAll("%", "").replaceAll("_", "") + "%")}`
        : "",
    ]
      .filter(Boolean)
      .join(" AND ");
    const aggregate = exp
      ? "sum(expended_amt) as expended,sum(obligation_amt) as obligated,sum(ytd_amt) as combined,count(*) as count"
      : "sum(ytd_amt) as revenue,count(*) as count";
    const rowQuery = new URLSearchParams({
      $where: where,
      $order: `${exp ? "expended_amt" : "ytd_amt"} DESC,:id`,
      $limit: "21",
      $offset: String((p.page - 1) * 20),
    });
    const [raw, totals, meta] = await Promise.all([
      json(
        `${endpoint}?${rowQuery}`,
        z.array(z.record(z.string(), z.string())),
      ),
      json(
        `${endpoint}?${new URLSearchParams({ $where: where, $select: aggregate })}`,
        z.array(z.record(z.string(), z.string())).length(1),
      ),
      json(
        `https://data.nj.gov/api/views/${id}.json`,
        z.object({ name: z.string(), rowsUpdatedAt: z.number() }),
      ),
    ]);
    const results = raw.slice(0, 20).map((r) => {
      if (exp) {
        const value = expenditure.safeParse(r);
        if (!value.success)
          throw new DataError(
            "SCHEMA_CHANGED",
            "NJ expenditure fields changed.",
          );
        const a = reconcileNJCurrent(value.data);
        return {
          agency: a.ibno_agency,
          category: a.expenditure_category,
          description: a.expenditure_desc,
          recipient: a.payee_name,
          fund: a.funding_category,
          program: a.statewide_program,
          expended: a.expended_amt,
          obligated: a.obligation_amt,
          revenue: null,
        };
      }
      const value = revenue.safeParse(r);
      if (!value.success)
        throw new DataError("SCHEMA_CHANGED", "NJ revenue fields changed.");
      const a = value.data;
      return {
        agency: a.department_agency_desc,
        category: a.revenue_type_desc,
        description: a.revenue_desc,
        recipient: null,
        fund: a.revenue_fund_desc,
        program: null,
        expended: null,
        obligated: null,
        revenue: a.ytd_amt,
      };
    });
    const count = z.coerce.number().int().nonnegative().parse(totals[0].count);
    const sum = (field: string) =>
      count === 0 ? "0.00" : amount.parse(totals[0][field]);
    const summary = exp
      ? {
          expended: sum("expended"),
          obligated: sum("obligated"),
          revenue: null,
        }
      : { expended: null, obligated: null, revenue: sum("revenue") };
    if (
      exp &&
      decimalCents(summary.expended!) + decimalCents(summary.obligated!) !==
        decimalCents(sum("combined"))
    )
      throw new DataError(
        "RECONCILIATION_FAILED",
        "NJ aggregate components do not reconcile.",
      );
    return {
      status: "live",
      kind: p.kind,
      fiscalYear: Number(fy),
      throughDate: through.slice(0, 10),
      page: p.page,
      hasNext: raw.length > 20,
      count,
      summary,
      results,
      source: metadata(
        "NJ OMB · " + meta.name,
        `https://data.nj.gov/d/${id}`,
        exp ? "reported-expended-and-obligated" : "reported-revenue",
        `NJ FY ${fy}, through ${through.slice(0, 10)}`,
        { updatedAt: new Date(meta.rowsUpdatedAt * 1000).toISOString() },
      ),
      disclaimer:
        "Amounts are reported by OMB, not independently matched to bank settlements. Expended amounts and obligations are separate fields; their sum is checked against OMB’s combined YTD figure. Closing/adjustment periods can change the data. This agency scope is not a statewide audited total and must not be added to the historical summary, procurement, or federal datasets.",
    };
  });
}
