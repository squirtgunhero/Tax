# Repository audit — 2026-11-12

Baseline: commit 6348420. Reviewed every tracked source/configuration file. The application is a Next.js App Router starter: one client page, layout, two direct-fetch upstream proxies, and a static source inventory. No persistence, test runner, CI, dependency lockfile, or ingestion jobs. Retain this architecture and add independent adapters; PostgreSQL is not justified for a read-through explorer yet.

## Baseline observations

- Dependency installation initially failed because npm's home cache was not writable. Installed with `--cache /workspace/.npm-cache`.
- TypeScript passed after installation.
- An initial production build overlapped a development server and failed with a missing `/_not-found` entry. This was a verification process collision in `.next`; rerun serially.
- Home and source inventory returned HTTP 200. Invalid award year returned HTTP 400.
- Both existing upstream-backed app routes returned HTTP 503. Direct requests to the same official endpoints returned HTTP 200. Node fetch did not honor the environment proxy.
- USAspending accepted the original request but returned `Award Type: null`: the contract field is `Contract Award Type`. The initial UI also converted missing amounts to zero, and hardcoded FY 2025.
- Treasury debt returned official data. Debt is a stock, not actual spending.
- Congress API returned HTTP 403 `API_KEY_MISSING`; public Congress RSS also returned 403. No credentials are configured in this environment.
- NJ Transparency expenditure/revenue pages returned 200 and link to public Socrata datasets published by NJ OMB: `whpi-savb` and `sk3g-zv89`. Both dataset and metadata endpoints returned 200. Their latest complete fiscal-year column is 2025; do not imply current-year coverage.
- Guessed NJ archive and budget-index paths returned 404. Use verified OMB landing page and discovered document URLs rather than guessed paths.
- NJ Legislature home and budget/finance page returned 200. Structured bills/votes ingestion remains unverified.

See VERIFICATION.md for final checks and integration limitations. Direct requests alone do not establish application-route success.
