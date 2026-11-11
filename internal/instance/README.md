# instance

Holds the backups, the encrypted copy, the diagnostic file and the version notice of the whole instance (docs/specs/2026-10-31-protected-data-design.md).

| | |
|---|---|
| OpenAPI tag | `instance`: 6 operations in `openapi.yaml` |
| Tables | prefix `instance_`, created in `db/migrations/` |
| Public API | `instance.go` |
| Layers (hand-written files) | `domain/` (3), `app/` (4), `httpapi/` (4), `postgres/` (2) |
| Ports | `app/ports.go` (the interfaces the module needs: its repository and the other modules it calls) |
| Queries | `postgres/queries/` (1 files) |
| Tests | black-box tests in this directory (`*_test.go`: 5); package tests beside each layer |

Where each file of an endpoint lives: `docs/contributing/map.md`.
