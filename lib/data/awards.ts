import { z } from 'zod';
import { cached, json } from './http';
import { fiscalYear, metadata, pageParam, queryParam, yearParam } from './model';
export const awardQuery = z.object({ year: yearParam.default(fiscalYear()), page: pageParam.default(1), q: queryParam.default(''), agency: queryParam.default(''), recipient: queryParam.default(''), category: z.enum(['contracts', 'grants', 'loans', 'other']).default('contracts'), state: z.enum(['', 'NJ']).default('') });
const codes = { contracts: ['A','B','C','D'], grants: ['02','03','04','05'], loans: ['07','08'], other: ['06','09','10','11'] };
const row = z.object({ 'Award ID': z.string().nullable(), 'Recipient Name': z.string().nullable(), 'Award Amount': z.number().finite().nullable(), 'Awarding Agency': z.string().nullable(), Description: z.string().nullable(), 'Last Modified Date': z.string().nullable(), generated_internal_id: z.string().nullable() }).passthrough();
const schema = z.object({ results: z.array(row), page_metadata: z.object({ hasNext: z.boolean(), page: z.number() }) });
export function awardBody(p: z.infer<typeof awardQuery>) {
  return { filters: { time_period: [{ start_date: `${p.year - 1}-10-01`, end_date: `${p.year}-09-30` }], award_type_codes: codes[p.category], ...(p.q ? { keywords: [p.q] } : {}), ...(p.recipient ? { recipient_search_text: [p.recipient] } : {}), ...(p.agency ? { agencies: [{ type: 'awarding', tier: 'toptier', name: p.agency }] } : {}), ...(p.state ? { place_of_performance_locations: [{ country: 'USA', state: p.state }] } : {}) }, fields: ['Award ID','Recipient Name','Award Amount','Awarding Agency','Description','Last Modified Date'], page: p.page, limit: 20, sort: 'Award Amount', order: 'desc', subawards: false };
}
export async function getAwards(params: URLSearchParams) {
  const p = awardQuery.parse(Object.fromEntries(params));
  return cached(`awards:${JSON.stringify(p)}`, 900000, async () => {
    const endpoint = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';
    const data = await json(endpoint, schema, { method: 'POST', body: JSON.stringify(awardBody(p)) });
    return { status: 'live', source: metadata('USAspending.gov', endpoint, p.category === 'loans' ? 'loan-award' : 'award-obligation', `Federal FY ${p.year} (October–September)`), fiscalYear: p.year, page: p.page, hasNext: data.page_metadata.hasNext, results: data.results.map(a => ({ id: a['Award ID'], recipient: a['Recipient Name'], amount: a['Award Amount'] === null ? null : a['Award Amount'].toFixed(2), agency: a['Awarding Agency'], description: a.Description, updatedAt: a['Last Modified Date'], url: a.generated_internal_id ? `https://www.usaspending.gov/award/${encodeURIComponent(a.generated_internal_id)}` : null })), disclaimer: 'Award amounts are cumulative award-level obligations, not payments within the selected fiscal year. The fiscal-year filter selects awards with activity in that period. Loan values have different accounting treatment. Do not sum these records with Treasury outlays or NJ expenditures.' };
  });
}
