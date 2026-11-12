import { NextRequest } from 'next/server';
import { getFiscal } from '@/lib/data/treasury';
import { respond } from '@/lib/data/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(req: NextRequest) { return respond(() => getFiscal(req.nextUrl.searchParams)); }
