import { z } from 'zod';
import { cached, DataError, json } from './http';
import { amount, decimalCents, dollars, metadata, pageParam, queryParam } from './model';
const ids = { expenditure: 'whpi-savb', revenue: 'sk3g-zv89' };
const query = z.object({ kind: z.enum(['expenditure','revenue']).default('expenditure'), year: z.coerce.number().int().min(2003).max(2100).optional(), page: pageParam.default(1), q: queryParam.default(''), agency: queryParam.default(''), category: queryParam.default('') });
const metaSchema = z.object({ name: z.string(), description: z.string(), rowsUpdatedAt: z.number(), columns: z.array(z.object({ fieldName: z.string() })) });
const rawSchema = z.array(z.record(z.string(), z.string()));
export type NJRow = { id: string; agency: string; category: string; fund: string; program: string | null; amount: string; federalFunding: boolean };
export function normalizeNJ(row: Record<string,string>, kind: 'expenditure' | 'revenue', year: number): NJRow {
  const money = row[`fy_${year}`];
  if (!amount.safeParse(money).success) throw new DataError('SCHEMA_CHANGED', 'NJ expenditure/revenue amount is missing or invalid.');
  const fields = kind === 'expenditure' ? ['ibno_agency','expenditure_category','funding_category','statewide_program'] : ['department_agency_desc','revenue_type_desc','revenue_fund_desc'];
  if (fields.some(k => !row[k])) throw new DataError('SCHEMA_CHANGED', 'NJ classification is missing.');
  return { id: fields.map(f => row[f]).join('|'), agency: row[fields[0]], category: row[fields[1]], fund: row[fields[2]], program: kind === 'expenditure' ? row.statewide_program : null, amount: dollars(decimalCents(money)), federalFunding: fields.some(f => row[f].toUpperCase().includes('FEDERAL')) };
}
async function snapshot(kind: 'expenditure' | 'revenue', requestedYear?: number) {
  return cached(`nj:${kind}:${requestedYear ?? 'latest'}`, 900000, async () => {
    const id = ids[kind];
    const meta = await json(`https://data.nj.gov/api/views/${id}.json`, metaSchema);
    const years = meta.columns.map(c => /^fy_(\d{4})$/.exec(c.fieldName)?.[1]).filter(Boolean).map(Number).sort((a,b) => b-a);
    const year = requestedYear ?? years[0];
    if (!years.includes(year)) throw new DataError('YEAR_UNAVAILABLE', `NJ complete-year data is available for ${years[years.length-1]}–${years[0]}.`, 404);
    const fields = kind === 'expenditure' ? ['ibno_agency','expenditure_category','funding_category','statewide_program'] : ['department_agency_desc','revenue_type_desc','revenue_fund_desc'];
    const rows: NJRow[] = [];
    for (let page = 0; page < 20; page++) {
      const params = new URLSearchParams({ '$select': [...fields, `fy_${year}`].join(','), '$order': fields.join(','), '$limit': '1000', '$offset': String(page * 1000) });
      const data = await json(`https://data.nj.gov/resource/${id}.json?${params}`, rawSchema);
      rows.push(...data.map(r => normalizeNJ(r, kind, year)));
      if (data.length < 1000) {
        if (new Set(rows.map(r=>r.id)).size !== rows.length) throw new DataError('DUPLICATE_ROWS', 'NJ summary contains duplicate classifications.');
        return { rows, years, year, source: metadata(`NJ OMB · ${meta.name}`, `https://data.nj.gov/d/${id}`, kind === 'expenditure' ? 'actual-expenditure' : 'actual-revenue', `NJ FY ${year} (${year-1}-07-01 through ${year}-06-30)`, { updatedAt: new Date(meta.rowsUpdatedAt * 1000).toISOString(), description: meta.description }) };
      }
    }
    throw new DataError('PAGE_LIMIT', 'NJ dataset exceeds safe ingestion limit; no partial totals returned.');
  });
}
export async function getNJ(params: URLSearchParams) {
  const p = query.parse(Object.fromEntries(params));
  const data = await snapshot(p.kind, p.year);
  const filtered = data.rows.filter(r => (!p.agency || r.agency === p.agency) && (!p.category || r.category === p.category) && (!p.q || [r.agency,r.category,r.fund,r.program].join(' ').toLowerCase().includes(p.q.toLowerCase())));
  const sorted = filtered.sort((a,b) => { const x = decimalCents(b.amount)-decimalCents(a.amount);return x > 0n ? 1 : x < 0n ? -1 : a.id.localeCompare(b.id); });
  const sum = (rows: NJRow[]) => dollars(rows.reduce((a,r) => a + decimalCents(r.amount), 0n));
  return { status: 'live', kind: p.kind, fiscalYear: data.year, years: data.years, source: data.source, page: p.page, hasNext: p.page * 20 < sorted.length, count: sorted.length, total: sum(filtered), federalFundingSubtotal: sum(filtered.filter(r=>r.federalFunding)), agencies: [...new Set(data.rows.map(r=>r.agency))].sort(), categories: [...new Set(data.rows.map(r=>r.category))].sort(), results: sorted.slice((p.page-1)*20, p.page*20), disclaimer: 'OMB agency summary only; excludes the separate authority datasets. NJ fiscal years begin July 1. Federal-funded state activity can overlap federal outlays and awards. Jurisdictions and accounting measures are never combined into a grand total. Federal-funding subtotal identifies source labels, not a reconciliation of intergovernmental transfers.' };
}
