import { NextRequest } from 'next/server';
import { getBill } from '@/lib/data/bills';
import { respond } from '@/lib/data/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(req: NextRequest) { return respond(() => getBill(req.nextUrl.searchParams)); }
