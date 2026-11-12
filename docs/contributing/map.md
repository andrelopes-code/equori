# Map of the code base

Where each part of equori lives. Start here when a task names a screen, an endpoint, a table or a rule.

## Find the files of an existing endpoint

Start from the `operationId` in `api/openapi.yaml`. Replace `<module>` with the value of the operation's `tags` entry and `<topic>` with the file that names the concept.

| Hop | Location | How to find it |
|---|---|---|
| Contract | `internal/<module>/openapi.yaml`, under `paths:` | Search the `operationId` in `internal/*/openapi.yaml`. `api/openapi.yaml` is the generated bundle; never edit it. |
| Route | `internal/<module>/httpapi/server.go`, function `Register` | One line per operation: `mux.HandleFunc("POST "+BaseURL+"/path", httpserver.Handle(s.errs, status, s.<operationId>))`. Search the path. |
| Request and response types | `internal/<module>/httpapi/api.gen.go` | Generated models only. Search the schema name. |
| Handler | `internal/<module>/httpapi/<topic>.go`, or `server.go` | Search `func (s *Server) <operationId>`: lower camel case, the `operationId` of the contract. |
| Use case | `internal/<module>/app/<topic>.go` | Search the method the handler calls on `s.svc`. |
| Rule | `internal/<module>/domain/<topic>.go` | Imported by the use case. |
| Port | `internal/<module>/app/ports.go` | Interface `Repository` and the other ports. A module whose `ports.go` exceeded 400 lines keeps further groups in `ports_<group>.go` (`internal/ledger/app/`). |
| Port implementation | `internal/<module>/postgres/<topic>.go` | Search the port method name. |
| Query | `internal/<module>/postgres/queries/<topic>.sql` | Generated Go: `internal/<module>/postgres/<topic>.sql.gen.go`. |
| Public API of the module | `internal/<module>/<module>.go`, `types.go`, `<group>.go` | Other modules call the module only here. `config.go` holds the `Config`; `adapters.go` holds the adapters to other modules (ADR 035). |
| Assistant and MCP tool | `internal/<module>/toolapi/` | Composed in `internal/server/modules.go` (tools) and `internal/server/routes.go` (MCP). |
| Tool exposure | `internal/server/tool_exposure_test.go` | One entry per `operationId`. |
| HTTP test | `internal/<module>/*_test.go` and `internal/apitest/` | Search the path or the scenario ID. |

Composition files:

| Concern | Location |
|---|---|
| Process start, flags and subcommands | `cmd/equori/main.go`, `cmd/equori/commands.go` and one file per subcommand (`serve.go`, `backup.go`, `restore.go`, `user.go`, `version.go`, `healthcheck.go`) |
| `config.Config` to `server.Config` | `cmd/equori/config.go` |
| `server.Config` to each module `Config` | `internal/server/modules.go`; the `Config` type is in `internal/server/config.go` |
| Adapters between modules | `internal/server/adapters.go` |
| Application wiring | `internal/server/app.go` |
| HTTP routes and MCP | `internal/server/routes.go` |
| Outbox dispatcher | `internal/server/outbox.go` |
| API reference page | `internal/server/apidoc.go`, `internal/server/reference.html` |

Modules whose layout differs from this table are listed in "Modules" below.

## Add an endpoint

1. Add the operation under `paths:` in `internal/<module>/openapi.yaml`: `tags`, `operationId`, `x-book-role`, request and response schemas. Reuse `#/components/responses/Problem` for errors.
2. Write the failing test first (`docs/contributing/agents.md`, `CONTRIBUTING.md`, Tests).
3. Add the query to `internal/<module>/postgres/queries/<topic>.sql` when the operation reads or writes a table.
4. Run `make gen`. It rebuilds `api/openapi.yaml` from `api/base.yaml`, `api/shared.yaml` and the module files, then regenerates the models in `api.gen.go` of every module, `*.sql.gen.go` and `web/src/api/schema.gen.ts`.
5. Add the rule to `internal/<module>/domain/<topic>.go` when the operation has one.
6. Add the use case to `internal/<module>/app/<topic>.go`. Add a port method to `ports.go` when the use case needs new data access, and implement it in `internal/<module>/postgres/<topic>.go`.
7. Add the handler `func (s *Server) <operationId>` to `internal/<module>/httpapi/<topic>.go` and one line to `Register` in `internal/<module>/httpapi/server.go`. `httpserver.Handle` decodes the body and writes the result; `httpserver.Query`, `PathUUID` and `PathInt64` read the request; `httpserver.HandleCreated` answers 201 with a Location header. A response with a header, a stream or a multipart body is a plain `func(w, r)` handler that sends errors through `s.errs.Write`. `TestEveryOperationHasARoute` in the module's `httpapi` fails while an operation of the tag has no route.
8. Add a public method to `internal/<module>/<module>.go` only when another module calls the operation.
9. Add an entry for the `operationId` to `internal/server/tool_exposure_test.go`: the tool that covers it or an exclusion listed in `internal/server/tools_test.go`. Run `go test ./internal/server -update` and commit the change of `internal/server/testdata/tools.json` when a tool changed.
10. Add each `Problem.code` returned by the operation to a test through `internal/apitest`.
11. Update the guide article of the screen's topic when a user can do something new (`CONTRIBUTING.md`, Code).
12. Run `make check` before the merge.

