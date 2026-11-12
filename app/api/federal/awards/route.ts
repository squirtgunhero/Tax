import { NextRequest } from 'next/server';
import { getAwards } from '@/lib/data/awards';
import { respond } from '@/lib/data/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(req: NextRequest) { return respond(() => getAwards(req.nextUrl.searchParams)); }
