import { z } from "zod";
import { cached, json, DataError } from "./http";
import {
  fiscalYear,
  metadata,
  pageParam,
  queryParam,
  yearParam,
} from "./model";
export const awardQuery = z.object({
  year: yearParam.default(fiscalYear()),
  page: pageParam.default(1),
  q: queryParam.default(""),
  agency: queryParam.default(""),
  recipient: queryParam.default(""),
  category: z
    .enum(["contracts", "grants", "loans", "payments", "other"])
    .default("contracts"),
  state: z.enum(["", "NJ"]).default(""),
});
const codes = {
  contracts: ["A", "B", "C", "D"],
  grants: ["02", "03", "04", "05", "F001", "F002"],
  loans: ["07", "08", "F003", "F004"],
  payments: ["06", "10", "F006", "F007"],
  other: ["09", "11", "-1", "F005", "F008", "F009", "F010"],
};
const row = z
  .object({
    "Award ID": z.string().nullable(),
    "Recipient Name": z.string().nullable(),
    "Award Amount": z.number().finite().nullable().optional(),
    "Loan Value": z.number().finite().nullable().optional(),
    "Subsidy Cost": z.number().finite().nullable().optional(),
    "Awarding Agency": z.string().nullable(),
    Description: z.string().nullable(),
    "Last Modified Date": z.string().nullable(),
    generated_internal_id: z.string().nullable(),
  })
  .passthrough();
const schema = z.object({
  results: z.array(row),
  page_metadata: z.object({ hasNext: z.boolean(), page: z.number() }),
});
export function awardBody(p: z.infer<typeof awardQuery>) {
  return {
    filters: {
      time_period: [
        { start_date: `${p.year - 1}-10-01`, end_date: `${p.year}-09-30` },
      ],
      award_type_codes: codes[p.category],
      ...(p.q ? { keywords: [p.q] } : {}),
      ...(p.recipient ? { recipient_search_text: [p.recipient] } : {}),
      ...(p.agency
        ? { agencies: [{ type: "awarding", tier: "toptier", name: p.agency }] }
        : {}),
      ...(p.state
        ? {
            place_of_performance_locations: [
              { country: "USA", state: p.state },
            ],
          }
        : {}),
    },
    fields: [
      "Award ID",
      "Recipient Name",
      ...(p.category === "loans"
        ? ["Loan Value", "Subsidy Cost"]
        : ["Award Amount"]),
      "Awarding Agency",
      "Description",
      "Last Modified Date",
    ],
    page: p.page,
    limit: 20,
    sort: p.category === "loans" ? "Loan Value" : "Award Amount",
    order: "desc",
    subawards: false,
  };
}
export async function getAwards(params: URLSearchParams) {
  const p = awardQuery.parse(Object.fromEntries(params));
  return cached(`awards:${JSON.stringify(p)}`, 900000, async () => {
    const endpoint =
      "https://api.usaspending.gov/api/v2/search/spending_by_award/";
    const data = await json(endpoint, schema, {
      method: "POST",
      body: JSON.stringify(awardBody(p)),
    });
    const amountField = p.category === "loans" ? "Loan Value" : "Award Amount";
    if (data.results.some((a) => a[amountField] === undefined))
      throw new DataError(
        "SCHEMA_CHANGED",
        "Official award amount field is missing.",
      );
    return {
      status: "live",
      measureLabel:
        p.category === "loans" ? "Loan face value" : "Award obligations",
      source: metadata(
        "USAspending.gov",
        endpoint,
        p.category === "loans" ? "loan-face-value" : "award-obligation",
        `Federal FY ${p.year} (October–September)`,
      ),
      fiscalYear: p.year,
      page: p.page,
      hasNext: data.page_metadata.hasNext,
      results: data.results.map((a) => ({
        id: a["Award ID"],
        recipient: a["Recipient Name"],
        amount: a[amountField] == null ? null : a[amountField].toFixed(2),
        loanSubsidyCost:
          a["Subsidy Cost"] == null ? null : a["Subsidy Cost"].toFixed(2),
        agency: a["Awarding Agency"],
        description: a.Description,
        updatedAt: a["Last Modified Date"],
        url: a.generated_internal_id
          ? `https://www.usaspending.gov/award/${encodeURIComponent(a.generated_internal_id)}`
          : null,
      })),
      disclaimer:
        "Award amounts are cumulative award-level obligations, not payments within the selected fiscal year. The fiscal-year filter selects awards with activity in that period. Loans display face value and the reported subsidy cost, rather than award obligations; face value is not the government’s expenditure. Do not sum these records with Treasury outlays or NJ expenditures.",
    };
  });
}
