# portfolio

Derives positions, realized results and income events from Ledger (docs/domain, 4.3.5). It is the only entry point to the module for the rest of the application.

| | |
|---|---|
| OpenAPI tag | `portfolio`: 9 operations in `openapi.yaml` |
| Tables | prefix `portfolio_`, created in `db/migrations/` |
| Public API | `portfolio.go` and the other 1 non-test files of this directory |
| Layers (hand-written files) | `domain/` (5), `app/` (10), `httpapi/` (1), `toolapi/` (3), `postgres/` (1) |
| Ports | `app/ports.go` (the interfaces the module needs: its repository and the other modules it calls) |
| Queries | `postgres/queries/` (3 files) |
| Tests | black-box tests in this directory (`*_test.go`: 11); package tests beside each layer |

Where each file of an endpoint lives: `docs/contributing/map.md`.
