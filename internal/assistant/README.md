# assistant

Stores each book's language model providers and chains, and resolves the targets of a use (ADR 019).

| | |
|---|---|
| OpenAPI tag | `assistant`: 19 operations in `openapi.yaml` |
| Tables | prefix `assistant_`, created in `db/migrations/` |
| Public API | `assistant.go` |
| Layers (hand-written files) | `domain/` (7), `app/` (18), `httpapi/` (6), `toolapi/` (2), `postgres/` (4), `llmapi/` (3) |
| Queries | `postgres/queries/` (5 files) |
| Tests | black-box tests in this directory (`*_test.go`: 19); package tests beside each layer |

Where each file of an endpoint lives: `docs/contributing/map.md`.
