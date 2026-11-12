# Public Ledger

A public finance explorer built on the existing Next.js App Router, React, and TypeScript starter. Explore without an account or personal financial records.

## Run

Use Node 24 (minimum 22.19):

```bash
npm ci
npm run dev
```

For production, stop development before building because both use `.next`:

```bash
npm run build
npm start
```

Copy `.env.example` to `.env.local` for optional server settings. Next.js loads that file; standalone CLI scripts require variables in the shell or Node's `--env-file`. Never use NEXT_PUBLIC prefixes for secrets.

## What is connected

| Area                   | Available data                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Federal finances       | Treasury actual receipts, outlays, deficit/surplus, category breakdowns that reconcile to totals, historical fiscal-year selection, and separately labeled debt                                                |
| Federal awards         | USAspending contracts, grants, direct payments, other assistance, and loans; agency, recipient, keyword, fiscal activity year, NJ performance-location filters, and pagination                                 |
| Federal decisions      | Keyless GovInfo bill discovery, bill text references, actions, sponsors, official CBO summaries/workbook tables, and House/Senate individual votes                                                             |
| NJ current finances    | OMB current revenue and separately reported expended/obligated amounts; FY 2027 through September 30, 2026 observed in verification                                                                            |
| NJ historical finances | OMB complete-year agency revenue/expenditure summaries for 2003–2025, with filters and exact totals                                                                                                            |
| NJ legislation         | Official bulk CSV bill database, canonical identifiers, amended/reprint display numbers, synopses, official status definitions, actions, sponsors, original/fiscal documents, and annual chamber vote archives |
| NJ purchasing          | Vendor/agency/commodity/year searches; includes paid, obligated, and reserved amounts, clearly distinguished from expenditures and individual contract records                                                 |
| Source documents       | OMB publication discovery and approved official PDF page extraction, page citations and SHA-256 checksums; CBO workbook cached values with original units/labels and no formula execution                      |
| Optional context       | Consent-based Census district matching plus official federal/NJ member directories; browser-only 2026 ordinary-income tax illustration for single/joint filers                                                 |

`CONGRESS_API_KEY` is optional for the separate Congress.gov latest-bill API. The keyless GovInfo discovery and exact lookup work without it. Credentialed Congress.gov behavior is not verified without a real key.

Every successful financial response carries source, measure, period, retrieval time, and cache duration. Missing source amounts remain unknown, not zero. Awards are cumulative obligations for awards with activity in the selected year; they are not payments in that year. Loan face value and subsidy cost are separate. Official estimates, appropriations, obligations, expenditures, receipts, purchasing, and debt remain different measures.

## Storage, ingestion, and health

- Without explicit configuration: bounded process-local 15-minute cache; no durability claim.
- Persistent Node host: set `LEDGER_DATA_DIR` to a durable absolute directory. Vercel's ephemeral filesystem is deliberately not used as durable storage.
- Vercel: connect a **private Blob store** with `BLOB_READ_WRITE_TOKEN`. Checksummed immutable snapshot versions and current shared-cache pointers are stored privately. Original retrieval times are preserved, and reading a shared entry does not extend its TTL.
- Set `CRON_SECRET` to protect `/api/internal/ingest`. Vercel's daily schedule is in `vercel.json`; schedules run on production deployments, so previews require an authenticated manual invocation.
- `npm run ingest` warms ten source adapters and saves a durable run report. `/api/health` reflects the last run, its freshness, storage readability, and process metrics; it returns 503 if degraded. Logs omit query strings, bodies, addresses, and credentials.

```bash
LEDGER_DATA_DIR=/absolute/persistent/path npm run ingest
LEDGER_DATA_DIR=/absolute/persistent/path npm start
```

See [expanded methodology and operations](docs/PHASE2.md). The persistent filesystem backend and protected ingestion/health paths are verified. Managed Blob and Vercel runtime verification remain blocked by account permissions described in the current verification report.

## Verify

```bash
npm test
npm run typecheck
npm run build
npm audit --omit=dev
# Start the production app in another terminal, then:
npm run test:live
npx playwright install chromium
npm run test:e2e
npm run test:load
```

`SMOKE_BASE_URL` selects another running instance. When the server has configured secrets, provide the same environment to smoke tests so expected configuration responses match. Tests never require secret values in source files. In the managed sandbox, use `--cache /workspace/.npm-cache` for npm and `PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright` for browser installation/execution.

CI runs deterministic tests, TypeScript, production build, and the production dependency audit. Live government checks are separate from CI because availability changes independently of source code. The load test is only a bounded 25-request / five-concurrent warmed-cache smoke check, not a production capacity claim.

## Deploy

Use a Node 24 host or Vercel's Next.js preset. Install with `npm ci`, build with `npm run build`, and use `npm start` on a Node host behind HTTPS. Configure storage and ingestion secrets server-side as described above. Data functions request 120 seconds; ingestion requests 300 seconds. Ensure the hosting plan supports those limits.

Outbound HTTPS is needed for USAspending, Treasury Fiscal Data, data.nj.gov, www.nj.gov, pub.njleg.gov, www.njleg.state.nj.us, GovInfo, CBO, IRS, Census geocoding/TIGERweb, House Clerk, Senate, and optionally api.congress.gov. Vercel Blob additionally needs its service endpoints. Government HTTP adapters honor HTTPS_PROXY/HTTP_PROXY/NO_PROXY; retain trusted proxy CAs and never disable TLS verification.

Before promotion, run live routes, browser flows, authenticated ingestion, health, and load checks against the deployed preview. No public Vercel deployment or managed-store success is claimed: project creation returned HTTP 403 for the connected team, with no authenticated CLI fallback available.

## Boundaries

Federal and state totals are not combined. Transfers can appear on both sides, fiscal calendars differ, and the selected sources do not provide a verified shared cash-transfer reconciliation. Federal FY starts October 1; NJ FY starts July 1. Agency summaries, current records, and purchasing feeds overlap in scope and must not be added together.

Government-reported amounts are not independent bank-settlement audits or an automatically reconciled statewide financial statement. Authority purchasing is unavailable in the selected feed. NJ annual vote archives can have ambiguous groups and session-boundary coverage gaps; source codes remain explicit. PDF extraction can change reading order, and large/unusual documents can exceed limits. Different estimate versions/baselines are never summed.

Addresses require consent to send to Census and are not saved by Public Ledger. Census has its own logging policies. Income stays in the browser. The 2026 tax model excludes credits, other deductions, payroll/state/self-employment taxes, capital gains, AMT, and other special provisions; it cannot trace an individual's taxes to purchases. No SSNs, tax credentials, or sensitive financial uploads are collected.

See the [initial audit](docs/AUDIT.md), [initial verification](docs/VERIFICATION.md), [follow-up verification](docs/VERIFICATION-PHASE2.md), [data methodology](docs/DATA.md), and [current source checks](docs/live-smoke.json).
