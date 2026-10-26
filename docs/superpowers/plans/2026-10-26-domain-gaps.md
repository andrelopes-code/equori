# Domain gaps left after P9

Three parts, executed in order on `main` without push. Each slice is one commit. Each web slice has a test with language `en`, region `DE` and base currency `EUR`.

| Part | Slice | Commit | Status |
|---|---|---|---|
| A | A1 | `docs: settle the open points of the investments design` (amendment of section 7; a `portfolio` test when the decided behavior has none) | done |
| B | B1 | `docs(reporting): specify the cash view of financed and revolving statements` (amendment of the P9 cash view plan, new scenarios) | done |
| B | B2 | `feat(reporting): distribute financed and revolving payments in the cash view` (apitest per new scenario, rebuild totals, N20 source) | done |
| B | B3 | `feat(web): name the statement and payment of a cash amount` (`listCategoryCashPayments`, the contract change of B2) | done |
| C | C1 | `docs(adr): version export archives` (ADR 021; export spec and roadmap 9.3 cite it) | done |
| C | C2 | `feat(reporting): migrate export archives from earlier versions` | done |
| C | C3 | `test(reporting): pin the exported tables to the archive version` | done |
| C | C4 | `docs(reporting): document archive compatibility for owners` | done |
| C | C5 | `feat(web): show archive versions on export and import` | open |

## Decisions

- B: the task names the apitests inside the `docs(reporting)` slice. A test of a behavior that does not exist fails, so the tests and the implementation form slice B2.
- A: the task text carries the owner decision on the IPCA accrual only; the decision on `cri` and `cra` for an owner that is not an individual is cut off. Section 7 settles the IPCA point; the other point stays open and is listed in known problems.
- B: N20 needs the statement and payment of each cash amount on the API; `getCategoryTotals` returns totals only, so B2 adds `listCategoryCashPayments`. The contract change brings slice B3.
- B: revolving credit needed no code (CV9); S150 passed on its first run and pins CV4.
- C: an unknown archive_version (below 1) answers `archive_invalid`, the code of an invalid manifest, so C2 adds one Problem code, `archive_too_new`. A ready export keeps its archive_version in `reporting_export.archive_version` (migration 00060), so an export built before an update reports the version it was written with.
