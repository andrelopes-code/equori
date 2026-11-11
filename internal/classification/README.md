# classification

Decides categories with rules, payee aliases and payee history (docs/domain, 4.3.2). It is the only entry point to the module for the rest of the application.

| | |
|---|---|
| OpenAPI tag | `classification`: 21 operations in `openapi.yaml` |
| Tables | prefix `classification_`, created in `db/migrations/` |
| Public API | `classification.go` |
| Layers (hand-written files) | `domain/` (8), `app/` (11), `httpapi/` (5), `toolapi/` (5), `postgres/` (4) |
| Ports | `app/ports.go` (the interfaces the module needs: its repository and the other modules it calls) |
| Queries | `postgres/queries/` (6 files) |
| Tests | black-box tests in this directory (`*_test.go`: 12); package tests beside each layer |

Where each file of an endpoint lives: `docs/contributing/map.md`.
