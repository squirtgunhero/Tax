# Follow-up verification — 2026-11-12

The first verification report describes the initial release. This report covers the subsequent limitation-fixing work. Tests ran against a production `next build` / `next start` server in the managed environment, not a hosted Vercel deployment.

## Passed

- 23 deterministic tests: existing financial normalization/retry/cache coverage plus published IRS bracket boundaries, active-Congress transition time, Census layer selection, multiline CSV/missing vote choices, legislative document paths/canonical identifiers, bounded ZIP extraction, current NJ expended/obligated reconciliation, GovInfo discovery, document URL allowlists, XLSX cached/missing values, persistent snapshots across separate processes, checksums, and purchasing null amounts.
- TypeScript and production build. The app has 20 API routes plus the frontend. Full production dependency audit reports zero vulnerabilities after upgrading the vulnerable transitive Vercel CLI configuration library through a compatible override.
- 45 expected live-route outcomes matched, including intentional validation/authorization errors and the missing Congress.gov key response. These are recorded in `live-smoke.json`; successful error handling is not evidence that credentialed Congress.gov access works.
- Three production-browser journeys, including current NJ data, historical summaries, vendor search, NJ fiscal-note PDF extraction, federal bill/vote flows, mobile layout, error states, keyboard accessibility, and a 2026 tax illustration. The tax test asserts that no API request sends the income value. Automated WCAG scans passed in the tested views.
- Census address matching plus official federal and NJ member lookup returned HTTP 200 for a public civic-address test. The result identified congressional district 10, three federal representatives, and three NJ legislators for state district 29. The address and coordinates are not included in persisted snapshots or verification output.
- All ten source jobs succeeded in the durable ingestion run. See `ingestion-latest.json`.
- Protected ingestion returned 401 without authorization and 200 with the locally generated secret. The durable health endpoint returned 200 after a successful run. See `operations-latest.json`. No secret is recorded in the evidence.
- Small warmed-cache load smoke: 25 requests, five concurrent, zero errors. Observed local p50 38 ms and p95 95 ms. This is not a production capacity benchmark. See `load-latest.json`.
- GitHub CI passed for the primary feature commit. Follow-up corrections and evidence are committed separately.

## New official sources exercised live

- GovInfo House and Senate BILLSTATUS directories and selected XML records: keyless discovery works, with modification-order semantics disclosed.
- NJ Legislature `DB2026_TEXT.zip`: main bills, history, sponsors, documents, roster; official status descriptions from the public search page.
- NJ Legislature annual `A2026.zip` and `S2026.zip` vote CSV archives, including A794 votes. Blank votes remain unknown; repeated-member groupings are flagged ambiguous.
- OMB current expenditures (`apet-rp2i`) and revenue (`k9iw-i8yt`): FY 2027 through 2026-09-30 in these checks. Separate `expended_amt` and `obligation_amt` reconcile with source YTD values; filtered aggregate components reconcile too.
- Division of Purchase and Property vendor purchasing (`ubnu-tqu7`): default and vendor-filtered views and FY 2025/2026 selection. The source contains null amounts. These remain null and sort after reported amounts, rather than causing a feed-wide failure or becoming zero.
- CBO publication 61461 and its original XLSX workbook: source summary, 13 worksheet names, cached values, labels and units parsed without formula execution.
- NJ A425 fiscal estimate PDF: extracted original OLS language and its indeterminate fiscal-impact findings, rather than inventing numeric estimates.
- IRS Revenue Procedure 2025-32: rate tables and standard deduction pages extracted; the downloaded source fixture checksum is verified. PDF hashes are computed before the parser transfers/detaches its input buffer.
- Census geocoder and TIGERweb legislative boundaries, House MemberData XML, Senate directory XML, and NJ official roster: current boundary/term consistency checked.

## Vercel deployment blocker

Vercel's connected Jersey Proper team allowed listing teams/projects, but `POST /v11/projects` returned HTTP 403: **“You don't have permission to create the project.”** No project was created, no managed storage was provisioned, and no deployment was published. There is no installed/authenticated Vercel CLI, VERCEL_TOKEN, OIDC credential, or CLI auth file available for the tool's suggested fallback. Repeating the same denied action or assuming reconnecting would fix it would not establish access.

The app, private Blob adapter, protected ingestion route, daily cron configuration, health reporting, tests, and deployment instructions are concrete and committed. An authorized Vercel connection or an existing writable project is needed to provision the private store and finish hosted cold-start, storage, timeout, browser, and live-source verification. Production cron activation and external notification/alert delivery are not claimed.

## Remaining factual boundaries

Credentialed Congress.gov discovery needs an owner-provided key, although keyless discovery removes that dependency from the core experience. Vendor purchasing is not a comprehensive contract-level register, and authority purchasing is absent from this feed. Official fiscal-document extraction is available, but it is not a certified automatic normalization of every statement/table or reconciliation across versions. Separate fiscal scopes and missing shared transfer identifiers prevent a verified federal-plus-state total. District assignment depends on Census match accuracy and source vintage. The tax model is a narrowly disclosed 2026 illustration.
