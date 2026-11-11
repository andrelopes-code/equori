# ledger

Records accounts, transactions and balances (docs/domain, chapters 5 and 7). It is the only entry point to the module for the rest of the application.

| | |
|---|---|
| OpenAPI tag | `ledger`: 80 operations in `openapi.yaml` |
| Tables | prefix `ledger_`, created in `db/migrations/` |
| Public API | `ledger.go` and the other 10 non-test files of this directory |
| Layers (hand-written files) | `domain/` (22), `app/` (40), `httpapi/` (20), `toolapi/` (20), `postgres/` (24) |
| Queries | `postgres/queries/` (12 files) |
| Tests | black-box tests in this directory (`*_test.go`: 84); package tests beside each layer |

Deviation from the layout of ADR 033: `httpapi` calls `*app.Service` directly; the module root holds one file per group of public methods.

Where each file of an endpoint lives: `docs/contributing/map.md`.
