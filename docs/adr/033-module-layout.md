# ADR 033: Module layout without nested internal

- Status: accepted
- Date: 2026-11-11
- Supersedes: the layout block and the compiler row of the dependency table of ADR 002

## Decision

Each business module holds its code, its queries and its contract in one directory. The layers sit one level under the module. The directories `internal/` and `adapter/` inside a module do not exist.

```
internal/<module>/
  README.md            purpose, owned table prefix, OpenAPI tag, entry file of each layer
  <module>.go          public API: Module, DTOs; the only package other modules import
  openapi.yaml         operations and schemas of the module; `make gen` bundles every module file with api/base.yaml and api/shared.yaml into api/openapi.yaml
  domain/              entities and invariants; stdlib and platform/money only
  app/                 use cases; declares the ports (Repository, Clock)
  httpapi/             routes (`Register`) and handlers; api.gen.go (models only) and oapi-codegen.yaml (ADR 034)
  toolapi/             assistant and MCP tools
  postgres/            repository; sqlc output (*.gen.go); queries/*.sql
  <mechanism>/         optional private package: password, feed, calendar, llmapi
  *_test.go            black-box tests of the public API, named by area
```

Limits of the layout:

| Limit | Value |
|---|---|
| Depth of a layer file | 4 levels: `internal/<module>/<layer>/<file>`; a mechanism package (`feed/yahoochart`) adds one level |
| Hand-written non-test Go files in one directory | 40 |
| Lines in one hand-written non-test Go file | 600 |
| Files in one `web/src` directory, tests included | 40; `web/src/theme` is exempt |

Tests are not counted in the Go limits: a module root keeps its black-box tests, named by area (`card_*_test.go`). `internal/platform/layout` enforces the limits.

## Isolation between modules

The nested `internal/` directory no longer isolates the layers of a module. `depguard` (`.golangci.yml`) enforces these rules:

| Rule | Enforcement |
|---|---|
| A package outside `internal/<module>/` imports only the root package of the module | `depguard`, one rule per module; `internal/server` and `internal/apitest` are exempt |
| `domain` imports only the stdlib and the packages listed in `.golangci.yml` | `depguard` |
| `app` does not import `httpapi`, `postgres`, `toolapi`, `llmapi`, `net/http`, `database/sql` or `pgx` | `depguard` |

The dependency rules of ADR 002 (table ownership, no transaction across modules, the amendments of 2026-10-26 and 2026-11-09) stay unchanged.

## Deviations

`marketdata` and `reporting` predate the layout and keep their shape. `marketdata` holds its use cases as methods of `Module` in the module root and has no `app/`. `reporting` has no `domain/`. Each README states its deviation. Moving them changes design, not structure, and is left to a decision of its own.

## Generated code

`api.gen.go`, `*.sql.gen.go`, `db.gen.go` and `models.gen.go` stay beside the hand-written files of their layer. Their names end in `.gen.go`. `make gen` writes them; `make gen-check` rejects a diff.