## Add a column or a table

1. Add a goose migration in `db/migrations/`. Never edit an applied migration.
2. Update the queries of the owner module in `internal/<module>/postgres/queries/`.
3. Run `make gen`.
4. A table holds `books_id` and every query filters by it (ADR 003, ADR 029).

## Modules

| Module | Purpose | OpenAPI tag | Layout deviation |
|---|---|---|---|
| `assistant` | Language model providers and chains, conversations, guide articles | `assistant` | None |
| `capture` | Text typed by the owner into transaction drafts | `capture` | None |
| `classification` | Categories by rules, payee aliases and payee history | `classification` | None |
| `identity` | Members, sessions, books, access tokens, second factor | `identity` | `password/` and other mechanism packages beside `domain` and `app` |
| `ingestion` | Import of files and aggregator data into the ledger | `ingestion` | None |
| `instance` | Backups, encrypted copy, diagnostic file, version | `instance` | None |
| `ledger` | Accounts, transactions, balances, cards, statements | `ledger` | None. `httpapi` calls `*app.Service` directly. |
| `marketdata` | Instruments, prices, business-day calendars, index expectations | `marketdata` | Use cases are methods of `Module` in the module root (`price.go`, `probe.go`). There is no `app/` and no hand-written `postgres/` code. `httpapi` declares its own `Service` interface in `server.go`. |
| `planning` | Schedules, occurrences, budgets, goals | `planning` | None |
| `portfolio` | Positions, realized results and income events derived from the ledger | `portfolio` | None |
| `reporting` | Read models derived from the ledger, export and import of archives | `reporting` | No `domain/`. The queries live in `postgres/`. |
| `server` | Composition of the modules: HTTP handler and outbox dispatcher | none | Not a business module |
| `platform` | Infrastructure without business rules (ADR 002) | none | Not a business module |
| `apitest` | HTTP test harness over `internal/server` | none | Test support only |

The table prefix of a table is the name of its owner module (`ledger_account`, `marketdata_*`). The outbox tables use `outbox_`.

## Identifiers in comments

A comment or a commit may cite an identifier such as `S364`, `MQ27` or `HA9`. The identifier is defined in one document; prefixes below name it. A prefix that two or more documents use (`A`, `D`, `R`, `P`, `F`, `C`) is resolved with `git grep -n "| <ID> " docs` or `git grep -n "<ID>\." docs`, then by the date of the commit that cites it.

| Prefix | Defined in |
|---|---|
| `S` followed by digits | `docs/domain/06-scenarios.md` (acceptance scenarios; also the `S` rows of `docs/contributing/feature-design.md`) |
| `N` | `docs/domain/08-non-functional-requirements.md` |
| `M` | `docs/contributing/currencies.md` |
| `O` | `docs/contributing/web.md` |
| `R`, `C`, `B`, `D`, `X` in a checklist row | `docs/contributing/feature-design.md` |
| `HA` | `docs/specs/2026-10-30-households-access-design.md` |
| `BK` | `docs/specs/2026-10-30-shared-books-design.md` |
| `MQ` | `docs/specs/2026-11-09-market-quotes-design.md` |
| `PC` | `docs/specs/2026-11-07-portfolio-clarity-design.md` |
| `CN` | `docs/specs/2026-11-12-contribution-plan-design.md` |
| `T` | `docs/adr/012-tool-registry.md` for tool rows; `T1` and `T2` of `docs/contributing/feature-design.md` are time rows |

## Web

| Task | Location |
|---|---|
| Where a feature keeps its files | `web/src/features/<feature>/README.md`; the shape is rule O16 of `docs/contributing/web.md` |
| Route of a screen | `web/src/app/router.tsx` |
| Screen of a route | The page component that `web/src/app/router.tsx` imports from `web/src/features/<feature>/index.ts` |
| Queries and mutations of a feature | `web/src/features/<feature>/api.ts` |
| Types of the API | `web/src/api/schema.gen.ts` (generated from `api/openapi.yaml`) |
| Shared components | `web/src/ui/<concept>/`; `web/src/ui/README.md` lists the folders |
| Application shell and providers | `web/src/app/shell/`, `web/src/app/providers.tsx` |
| Texts | `web/src/i18n/catalog-*.en.ts` and `catalog-*.pt-BR.ts` |
| Screen to guide topic | `web/src/navigation/navigation-map.json` |
| Theme | `web/src/theme/` |

Rules of the web code: `docs/contributing/web.md`. Commands: `make web-check` for build, typecheck, lint and format; `pnpm test` inside `web/` for the unit tests.
