# marketdata

Owns instruments, prices and business-day calendars (chapter 4, 4.3.6).

| | |
|---|---|
| OpenAPI tag | `marketdata`: 22 operations in `openapi.yaml` |
| Tables | prefix `marketdata_`, created in `db/migrations/` |
| Public API | `marketdata.go` and the other 23 non-test files of this directory |
| Layers (hand-written files) | `domain/` (8), `httpapi/` (8), `toolapi/` (3), `postgres/` (0) |
| Queries | `postgres/queries/` (9 files) |
| Tests | black-box tests in this directory (`*_test.go`: 30); package tests beside each layer |

Deviation from the layout of ADR 033: Use cases are methods of `Module` in the module root; there is no `app/` and no hand-written `postgres/` code. `httpapi/server.go` declares its own `Service` interface.

Where each file of an endpoint lives: `docs/contributing/map.md`.
