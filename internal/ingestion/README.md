# ingestion

Imports external data into the ledger: files now, aggregators later (chapter 4, 4.3.3). It reaches the ledger only through package ledger.

| | |
|---|---|
| OpenAPI tag | `ingestion`: 27 operations in `openapi.yaml` |
| Tables | prefix `ingestion_`, created in `db/migrations/` |
| Public API | `ingestion.go` |
| Layers (hand-written files) | `domain/` (21), `app/` (25), `httpapi/` (7), `toolapi/` (3), `postgres/` (7), `llmapi/` (1) |
| Ports | `app/ports.go` (the interfaces the module needs: its repository and the other modules it calls) |
| Queries | `postgres/queries/` (7 files) |
| Tests | black-box tests in this directory (`*_test.go`: 37); package tests beside each layer |

Deviation from the layout of ADR 033: Mechanism packages `aggregator/`, `charset/`, `csvfile/` and `ofx/` sit beside the layers.

Where each file of an endpoint lives: `docs/contributing/map.md`.
