import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetch as upstreamFetch, Response } from 'undici';
import { cached, DataError, request } from '../lib/data/http';
import { decimalCents, dollars } from '../lib/data/model';
import { awardBody, awardQuery } from '../lib/data/awards';
import { normalizeFiscal, normalizeBreakdown } from '../lib/data/treasury';
import { normalizeNJ } from '../lib/data/nj';
import { normalizeBill, officialUrl } from '../lib/data/bills';
const fixture = (name:string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url),'utf8');

test('decimal accounting preserves cents beyond safe floating point integers and negative offsets',()=>{
 const a='9007199254740993.01';assert.equal(dollars(decimalCents(a)+decimalCents('0.09')),'9007199254740993.10');
 assert.equal(dollars(decimalCents('-12.01')+decimalCents('10.00')),'-2.01');
 assert.throws(()=>decimalCents('1e6'));assert.throws(()=>decimalCents('1.001'));
});
test('award filters use fiscal activity window, official codes and server-side agency/recipient/location schemas',()=>{
 const q=awardQuery.parse({year:2025,agency:'Department of Energy',recipient:'Laboratory',state:'NJ',category:'grants',page:2});const b=awardBody(q);
 assert.deepEqual(b.filters.time_period,[{start_date:'2024-10-01',end_date:'2025-09-30'}]);assert.deepEqual(b.filters.award_type_codes,['02','03','04','05']);
 assert.deepEqual(b.filters.recipient_search_text,['Laboratory']);assert.deepEqual(b.filters.place_of_performance_locations,[{country:'USA',state:'NJ'}]);assert.equal(b.page,2);
 assert.throws(()=>awardQuery.parse({year:'invalid'}));assert.throws(()=>awardQuery.parse({page:0}));assert.throws(()=>awardQuery.parse({q:'a'.repeat(101)}));
});
test('Treasury uses actual totals only; ambiguous or missing totals fail closed',()=>{
 const row=(classification_desc:string,current_fytd_budget_amt:string)=>({classification_desc,current_fytd_budget_amt,record_date:'2025-09-30',record_fiscal_year:'2025',current_month_budget_amt:'0'});
 const rows=[row('Total Receipts','10.01'),row('Total Outlays','20.05'),row('On-Budget Outlays','18.00')];
 assert.deepEqual(normalizeFiscal(rows),{revenue:'10.01',outlays:'20.05',deficit:'10.04'});
 assert.throws(()=>normalizeFiscal([...rows,rows[0]]));assert.throws(()=>normalizeFiscal([rows[0]]));
});
test('captured Treasury categories reconcile without counting nested subtotals',()=>{
 const receipts=normalizeBreakdown(JSON.parse(fixture('mts4.json')),'current_fytd_net_rcpt_amt');const outlays=normalizeBreakdown(JSON.parse(fixture('mts5.json')),'current_fytd_net_outly_amt');
 assert.equal(receipts.reduce((s,r)=>s+decimalCents(r.amount),0n),decimalCents('368940118602.77'));
 assert.equal(outlays.reduce((s,r)=>s+decimalCents(r.amount),0n),decimalCents('773003666480.36'));
 assert.ok(outlays.some(r=>r.name==='Undistributed Offsetting Receipts'&&decimalCents(r.amount)<0n));
});
test('NJ validates complete-year columns and retains federal transfer labeling',()=>{
 const row={ibno_agency:'HEALTH',expenditure_category:'GRANTS',funding_category:'FEDERAL FUNDS',statewide_program:'PUBLIC HEALTH',fy_2025:'123.45'};
 assert.equal(normalizeNJ(row,'expenditure',2025).federalFunding,true);assert.equal(normalizeNJ(row,'expenditure',2025).amount,'123.45');
 assert.throws(()=>normalizeNJ(row,'expenditure',2026));assert.throws(()=>normalizeNJ({...row,fy_2025:'null'},'expenditure',2025));
});
test('real bill fixture retains enactment, sponsors, version-specific CBO estimates and unique vote references',()=>{
 const bill=normalizeBill(fixture('bill-119hr1.xml'));assert.equal(bill.number,'1');assert.match(bill.latestAction.text,/Public Law/);assert.equal(bill.sponsors[0].bioguideId,'A000375');
 assert.ok(bill.estimates.some(e=>e.url==='https://www.cbo.gov/publication/61461'));assert.ok(bill.votes.some(v=>v.url==='https://clerk.house.gov/evs/2025/roll190.xml'));
 assert.equal(new Set(bill.votes.map(v=>`${v.chamber}:${v.sessionNumber}:${v.rollNumber}`)).size,bill.votes.length);
 assert.equal(bill.originalTextUrl,null);assert.throws(()=>normalizeBill('<billStatus/>'));assert.throws(()=>normalizeBill('<!DOCTYPE a><billStatus/>'));
 assert.equal(officialUrl('https://evil.gov.example.com'),null);assert.equal(officialUrl('javascript:alert(1)'),null);
});
test('HTTP retries transient errors, respects Retry-After, and never retries permanent errors',async()=>{
 let calls=0;const delays:number[]=[];
 const transport=(async()=>{calls++;return calls<3?new Response('',{status:429,headers:{'retry-after':'1'}}):new Response('{"ok":true}');}) as typeof upstreamFetch;
 assert.deepEqual(await request('https://example.gov',{},false,transport,async ms=>{delays.push(ms)}),{ok:true});assert.equal(calls,3);assert.deepEqual(delays,[1000,1000]);
 calls=0;const bad=(async()=>{calls++;return new Response('',{status:400});}) as typeof upstreamFetch;
 await assert.rejects(request('https://example.gov',{},false,bad),e=>e instanceof DataError&&e.code==='UPSTREAM_400');assert.equal(calls,1);
 const slow=(async()=>new Response('',{status:429,headers:{'retry-after':'120'}})) as typeof upstreamFetch;await assert.rejects(request('https://example.gov',{},false,slow),e=>e instanceof DataError&&e.code==='RATE_LIMITED');
 const malformed=(async()=>new Response('<html/>')) as typeof upstreamFetch;await assert.rejects(request('https://example.gov',{},false,malformed),e=>e instanceof DataError&&e.code==='INVALID_JSON');
});
test('cache coalesces requests, preserves values and does not cache failures',async()=>{
 let n=0;const key=`test-${Date.now()}`;const loader=async()=>{n++;return {at:Date.now()}};
 const [a,b]=await Promise.all([cached(key,1000,loader),cached(key,1000,loader)]);assert.equal(n,1);assert.deepEqual(a,b);
 let failed=0;const fail=async()=>{failed++;throw Error('offline')};await assert.rejects(cached('failure',1000,fail));await assert.rejects(cached('failure',1000,fail));assert.equal(failed,2);
});
