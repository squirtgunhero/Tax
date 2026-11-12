import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const endpoint="https://api.usaspending.gov/api/v2/search/spending_by_award/";
export async function GET(req:NextRequest){
 const year=Number(req.nextUrl.searchParams.get("year")||2025);
 if(!Number.isInteger(year)||year<2008||year>2100)return NextResponse.json({error:"Invalid fiscal year"},{status:400});
 const body={filters:{time_period:[{start_date:`${year-1}-10-01`,end_date:`${year}-09-30`}],award_type_codes:["A","B","C","D"]},fields:["Award ID","Recipient Name","Award Amount","Awarding Agency","Description","Award Type","Last Modified Date"],page:1,limit:10,sort:"Award Amount",order:"desc",subawards:false};
 try{const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(12000)});
 if(!response.ok)return NextResponse.json({status:"unavailable",error:`Upstream HTTP ${response.status}`,source:endpoint},{status:502});
 const data=await response.json();return NextResponse.json({status:"live",source:endpoint,accessedAt:new Date().toISOString(),fiscalYear:year,results:data.results||[],disclaimer:"Awards are commitments, not payments or allocations of individual tax."});
 }catch{return NextResponse.json({status:"unavailable",error:"Federal awards API unavailable",source:endpoint},{status:503})}
}
