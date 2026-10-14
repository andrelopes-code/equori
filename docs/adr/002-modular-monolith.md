# ADR 002: Modular monolith with ports and adapters per module

- Status: accepted
- Date: 2026-10-14

## Decision

One Go module, one binary, one container. Business code is split into modules under `internal/<module>/`.

Module layout:

```
internal/<module>/
  <module>.go          # public API: Module, Service interface, DTOs
  internal/
    domain/            # entities and invariants; stdlib and platform/money only
    app/               # use cases; declares ports (Repository, Clock)
    adapter/
      postgres/        # implements ports; sqlc output (*.gen.go) lives here
      httpapi/         # strict server from api/openapi.yaml (oapi-codegen.yaml selects the module tag)
    <mechanism>/       # optional module-private package, e.g. identity/internal/password
```

The root package composes the module and exposes `RegisterRoutes`; `cmd/equori` registers every module on one `http.ServeMux`.

## Dependency rules

| Rule | Enforcement |
|---|---|
| `domain` imports only the stdlib and `internal/platform/money` (ADR 005) | `depguard` (`.golangci.yml`) |
| `app` does not import `adapter`, `net/http`, `database/sql` or `pgx` | `depguard` |
| A module reaches another module only through its root package | Compiler: nested `internal` directory |
| Each table has one owner module; only the owner writes to it | Table name prefixed by module; sqlc queries in `db/queries/<module>/` |
| `reporting` reads other modules' tables with `SELECT` only | Code review |
| A database transaction never spans modules | The owner module exposes the atomic operation |

`internal/platform/` holds infrastructure without business rules: config, database connection, migrations, HTTP server.

## Revisit criterion

Split into services only if two modules need independent deployment or scaling.
