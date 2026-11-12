import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const base=process.env.SMOKE_BASE_URL??'http://localhost:3000';
const cases:[string,number][]=[
 ['/api/sources/status',200],['/api/treasury/debt',200],['/api/treasury/fiscal?year=2025',200],['/api/treasury/fiscal?year=2026',200],['/api/treasury/fiscal?year=2027',200],
 ['/api/federal/awards?year=2025',200],['/api/federal/awards?year=2025&page=2',200],['/api/federal/awards?year=2025&category=grants&state=NJ',200],['/api/federal/awards?year=2025&agency=Department%20of%20Energy&recipient=Laboratory',200],
 ['/api/nj/finances',200],['/api/nj/finances?kind=revenue',200],['/api/nj/finances?year=2024&page=2&q=health',200],['/api/nj/publications',200],['/api/federal/bill?congress=119&type=hr&number=1',200],['/api/federal/bill?congress=119&type=s&number=1',200],
 ['/api/federal/bills',process.env.CONGRESS_API_KEY?200:503],
 ['/api/federal/awards?year=abc',400],['/api/federal/awards?page=0',400],['/api/nj/finances?year=2100',404],['/api/federal/bill?number=-1',400],['/api/federal/bill?number=1&type=invalid',400],['/api/treasury/fiscal?year=2100',404]
];
async function main(){const report=[];for(const [path,status] of cases){const started=Date.now();try{const r=await fetch(base+path,{signal:AbortSignal.timeout(90000)});const body=await r.json();assert.equal(r.status,status,JSON.stringify(body));if(status===200){if(path.includes('sources/status'))assert.ok(body.sources.length);else{assert.equal(body.status,'live');assert.ok(body.source.retrievedAt);}}
 const row={path,status:r.status,passed:true,durationMs:Date.now()-started,source:body.source?.url,period:body.source?.period,records:body.results?.length,code:body.code};report.push(row);console.log('PASS',path,r.status);
 }catch(e){report.push({path,passed:false,error:e instanceof Error?e.message:String(e)});process.exitCode=1;console.error('FAIL',path,e);}}
 writeFileSync('docs/live-smoke.json',JSON.stringify({checkedAt:new Date().toISOString(),base,report},null,2)+'\n');}
main();
