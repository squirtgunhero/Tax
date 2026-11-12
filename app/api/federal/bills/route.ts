import { NextRequest } from 'next/server';
import { listBills } from '@/lib/data/bills';
import { respond } from '@/lib/data/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(req: NextRequest) { return respond(() => listBills(req.nextUrl.searchParams)); }
