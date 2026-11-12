# Closing the initial integration gaps

Implemented after the first verification report. The initial report remains a historical record; this file and the latest smoke output describe the expanded application.

- Federal bill discovery now works without an API key through the official GovInfo BILLSTATUS directory. File-modification ordering is disclosed; original status is preserved. Credentialed Congress.gov discovery remains optional and unverified without an owner-provided key.
- NJ legislation is ingested from the Legislature's official downloadable CSV ZIP database. The application exposes canonical bill identifiers separately from amended/reprint display numbers, synopses, official status definitions, action history, sponsors including withdrawal status, original text and fiscal-document references. NJ recorded votes are parsed from the official annual chamber archives. Blank votes remain unknown; ambiguous groupings with repeated members are flagged instead of fabricated into unique roll calls.
- OMB's current agency feeds expose FY 2027 through September 30, 2026 in live verification. `expended_amt` and `obligation_amt` are separate, and both record components and filtered aggregate totals reconcile to `ytd_amt`. Current revenue is separate. These feeds supplement complete-year summaries; they are never added together.
- NJ vendor purchasing is searchable by vendor, agency, category, fiscal year, and page. The source explicitly mixes paid, obligated, and reserved amounts. It is not misrepresented as a payment-only feed or an individual contract register.
- Fiscal-document readers extract official PDF pages with page numbers and SHA-256 hashes. CBO summaries and XLSX worksheet cells retain original labels, units, dates, missing values, and cached values; formulas are not executed. Text extraction is not a certified financial-statement conversion or automatic consolidation across bill versions. Approved publisher/path allowlists prevent arbitrary URL fetching.
- Optional address matching uses the Census geocoder and active congressional boundaries, followed by official House/Senate directories and the NJ legislative roster. The active Congress is selected explicitly rather than taking Census's first (potentially future) layer. Consent is required. Addresses and coordinates are not cached, snapshotted, returned, or included in application logs. Census may retain its own request logs.
- Optional 2026 ordinary-income tax illustration runs only in the browser, using IRS Revenue Procedure 2025-32, PDF pages 10–11 and 18. It supports single and joint filers with a standard deduction and explicit exclusions. It does not estimate full tax liability, payroll/state taxes, credits, or spending allocations.
- Durable snapshots and a shared cache use private Vercel Blob when configured, or an explicit filesystem directory on a persistent Node host. Checksummed immutable snapshot versions retain source retrieval times. Shared cache TTL does not extend the upstream retrieval's expiration when read into memory. Filesystem durability was verified across separate processes. Blob operation and hosted runtime checks are recorded separately when performed.
- Protected ingestion warms ten official-source adapters, writes durable run reports, and returns failure if a required adapter fails. A daily Vercel cron is configured; previews require an authenticated manual run because Vercel schedules run on production deployments. A health endpoint reports storage/readability, last-run freshness, and failures. Logs intentionally omit full URLs, query strings, request bodies, addresses, and secrets. Monitoring reports are implemented; an external notification destination is not configured.

## Operations

```bash
# Local persistent store, not Vercel's ephemeral filesystem:
LEDGER_DATA_DIR=/absolute/persistent/path npm run ingest
LEDGER_DATA_DIR=/absolute/persistent/path npm start
```

On Vercel, connect a **private** Blob store so `BLOB_READ_WRITE_TOKEN` is injected. Configure a cryptographically generated `CRON_SECRET`; do not expose either through NEXT_PUBLIC variables. Vercel sends the bearer secret to `/api/internal/ingest` for its daily schedule. Manual runs require the same authorization. `/api/health` returns HTTP 503 until a successful durable run is present, or when the report is stale/unreadable. Cron has a 300-second ceiling; other data functions have 120 seconds. Match those limits to the hosting plan.

`npm run test:load` performs a bounded 25-request / five-concurrent warmed-cache check against Treasury debt. This is a small smoke load, not a capacity claim or a stress test of government services. The source and deployment smoke suite remains separate from deterministic unit tests.

## Boundaries that cannot be removed by code alone

Official source reports are not independent bank-settlement audits. Current NJ expenditure and obligation fields are now separated, but cash-payment equivalence to audited statewide statements is not invented. Authority purchasing is unavailable in the selected official feed. Federal/state fiscal calendars and transfer identifiers do not support a verified consolidated cash total in this release. Separate views prevent double counting; a synthetic reconciliation would be misleading.

Large or unusual documents can exceed extraction limits; the original official link remains available. PDF reading order and Excel cached numeric precision may differ from rendered documents. District matches depend on Census address and boundary accuracy. Legislative archives have session-boundary coverage details and may lack unique roll identifiers. The 2026 tax illustration is intentionally narrow, with its assumptions shown beside every result.
