# Initial verification report — 2026-11-12

This report is retained as the initial-release record. See VERIFICATION-PHASE2.md for the subsequent implementation and current limitations.

All results below were obtained in this environment, against the production build served by `next start` on port 3000. They do not establish deployment health or future upstream availability. The source inventory itself is a capability list, not a health probe.

## Final results

| Check                                          | Result                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Dependency installation and committed lockfile | Passed; Node 24.22.1; Next 15.5.29                                                                                             |
| `npm test`                                     | 11 passed, 0 failed                                                                                                            |
| `npm run typecheck`                            | Passed, including a separate copy without generated `.next` types                                                              |
| `npm run build`                                | Passed; 9 API routes and the explorer built successfully                                                                       |
| `npm run test:live`                            | 28 expected HTTP outcomes matched: 20 HTTP 200 responses and 8 intentional error/configuration cases                           |
| `npm run test:e2e`                             | 2 passed, 0 failed; production Chromium journeys                                                                               |
| Automated accessibility                        | No WCAG 2 A/AA or 2.1 AA violations in tested overview and expanded decisions/votes views                                      |
| Mobile layout                                  | 390 × 844 viewport, no page-level horizontal overflow in tested views; tables scroll within labeled keyboard-focusable regions |
| Dependency audit                               | `npm audit` and `npm audit --omit=dev`: 0 vulnerabilities                                                                      |
| Formatting / whitespace                        | Prettier and `git diff --check` passed                                                                                         |

The 28-route check includes expected 400/404 responses and the missing-key 503. That 503 is **not** evidence of a working Congress.gov credentialed integration. See [the actual paths, response statuses, retrieval periods, and durations](live-smoke.json).

## Official sources successfully exercised through the application

| Integration                              | Live observations                                                                                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USAspending `spending_by_award`          | FY 2025 contracts; page 2; grants with NJ performance location; agency and recipient filtering; loans, direct payments, and insurance/other assistance all returned HTTP 200 |
| Treasury Debt to the Penny               | Latest debt row returned HTTP 200, reporting date 2026-11-10                                                                                                                 |
| Treasury MTS tables 2, 4, 5              | FY 2025, 2026, and 2027 returned HTTP 200; category receipts/outlays reconcile exactly to the actual FYTD totals; estimates excluded                                         |
| NJ OMB Socrata expenditures              | Metadata and complete paginated snapshot read; FY 2025 is the latest available complete-year column; filtered FY 2024 query also returned HTTP 200                           |
| NJ OMB Socrata revenue                   | Metadata and snapshot read; HTTP 200; source definitions and publisher update date exposed                                                                                   |
| NJ OMB publication index                 | Official landing-page HTML parsed into deduplicated official PDF links; HTTP 200                                                                                             |
| GovInfo / Library of Congress BILLSTATUS | 119th Congress H.R. 1 and S. 5 returned HTTP 200; status, actions, sponsors, text references, CBO references, and roll-call references normalized                            |
| House Clerk                              | 119th Congress, session 1, roll 190 returned HTTP 200; 432 listed members reconcile to 218 yea / 214 nay                                                                     |
| U.S. Senate                              | 119th Congress, session 1, roll 370 returned HTTP 200; 100 senators reconcile to 50 yea / 50 nay; vice-presidential tie-breaking yea preserved separately                    |

Additional direct official-source checks: NJ Transparency expenditure/revenue discovery pages, NJ Legislature home and budget/finance page, and both OMB dataset-definition PDF attachments returned HTTP 200. The attachments were read, not merely downloaded. They prompted the distinction between NJ reported expenditure summaries and independently verified cash payments. Publication-index success does not verify every PDF destination or any extracted financial amounts.

## Functional coverage

Browser tests exercise fiscal-year selection, live fiscal figures and reconciliation message, award recipient search, NJ expenditure and revenue switching, agency/program keyword search, exact bill lookup, enacted-status display, House vote loading, member state filtering, source inventory, mobile overflow, and an intercepted upstream-unavailable response. They assert no client runtime errors in the full live journey. Screenshots were captured and inspected at desktop and mobile sizes.

Deterministic tests cover exact monetary arithmetic beyond floating-point precision, negative offsets, actual-vs-estimated Treasury totals, rejection of ambiguous totals, hierarchical subtotal exclusion using captured Treasury fixtures, NJ missing values and federal-funding labels, official award request schemas and loan-specific fields, bill provenance and unique vote references, chamber reconciliation and separate VP votes, transient retries and Retry-After, permanent errors, invalid JSON, cache coalescing/failure behavior, and safe publication-index parsing.

## Failures found and resolved

- The starter's direct Node fetch calls returned HTTP 503 through both upstream-backed app routes, while independent requests succeeded. An environment-aware proxy transport resolved this; both routes subsequently passed live production tests.
- The first build ran concurrently with development and failed on a missing generated page entry. Serial production builds pass. README documents avoiding concurrent dev/build writes to `.next`.
- npm and Playwright initially attempted unwritable home-directory caches. Workspace cache paths resolved installation.
- The starter requested an unsupported contract type field that came back null, hardcoded a fiscal year, and converted absent amounts to zero. The normalized explorer retains unknown values and exposes the selected period and category.
- Live category testing found that loans require `Loan Value`, and that direct-payment and other-assistance codes cannot be mixed in one USAspending request. Schemas were corrected and all exposed award groups retested live.
- Source links guessed during discovery returned NJ 404s. The implementation uses the verified OMB index and actual discovered publication links.
- A test of 119th Congress S. 1 returned an upstream 404. The live Senate positive case now uses the independently verified S. 5; a nonexistent bill is tested separately for truthful 404 behavior.
- Expanded roll-call accessibility testing found a non-focusable scroll region. All table regions now have labels and keyboard focus; final browser/accessibility checks pass.
- The initial installed dependency graph had PostCSS advisories. A patched compatible version is pinned through an override; production builds and full dependency audit pass.

## Unverified or incomplete

- Congress.gov latest-bill discovery requires a real server-side key. Direct requests without a key returned `API_KEY_MISSING`; the app returns `CONFIGURATION_REQUIRED`. Credentialed pagination/schema behavior remains unverified. Congress public RSS returned 403, so it is not used as a fallback.
- NJ structured bills, action histories, fiscal notes, recorded votes, and procurement records are not ingested. Official reference links and a source-preserving ingestion strategy are documented in DATA.md.
- OMB PDF monetary tables and CBO fiscal-impact documents are not normalized. The product links to original documents and does not infer a fiscal impact or approval from a title.
- NJ cash-payment equivalence and reconciliation with audited statewide financial statements remain unverified. The OMB agency dataset is presented in its own reported accounting scope, with the official definitions attached.
- No cross-jurisdiction or intra-state transfer reconciliation, durable snapshot database, scheduled ingestion, shared multi-process cache, operational alerts, or production load test has been implemented.
- Automatic representative district matching and personal tax contribution estimation are not implemented. No exact tax-dollar tracing is claimed.
- Screen-reader/manual assistive-technology review, every browser/platform, every historical record, and every upstream failure mode have not been verified by the sampled automated tests.
- A hosted production deployment has not been performed. The app runs locally in the managed environment; deployment instructions and outbound hosts are in README.md. CI configuration is supplied; the checks above are local results, not claims about a remote CI run.
