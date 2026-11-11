# Human navigability of the code base

Status: draft. Scope: structure, documentation and file layout. No behavior changes.

## Problem

A contributor who opens the repository cannot locate the file that serves a screen, an endpoint or a rule. Measured on `main` at commit `42cdb435`:

| Measure | Value |
|---|---|
| Files touched by one new endpoint (`5ecf76d5`, `7e5fa8c4`, `e076e7c8`) | 11, 13, 26 |
| Lines in `api/openapi.yaml` (one file, 206 paths) | 12883 |
| Go files / generated Go and TypeScript files | 1119 / 96 |
| Modules that follow the layout of ADR 002 (`app`, `domain`, `adapter/postgres`, `adapter/httpapi`) | 9 of 11 |
| `internal/marketdata`: Go files in the module root, `internal/app`, `internal/adapter/postgres` (hand-written) | 18, 0, 0 |
| `internal/reporting`: `internal/domain` files, `internal/adapter/postgres` files (hand-written) | 0, 18 |
| `internal/ledger`: test files in the module root | 101 |
| Largest hand-written non-test Go file | `internal/ledger/internal/adapter/postgres/repository.go`, 1486 lines |
| Files in `web/src/features/accounts`, `transactions`, `setup`, `instruments` | 234, 194, 191, 88 |
| Subfolders in `web/src/features/instruments` among its first 60 files | 0 |
| README files inside `internal/` or `web/src/` | 0 |
| Document that lists the files of one endpoint | none |

## Goals

1. A contributor finds the files of an existing endpoint, screen or rule in at most three lookups, starting from a path, a screen name or an `operationId`.
2. A contributor adds an endpoint by following one checklist that names each file and command.
3. Every module follows one layout, or its deviation is written in the module README.
4. A directory holds at most 40 hand-written files, tests included.

## Non-goals

- No change to the module boundaries, the dependency rules or the generators of ADR 002 and ADR 028.
- No change to behavior, API contract, SQL schema or user interface.
- No removal of generated code.

## Decisions

| ID | Decision |
|---|---|
| H1 | The navigation map is `docs/contributing/map.md`. It holds the hop table of an endpoint, the checklist to add an endpoint, the module table and the web table from screen to file. |
| H2 | Each module root holds a `README.md` of at most 30 lines: purpose, owned table prefix, OpenAPI tag, the layout and its deviations, the entry file of each layer. |
| H3 | Each web feature holds a `README.md` of at most 30 lines: route, entry component, query file, owned endpoints, guide topic. |
| H4 | Web features above 40 files are split into subfolders named after a sub-screen. The `index.ts` of the feature keeps its exports. |
| H5 | `repository.go` and any hand-written Go file above 800 lines are split by topic, one file per concept. Package, names and signatures stay. |
| H6 | `marketdata` and `reporting` are aligned to the layout of ADR 002, or their deviation is recorded in an amendment of ADR 002 and in their README. The choice follows a size spike. |
| H7 | `api/openapi.yaml` is split into one file per module, bundled before generation, if a spike shows that `oapi-codegen` and `openapi-typescript` produce byte-identical output from the bundle. |
| H8 | Identifiers private to a plan (`A222`, `MQ27`, `S366`, `D12`) in comments and doc comments are replaced by the rule they cite or are defined in `docs/domain`. |

## Slices

| Slice | Content | Risk |
|---|---|---|
| S1 | H1 and the `CONTRIBUTING.md` link | None: documentation only |
| S2 | H2 and H3 | None: documentation only |
| S3 | H4, one feature per commit | Import paths; checked by typecheck and the web tests |
| S4 | H5 | Moved code; checked by the Go tests of the package |
| S5 | H7 spike, then H7 | Generated output must stay identical |
| S6 | H6 | Moved packages; checked by `depguard` and the Go tests |
| S7 | H8 | Comments only |

Each slice that moves code follows "Reorganizing existing code": tests before and after with equal pass count, one injected defect per new file.

## Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: no value varies by country. |
| R2 | Does not apply: no behavior changes. |
| R3 | Does not apply: no value set is added. |
| R4 | Does not apply: no extension point is added. |
| R5 | Does not apply: no user text is added. |
| R6 | Does not apply: no number or date is written. |
| C1 | Does not apply: no amount is stored or computed. |
| C2 | Does not apply: no amount is added or compared. |
| C3 | Does not apply: no currency is read. |
| C4 | Does not apply: no currency is displayed. |
| T1 | Does not apply: no date is used. |
| T2 | Does not apply: no calendar is read. |
| B1 | Does not apply: no table is added. |
| B2 | Does not apply: no operation is added. |
| B3 | Does not apply: no setting is added. |
| D1 | Does not apply: no table is added. |
| D2 | Does not apply: the schema does not change. |
| D3 | Does not apply: no recorded fact changes. |
| D4 | Does not apply: no external data is written. |
| D5 | Does not apply: the diagnostic file does not change. |
| S1 | Does not apply: no operation is added. Slice S5 keeps the `operationId` set equal. |
| S2 | Does not apply: no screen changes. |
| S3 | Does not apply: no user-visible behavior changes. |
| S4 | Does not apply: no assistant data changes. |
| X1 | Does not apply: no scenario is added. |
| X2 | Does not apply: no behavior changes. |
