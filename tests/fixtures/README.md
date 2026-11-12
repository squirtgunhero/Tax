# Captured official-source fixtures

Captured 2026-11-12 for deterministic tests. These files are never loaded by production adapters or UI.

- `bill-119hr1.xml`: GovInfo Library of Congress BILLSTATUS, 119th Congress H.R. 1. Unrelated amendment/committee/title sections removed; tested fields retained verbatim.
- `mts4.json` and `mts5.json`: Treasury MTS tables 4 and 5, reporting date 2026-10-31. Retain hierarchy/classification and actual FYTD net amount columns, with all rows preserved to test exact reconciliation.
- `housevote.xml`: https://clerk.house.gov/evs/2025/roll190.xml
- `senatevote.xml`: https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00370.xml

Unit tests also construct deliberately invalid or minimal inputs to exercise validation. They do not represent financial records offered to users.
