import {NextResponse} from "next/server";
export function GET(){return NextResponse.json({sources:[{id:"federal-awards",mode:"live-on-request",path:"/api/federal/awards"},{id:"treasury-debt",mode:"live-on-request",path:"/api/treasury/debt"},{id:"nj-spending",mode:"not-connected"}],note:"Source availability is not guaranteed. Endpoints must be tested against live upstream services."})}
