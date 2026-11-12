import { z } from 'zod';
export const fiscalYear = () => { const d = new Date(); return d.getUTCFullYear() + (d.getUTCMonth() >= 9 ? 1 : 0); };
export const yearParam = z.coerce.number().int().min(2008).max(2100);
export const pageParam = z.coerce.number().int().min(1).max(1000);
export const queryParam = z.string().trim().max(100);
export function decimalCents(value: string): bigint {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) throw new Error('Invalid monetary amount');
  const negative = value.startsWith('-'); const [whole, fraction = ''] = value.replace('-', '').split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return negative ? -cents : cents;
}
export function dollars(cents: bigint): string { const v = cents < 0n ? -cents : cents; return `${cents < 0n ? '-' : ''}${v / 100n}.${String(v % 100n).padStart(2, '0')}`; }
export const amount = z.string().regex(/^-?\d+(\.\d{1,2})?$/);
export const metadata = (name: string, url: string, kind: string, period: string, extra = {}) => ({ name, url, kind, period, retrievedAt: new Date().toISOString(), cacheTtlSeconds: 900, ...extra });
