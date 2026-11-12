# Public Ledger
Consumer-first federal and New Jersey tax accountability MVP. Next.js 15, React 19, TypeScript.

## Start
```bash
npm install
npm run dev
```

## Verify
```bash
npm run typecheck
npm run build
curl http://localhost:3000/api/sources/status
curl 'http://localhost:3000/api/federal/awards?year=2025'
curl http://localhost:3000/api/treasury/debt
```

Federal awards and Treasury debt endpoints are live-on-request server adapters. Actual live upstream success has **not** been verified in this environment. No NJ spending or proposal feed yet. No personal tax calculations are claimed. Award amounts are not payments. Never treat projected or estimated allocations as actual tracing of individual tax dollars.
