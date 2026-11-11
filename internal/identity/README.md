# identity

Manages members and sessions (ADR 003). It is the only entry point to the module for the rest of the application.

| | |
|---|---|
| OpenAPI tag | `identity`: 36 operations in `openapi.yaml` |
| Tables | prefix `identity_`, created in `db/migrations/` |
| Public API | `identity.go` and the other 1 non-test files of this directory |
| Layers (hand-written files) | `domain/` (8), `app/` (14), `httpapi/` (7), `toolapi/` (2), `postgres/` (5) |
| Ports | `app/ports.go` (the interfaces the module needs: its repository and the other modules it calls) |
| Queries | `postgres/queries/` (5 files) |
| Tests | black-box tests in this directory (`*_test.go`: 23); package tests beside each layer |

Deviation from the layout of ADR 033: `password/` is a mechanism package beside the layers.

Where each file of an endpoint lives: `docs/contributing/map.md`.
