# Map of the code base

Where each part of equori lives. Start here when a task names a screen, an endpoint, a table or a rule.

## Find the files of an existing endpoint

Start from the `operationId` in `api/openapi.yaml`. Replace `<module>` with the value of the operation's `tags` entry and `<topic>` with the file that names the concept.

| Hop | Location | How to find it |
|---|---|---|
| Contract | `api/openapi.yaml`, under `paths:` | Search the `operationId`. |
| Request and response types, router | `internal/<module>/internal/adapter/httpapi/api.gen.go` | Generated. Search the `operationId`; the handler method has the same name in upper camel case. |
| Handler | `internal/<module>/internal/adapter/httpapi/<topic>.go`, or `server.go` | Search `func (s *Server) <OperationId>`. |
| Use case | `internal/<module>/internal/app/<topic>.go` | Search the method the handler calls on `s.svc`. |
| Rule | `internal/<module>/internal/domain/<topic>.go` | Imported by the use case. |
| Port | `internal/<module>/internal/app/ports.go` | Interface `Repository` and the other ports. |
| Port implementation | `internal/<module>/internal/adapter/postgres/<topic>.go` | Search the port method name. |
| Query | `db/queries/<module>/<topic>.sql` | Generated Go: `internal/<module>/internal/adapter/postgres/<topic>.sql.gen.go`. |
| Public API of the module | `internal/<module>/<module>.go` | Other modules call the module only here. |
| Assistant and MCP tool | `internal/<module>/internal/adapter/toolapi/` | Composed in `internal/server/server.go`. |
| Tool exposure | `internal/server/tool_exposure_test.go` | One entry per `operationId`. |
| HTTP test | `internal/<module>/*_test.go` and `internal/apitest/` | Search the path or the scenario ID. |

Modules whose layout differs from this table are listed in "Modules" below.

## Add an endpoint

1. Add the operation under `paths:` in `api/openapi.yaml`: `tags`, `operationId`, `x-book-role`, request and response schemas. Reuse `#/components/responses/Problem` for errors.
2. Write the failing test first (`docs/contributing/agents.md`, `CONTRIBUTING.md`, Tests).
3. Add the query to `db/queries/<module>/<topic>.sql` when the operation reads or writes a table.
4. Run `make gen`. It regenerates `api.gen.go` in every module, `*.sql.gen.go` and `web/src/api/schema.gen.ts`.
5. Add the rule to `internal/<module>/internal/domain/<topic>.go` when the operation has one.
6. Add the use case to `internal/<module>/internal/app/<topic>.go`. Add a port method to `ports.go` when the use case needs new data access, and implement it in `internal/<module>/internal/adapter/postgres/<topic>.go`.
7. Add the handler `func (s *Server) <OperationId>` to `internal/<module>/internal/adapter/httpapi/<topic>.go`. The compiler rejects the build while a generated operation has no handler.
8. Add a public method to `internal/<module>/<module>.go` only when another module calls the operation.
9. Add an entry for the `operationId` to `internal/server/tool_exposure_test.go`: the tool that covers it or an exclusion listed in `internal/server/tools_test.go`. Run `go test ./internal/server -update` and commit the change of `internal/server/testdata/tools.json` when a tool changed.
10. Add each `Problem.code` returned by the operation to a test through `internal/apitest`.
11. Update the guide article of the screen's topic when a user can do something new (`CONTRIBUTING.md`, Code).
12. Run `make check` before the merge.

## Add a column or a table

1. Add a goose migration in `db/migrations/`. Never edit an applied migration.
2. Update the queries of the owner module in `db/queries/<module>/`.
3. Run `make gen`.
4. A table holds `books_id` and every query filters by it (ADR 003, ADR 029).

## Modules

| Module | Purpose | OpenAPI tag | Layout deviation |
|---|---|---|---|
| `assistant` | Language model providers and chains, conversations, guide articles | `assistant` | None |
| `capture` | Text typed by the owner into transaction drafts | `capture` | None |
| `classification` | Categories by rules, payee aliases and payee history | `classification` | None |
| `identity` | Members, sessions, books, access tokens, second factor | `identity` | `internal/password` and other mechanism packages beside `domain` and `app` |
| `ingestion` | Import of files and aggregator data into the ledger | `ingestion` | None |
| `instance` | Backups, encrypted copy, diagnostic file, version | `instance` | None |
| `ledger` | Accounts, transactions, balances, cards, statements | `ledger` | None. `httpapi` calls `*app.Service` directly. |
| `marketdata` | Instruments, prices, business-day calendars, index expectations | `marketdata` | Use cases are methods of `Module` in the module root (`price.go`, `probe.go`). There is no `internal/app` and no hand-written `internal/adapter/postgres`. `httpapi` declares its own `Service` interface in `server.go`. |
| `planning` | Schedules, occurrences, budgets, goals | `planning` | None |
| `portfolio` | Positions, realized results and income events derived from the ledger | `portfolio` | None |
| `reporting` | Read models derived from the ledger, export and import of archives | `reporting` | No `internal/domain`. The queries live in `internal/adapter/postgres`. |
| `server` | Composition of the modules: HTTP handler and outbox dispatcher | none | Not a business module |
| `platform` | Infrastructure without business rules (ADR 002) | none | Not a business module |
| `apitest` | HTTP test harness over `internal/server` | none | Test support only |

The table prefix of a table is the name of its owner module (`ledger_account`, `marketdata_*`). The outbox tables use `outbox_`.

## Web

| Task | Location |
|---|---|
| Route of a screen | `web/src/app/router.tsx` |
| Screen of a route | The page component that `web/src/app/router.tsx` imports from `web/src/features/<feature>/index.ts` |
| Queries and mutations of a feature | `web/src/features/<feature>/api.ts` |
| Types of the API | `web/src/api/schema.gen.ts` (generated from `api/openapi.yaml`) |
| Shared components | `web/src/ui/` |
| Application shell and providers | `web/src/app/shell/`, `web/src/app/providers.tsx` |
| Texts | `web/src/i18n/catalog-*.en.ts` and `catalog-*.pt-BR.ts` |
| Screen to guide topic | `web/src/navigation/navigation-map.json` |
| Theme | `web/src/theme/` |

Rules of the web code: `docs/contributing/web.md`. Commands: `make web-check` for build, typecheck, lint and format; `pnpm test` inside `web/` for the unit tests.
