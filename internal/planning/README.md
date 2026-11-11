# planning

Expects money through schedules, occurrences, budgets and goals (docs/domain, 4.3.4). It is the only entry point to the module for the rest of the application.

| | |
|---|---|
| OpenAPI tag | `planning`: 28 operations in `openapi.yaml` |
| Tables | prefix `planning_`, created in `db/migrations/` |
| Public API | `planning.go` and the other 1 non-test files of this directory |
| Layers (hand-written files) | `domain/` (8), `app/` (11), `httpapi/` (8), `toolapi/` (8), `postgres/` (6) |
| Ports | `app/ports.go` (the interfaces the module needs: its repository and the other modules it calls) |
| Queries | `postgres/queries/` (6 files) |
| Tests | black-box tests in this directory (`*_test.go`: 21); package tests beside each layer |

Where each file of an endpoint lives: `docs/contributing/map.md`.
