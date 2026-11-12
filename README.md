# Public Ledger

Explore official federal and New Jersey finances and legislative decisions without registering or supplying personal financial information. Built on the existing Next.js App Router, React, and TypeScript starter.

## Run

Use Node 24 (minimum 22.19) and npm. The lockfile is committed.

```bash
npm ci
npm run dev
# http://localhost:3000
```

For a production server, stop the development server before building; both use `.next`.

```bash
npm run build
npm start
```

`CONGRESS_API_KEY` is optional and server-side only. Copy `.env.example` to `.env.local` to enable Congress.gov's latest-bill API. Exact bill lookup uses the official Library of Congress bill-status XML hosted by GovInfo and needs no key. Never prefix secrets with `NEXT_PUBLIC_`.

Hosts requiring an outbound proxy can set `HTTPS_PROXY`, `HTTP_PROXY`, and `NO_PROXY`. The shared HTTP client honors these variables. Retain your host's trusted CA configuration; do not disable TLS verification.

## Expanded integration coverage

See [the follow-up implementation and operational notes](docs/PHASE2.md). The app now includes keyless federal discovery, NJ bulk bills and votes, current NJ expended/obligated records, vendor purchasing, official fiscal-document readers, consent-based district lookup, and a browser-only 2026 tax illustration.

## Available data

- **Treasury:** actual fiscal-year-to-date receipts, outlays, deficit/surplus, revenue-source and department/group breakdowns, historical fiscal-year selection, and a separately labeled daily debt balance. Category sums must reconcile with official totals before being returned.
- **USAspending:** searchable contract, grant, direct-payment, insurance/other-assistance, and loan awards. Filter by fiscal activity year, agency, recipient, keyword, and NJ place of performance. Paginated award-level obligations are cumulative, not payments in the selected year. Loan face values and subsidy costs have separate treatment.
- **New Jersey:** OMB agency expenditure and revenue summaries, complete fiscal years 2003–2025 as observed during verification, with agency/category/program filtering, exact filtered totals, and source-labeled federal-funding subtotals. These exclude the separate authority datasets. OMB classification definitions reference expenditures or obligations; cash-payment equivalence has not been independently verified.
- **Decisions:** exact federal bill lookup, current status, action history, sponsors, available original introduced text, all-version links, and version-specific CBO estimate references. On-demand House and Senate roll calls include individual votes, state filters, reconciled totals, and separate vice-presidential tie-breaks.
- **NJ publications:** a live index of official OMB budget, appropriation, and financial-report PDFs. Figures inside PDFs are not extracted. Official NJ bill, vote, representative, and procurement links are provided while those structured integrations remain incomplete.

Each successful upstream-backed response includes source attribution, reporting period, retrieval time, and cache duration. NJ summaries also expose the publisher's update date. No sample figures or fallback financial records are served.

## Verify

```bash
npm test                 # deterministic adapter, accounting, retry, and cache tests
npm run typecheck
npm run build
npm audit --omit=dev
npm start                # separate terminal; defaults to port 3000
npm run test:live         # calls the running application's actual API routes
npx playwright install chromium
npm run test:e2e          # browser journeys, mobile/error states, accessibility scan
```

Set `SMOKE_BASE_URL` for another port or a deployed instance. In this sandbox, npm and Playwright need writable workspace caches:

```bash
npm ci --cache /workspace/.npm-cache
PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright npx playwright install chromium
SMOKE_BASE_URL=http://localhost:3001 PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright npm run test:e2e
```

CI runs deterministic tests, TypeScript, production build, and production dependency audit. Live government-service checks are a separate command because remote availability and credentials change independently of code.

See [the initial audit](docs/AUDIT.md), [verification evidence](docs/VERIFICATION.md), [machine-readable live results](docs/live-smoke.json), and [source methodology](docs/DATA.md).

## Architecture

`lib/data/` contains independent server adapters and shared HTTP, validation, and monetary functions. `app/api/` exposes normalized JSON; `app/components/` renders the explorer. Monetary aggregation uses integer cents and returns decimal strings. Upstream JSON numeric award amounts are normalized from the precision supplied by USAspending; they are never used for jurisdiction-wide totals. Displayed figures are rounded and labeled.

The HTTP layer has per-attempt timeouts, bounded retries for transient errors, Retry-After handling, response-size limits, request coalescing, and a bounded 15-minute process-local cache. Errors are not cached or replaced with successful empty data. No stale-on-error records are served. `status: live` means a successful official-source retrieval, which may be cached; use `retrievedAt` rather than treating that status as a real-time guarantee. Source inventory is explicitly not a health check.

Read-through ingestion now supports private Vercel Blob snapshots/shared caching and a protected daily ingestion job; see PHASE2.md. Without explicit storage configuration, the application reports memory-only operation. A durable filesystem backend is available on persistent Node hosts, never as a durability claim for Vercel /tmp. PostgreSQL/Prisma would be appropriate for durable snapshots, change history, reconciliation, saved views, or scheduled imports; none is needed to pretend the current explorer has persistence. Cache state is independent per server process and disappears on restart.

## Deploy

Use Vercel's Next.js preset or a Node 24 host:

1. Import this repository and install with `npm ci`.
2. Build with `npm run build`; a Node host starts with `npm start` behind its HTTPS reverse proxy.
3. Optionally configure `CONGRESS_API_KEY` as a server-only secret.
4. Permit outbound HTTPS to `api.usaspending.gov`, `api.fiscaldata.treasury.gov`, `data.nj.gov`, `www.nj.gov`, `www.govinfo.gov`, `clerk.house.gov`, `www.senate.gov`, and optionally `api.congress.gov`.
5. API routes request a 120-second function ceiling. Ensure the hosting plan supports it or lower adapter budgets and use a shared ingestion/cache service. Verify the deployed instance with `SMOKE_BASE_URL=https://your-host npm run test:live`.

No database, migration, or user credential is required. Hosting/deployment itself has not been performed here. Before scaling public traffic, introduce a shared cache and edge rate controls rather than multiplying upstream requests across workers.

## Boundaries

Federal and state records are not combined into a grand total: federal transfers can appear on both sides. Federal FY starts October 1; NJ FY starts July 1. Budgets, appropriations, obligations, awards, actual expenditures, debt, and forecasts are different measures.

Credentialed Congress.gov discovery remains unverified with a real key, but keyless GovInfo discovery works. The added NJ legislation/votes, current finances, purchasing, document extraction, district lookup, tax illustration, storage, and ingestion/health features are detailed in PHASE2.md. Independent bank-settlement verification, statewide audited reconciliation, unified contract-level procurement, and federal/state transfer consolidation remain outside the verified data scope. An official estimate link is not a normalized fiscal-impact calculation. A missing source field is not zero, and a missing roll-call reference is not evidence that no vote occurred.
