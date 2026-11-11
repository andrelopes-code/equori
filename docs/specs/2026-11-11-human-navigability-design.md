# Human navigability of the code base

Status: draft. Scope: structure, documentation and file layout. No behavior changes. Plan: `docs/superpowers/plans/2026-11-11-human-navigability.md`.

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
| Largest hand-written non-test Go file | `internal/ledger/postgres/repository.go`, 1486 lines |
| Files in `web/src/features/accounts`, `transactions`, `setup`, `instruments` | 234, 194, 191, 88 |
| Subfolders in `web/src/features/instruments` among its first 60 files | 0 |
| README files inside `internal/` or `web/src/` | 0 |
| Document that lists the files of one endpoint | none |

## Goals

1. A contributor finds the files of an existing endpoint, screen or rule in at most three lookups, starting from a path, a screen name or an `operationId`.
2. A contributor adds an endpoint by following one checklist that names each file and command.
3. Every module follows one layout, or its deviation is written in the module README.
4. A directory holds at most 40 hand-written files, tests included.
5. Hand-written Go code sits at most 4 levels under `internal/`. A hand-written non-test file holds at most 400 lines.
6. The contract and the queries of a module sit inside the module directory.

## Non-goals

- No change to the module boundaries, the dependency rules or the generators of ADR 002 and ADR 028. The enforcement of isolation between modules moves from the nested `internal/` directory to `depguard` (ADR 033).
- No change to behavior, API contract, SQL schema or user interface.
- No removal of generated code.

## Decisions

| ID | Decision |
|---|---|
| H1 | The navigation map is `docs/contributing/map.md`. |
| H2 | Each module root holds a `README.md` of at most 30 lines: purpose, owned table prefix, OpenAPI tag, entry file of each layer, deviations. |
| H3 | Each web feature holds a `README.md` of at most 30 lines: route, entry component, endpoints, guide topic. |
| H4 | The layers of a module move from `internal/<module>/internal/{domain,app,adapter/*}` to `internal/<module>/{domain,app,httpapi,postgres,toolapi}`. Mechanism packages move beside them. |
| H5 | `db/queries/<module>/` moves to `internal/<module>/postgres/queries/`. |
| H6 | `api/openapi.yaml` becomes a generated bundle of `internal/<module>/openapi.yaml` files and `api/shared.yaml`, if a spike shows byte-identical generated output. |
| H7 | `marketdata` and `reporting` follow the layout of H4. |
| H8 | Web features split into `pages/`, sub-screen folders and `model/`. A feature above 40 files splits into sub-features. |
| H9 | Hand-written non-test Go files above 400 lines are split by topic. Black-box module tests move to `tests/<area>/` if a spike shows equal pass count. |
| H10 | Identifiers private to a plan (`A222`, `MQ27`, `S366`, `D12`) in comments are replaced by the rule they cite. |
| H11 | A Go test fails when a directory holds more than 40 hand-written files or a non-test file holds more than 400 lines. |
| H12 | Move commits are listed in `.git-blame-ignore-revs`. |

## Slices

The phases and tasks of `docs/superpowers/plans/2026-11-11-human-navigability.md` are the slices. Each slice that moves code follows "Reorganizing existing code": tests before and after with equal pass count, one injected defect per new file.

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
