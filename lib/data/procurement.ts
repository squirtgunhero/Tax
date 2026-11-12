import { z } from "zod";
import { cached, json, DataError } from "./http";
import { amount, metadata, pageParam, queryParam } from "./model";
const endpoint = "https://data.nj.gov/resource/ubnu-tqu7.json";
const row = z.object({
  fiscal_year: z.string(),
  fy_through_date: z.string(),
  department_agency_desc: z.string(),
  commodity_sector_desc: z.string(),
  vendor_name: z.string(),
  ytd_amt: amount,
});
const sql = (value: string) => `'${value.replaceAll("'", "''")}'`;
export async function getProcurement(params: URLSearchParams) {
  const p = z
    .object({
      page: pageParam.default(1),
      q: queryParam.default(""),
      agency: queryParam.default(""),
      category: queryParam.default(""),
      year: z.coerce.number().int().min(2000).max(2100).optional(),
    })
    .parse(Object.fromEntries(params));
  return cached(`procurement:v2:${JSON.stringify(p)}`, 900000, async () => {
    const periods = await json(
      `${endpoint}?${new URLSearchParams({ $select: "fiscal_year", $group: "fiscal_year", $order: "fiscal_year DESC", $limit: "100" })}`,
      z.array(z.object({ fiscal_year: z.string().regex(/^[0-9]{4}$/) })).min(1),
    );
    const year = p.year ?? Number(periods[0].fiscal_year);
    if (!periods.some((r) => Number(r.fiscal_year) === year))
      throw new DataError(
        "YEAR_UNAVAILABLE",
        "Requested procurement year is unavailable.",
        404,
      );
    const where = [
      `fiscal_year=${year}`,
      p.q
        ? `upper(vendor_name) like ${sql("%" + p.q.toUpperCase().replaceAll("%", "").replaceAll("_", "") + "%")}`
        : "",
      p.agency ? `department_agency_desc=${sql(p.agency)}` : "",
      p.category ? `commodity_sector_desc=${sql(p.category)}` : "",
    ]
      .filter(Boolean)
      .join(" AND ");
    const query = new URLSearchParams({
      $limit: "21",
      $offset: String((p.page - 1) * 20),
      $order:
        "ytd_amt DESC,department_agency_desc,commodity_sector_desc,vendor_name",
      ...(where ? { $where: where } : {}),
    });
    const [rows, meta] = await Promise.all([
      json(`${endpoint}?${query}`, z.array(row)),
      json(
        "https://data.nj.gov/api/views/ubnu-tqu7.json",
        z.object({
          name: z.string(),
          description: z.string(),
          rowsUpdatedAt: z.number(),
        }),
      ),
    ]);
    return {
      status: "live",
      fiscalYear: year,
      years: periods.map((r) => Number(r.fiscal_year)),
      page: p.page,
      hasNext: rows.length > 20,
      results: rows.slice(0, 20).map((r) => ({
        agency: r.department_agency_desc,
        category: r.commodity_sector_desc,
        vendor: r.vendor_name,
        amount: r.ytd_amt,
        fiscalYear: r.fiscal_year,
        throughDate: r.fy_through_date,
      })),
      source: metadata(
        "NJ Division of Purchase and Property · " + meta.name,
        "https://data.nj.gov/d/ubnu-tqu7",
        "purchasing-commitments-and-payments",
        rows[0]
          ? `FY ${rows[0].fiscal_year}, through ${rows[0].fy_through_date}`
          : "No matching records",
        {
          updatedAt: new Date(meta.rowsUpdatedAt * 1000).toISOString(),
          description: meta.description,
        },
      ),
      disclaimer:
        "Purchasing includes amounts paid, obligations to vendors, and amounts set aside for imminent purchases. This is not a payment-only feed or an individual contract register. Do not sum with NJ expenditures or federal awards. Authority purchasing is excluded by the publisher.",
    };
  });
}
