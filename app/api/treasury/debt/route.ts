import {NextResponse} from "next/server";
export const dynamic="force-dynamic";
const endpoint="https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1";
export async function GET(){try{const r=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(12000)});if(!r.ok)return NextResponse.json({status:"unavailable",error:`Upstream HTTP ${r.status}`,source:endpoint},{status:502});const d=await r.json();return NextResponse.json({status:"live",source:endpoint,accessedAt:new Date().toISOString(),records:d.data||[],disclaimer:"Debt is fiscal context, not spending."})}catch{return NextResponse.json({status:"unavailable",error:"Treasury API unavailable",source:endpoint},{status:503})}}
