# Sources and accounting methodology

This initial methodology is supplemented by PHASE2.md and VERIFICATION-PHASE2.md for current NJ feeds, official legislative bulk ingestion, fiscal-document extraction, district lookup, estimation, and storage.

## Federal receipts and spending

Source: Treasury Fiscal Data, Monthly Treasury Statement (MTS), endpoints `v1/accounting/mts/mts_table_2`, `_4`, and `_5` under `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/`.

For a selected fiscal year, first find the most recent published `record_date` with `record_fiscal_year:eq:YYYY`. Retrieve Table 2 for that exact date; use the actual `current_fytd_budget_amt` values for **Total Receipts** and **Total Outlays**. Never use `current_year_budget_est_amt` or `next_year_budget_est_amt`. The deficit is outlays minus receipts, calculated in integer cents. A negative result is a surplus.

Table 4 supplies net FYTD receipts; Table 5 supplies net FYTD outlays. Select each root reporting group once, using its direct monetary value or its single level-two total. Exclude nested subgroups and overall totals. Include negative offsets. Both category sums must equal Table 2 totals exactly. If a table grows beyond the configured complete-page limit, a category is missing, or totals do not reconcile, return an explicit failure instead of partial financial totals. Tables 2/4/5 are currently below their respective 100/1000/1000 row limits; these limits are asserted on every response.

Historical selection returns the latest published statement within that fiscal year, not a cross-snapshot sum. Treasury can revise records. Table 1 is deliberately not summed: it includes earlier-year comparisons, monthly rows, and year-to-date totals in the same snapshot.

Debt to the Penny uses `v2/accounting/od/debt_to_penny`, descending record date, one row. Gross debt, debt held by the public, and intragovernmental holdings are separate fields. Debt is never added to spending.

## Federal awards

Official endpoint: `POST https://api.usaspending.gov/api/v2/search/spending_by_award/`.

The fiscal activity filter is October 1 of the preceding calendar year through September 30. Award-level amounts are **cumulative**, including activity outside this interval; the interval does not transform them into within-year expenditure amounts. Prime awards only; no subawards are added.

Filter schemas tested live include `keywords`, `recipient_search_text`, awarding top-tier `agencies`, and NJ `place_of_performance_locations`. Page size is 20 and `page_metadata.hasNext` controls pagination. The agency filter expects an official agency name. NJ performance location does not imply that the recipient is a NJ resident or that the state government made the award.

The official API requires one award-type group per request. Contracts, grants, loans, direct payments, and insurance/other assistance are requested separately, including supported newer F-codes. Loans require `Loan Value` sorting and fields, with a separate `Subsidy Cost`; their face value is not an obligation or cash expenditure. No aggregate of this explorer's award rows is presented as federal spending. USAspending numeric JSON amounts cannot preserve precision beyond that provided by the source.

## New Jersey

Official discovery pages:

- https://www.nj.gov/transparency/financial-management/expenditures/index.shtml
- https://www.nj.gov/transparency/financial-management/revenue/index.shtml

These link to OMB's Socrata datasets:

| Dataset                                  | ID          | Measure                                                                  |
| ---------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| YourMoney Agency Expenditures Multi-Year | `whpi-savb` | Agency summary expenditures by fund, category, agency, statewide program |
| YourMoney Agency Revenue Multi-Year      | `sk3g-zv89` | Agency summary revenue by agency, revenue type, source/fund              |

Metadata from `/api/views/ID.json` determines available complete-year columns and publisher update time. `/resource/ID.json` requests only classification fields and the selected `fy_YYYY`. Rows are paged in stable classification order, with 1000 rows per request and a maximum of 20 pages. Exceeding that boundary fails; partial totals are never returned. Natural classification keys must be unique. Missing/invalid amounts fail validation rather than becoming zero.

