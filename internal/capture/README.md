# capture

Reads text the owner writes into transaction drafts (docs/specs/2026-10-21-text-capture-design.md). It is the only entry point to the module for the rest of the application.

| | |
|---|---|
| OpenAPI tag | `capture`: 3 operations in `openapi.yaml` |
| Tables | prefix `capture_`, created in `db/migrations/` |
| Public API | `capture.go` (Module, New, Profiles) and `adapters.go` |
| Layers (hand-written files) | `domain/` (18), `app/` (3), `httpapi/` (1), `postgres/` (1), `llmapi/` (1) |
| Ports | `app/ports.go` (the interfaces the module needs: its repository and the other modules it calls) |
| Queries | `postgres/queries/` (1 files) |
| Tests | black-box tests in this directory (`*_test.go`: 5); package tests beside each layer |

Where each file of an endpoint lives: `docs/contributing/map.md`.
