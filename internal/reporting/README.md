# reporting

Maintains read models derived from the ledger (chapter 4, 4.3.7).

| | |
|---|---|
| OpenAPI tag | `reporting`: 11 operations in `openapi.yaml` |
| Tables | prefix `reporting_`, created in `db/migrations/` |
| Public API | `reporting.go` |
| Layers (hand-written files) | `app/` (10), `httpapi/` (5), `toolapi/` (4), `postgres/` (5) |
| Queries | `postgres/queries/` (4 files) |
| Tests | black-box tests in this directory (`*_test.go`: 14); package tests beside each layer |

Deviation from the layout of ADR 033: No `domain/`; the queries and their mapping live in `postgres/`.

Where each file of an endpoint lives: `docs/contributing/map.md`.