The attached official dataset summaries were retrieved and read during the audit. OMB describes the fiscal-year columns as cumulative expenditures or collected revenue. Its expenditure category/agency definitions also reference obligations, so Public Ledger labels these **reported expenditure summaries**, not independently verified cash payments. The revenue definition allows year-end closing/adjustment periods. Definitions are linked in each dataset response and UI. Agency definitions can include authorities and commissions; excluding the separate authority feed does not establish that all authorities are absent from the agency feed.

Filters and exact cents aggregation run on a complete validated snapshot, followed by a 20-row display page. State FY begins July 1. Authority datasets are deliberately excluded to avoid casually combining scopes with possible intra-state transfers. These are summaries, not vendor invoices or individual procurement contracts.

Federal-funding subtotals only identify classifications whose source labels contain FEDERAL. They are not an intergovernmental reconciliation. No federal-plus-NJ total is calculated.

### Publications and future ingestion

OMB index: https://www.nj.gov/treasury/omb/. Parse actual HTML anchors with an HTML parser, excluding commented-out links, deduplicating URLs, and allowing only HTTPS PDF links within the official OMB publication path. This verifies the index, not every PDF's contents or availability. Prefer official descriptive anchor text; otherwise show the publication filename.

For budget and audited-financial statement ingestion, preserve each original PDF, URL, retrieval timestamp, content hash, reporting period, table/page reference, and unit. Extract and review proposed/enacted/actual columns separately; reconcile amounts with published statement totals before exposing parsed figures. Documents currently remain source links: no values are inferred from titles or filenames.

NJ Legislature search, voting records, and budget/finance pages are legitimate official alternatives while a documented structured feed is investigated. Do not treat their dynamic frontend's internal API as a supported public ingestion contract without validating access, schema, pagination, and usage terms. A future importer should retain official bill session/identifier, text versions, action dates, fiscal notes, members, and roll calls, with source-document provenance. Procurement likewise remains an official-link foundation rather than invented contract records.

## Federal legislation and recorded votes

Congress.gov API (`https://api.congress.gov/v3/bill`) requires `CONGRESS_API_KEY`. It is implemented for paginated discovery but not verified with a credential here. No key is exposed in source metadata, client bundles, or errors.

GovInfo provides Library of Congress BILLSTATUS XML without a key:
`https://www.govinfo.gov/bulkdata/BILLSTATUS/{congress}/{type}/BILLSTATUS-{congress}{type}{number}.xml`.

Exact lookup validates identity, current action, sponsors, action history, available introduced-version text, and version-specific CBO references. It does not infer costs from bill text or sum CBO estimates for different versions/baselines. Not every bill has an introduced-text version, CBO estimate, or recorded vote in this source. Enacted bills retain their actual enacted status and are not relabeled as pending proposals.

House roll calls are retrieved from `https://clerk.house.gov/evs/{year}/roll{number}.xml`; Senate roll calls from `https://www.senate.gov/legislative/LIS/roll_call_votes/vote{congress}{session}/vote_{congress}_{session}_{number}.xml`. The requested identity must match the record. Member IDs must be unique; every member's recorded choice must reconcile with chamber totals. Senate tie-breaking votes by the vice president are preserved separately. Roll-call questions can be procedural or amendment votes, not necessarily final passage or spending approvals. UI state filters do not establish a user's district.

## Reliability and privacy

Shared transport uses trusted TLS and environment-aware proxies, 12-second attempt timeouts, at most three attempts, transient-only retries, Retry-After handling, and an 8 MB streamed response limit. Oversized responses, schema changes, network failures, and upstream errors have explicit codes. Long requested retry delays return an unavailable response rather than retrying early.

Successful normalized results are cached for 15 minutes in a bounded process-local map, with concurrent identical requests coalesced. The original retrieval time is preserved. Failed loads are not cached. No stored snapshots, background polling, or durable history are claimed. Cache behavior and HTTP retry logic have deterministic tests; live tests verify actual app routes separately.

No accounts, tracking analytics, geolocation requests, SSNs, tax credentials, income inputs, or personal financial uploads are implemented. This application cannot trace an individual's exact taxes to specific purchases. Optional tax estimates and precise representative lookup require separately validated models/data and remain unimplemented.
