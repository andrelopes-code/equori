# Backend organization audit

Phase A of `docs/superpowers/plans/2026-11-12-backend-reorganization-brief.md`. Read-only; no code changed.

## Method

One Sonnet subagent read each package group. Columns: `File`, `Symbol`, `Problem`, `Target`. Scope: production Go files outside `*.gen.go`, `*_test.go` and `testdata`. The reading coverage of a group is stated in the notes of its section. Names of step functions are proposals; the task that applies a row confirms them against the function body.

## Baseline (2026-11-12, `main`)

Measured by AST (`go/parser`) over `internal/` and `cmd/`, production files. A function body is the lines between `{` and `}`, exclusive.

| Measure | Value |
|---|---|
| Files above 400 lines | 17 |
| Functions above 50 lines | 197 of 3708 |
| Largest file | `internal/ledger/app/imports.go`, 596 lines |
| `cmd/equori/main.go` | 474 lines |
| `internal/server/server.go` | 333 lines |

The brief counts 189 of 3227 with another criterion. This section is the reference of the plan.

Functions above 50 lines per module: ledger 62, planning 24, ingestion 22, marketdata 17, classification 15, reporting 11, platform 11, portfolio 8, capture 6, assistant 6, cmd/equori 6, cmd/demoseed 5, identity 3, server 1.

## Group: cmd-server-apitest


### Verdicts per package

- cmd/equori: name ok; main.go (474 lines) holds eleven responsibilities; other files (backup, database, environment, listen, secrets, service, setup_url, user, version) hold one concept each.
- cmd/demoseed: name ok; one file per seeding topic; invest.go, reconcile.go, cashflow.go, seeder.go and chart.go mix concepts; two functions above 50 lines beyond purchases.
- internal/server: name ok; server.go holds Config, App, New (201 lines), outbox, routes, MCP wiring; credential_source.go, instance_ports.go, account_notices.go, signals.go are adapters in separate files.
- internal/apitest: name ok / file boundaries ok. Every file is test support; no production code depends on it. options.go (152 lines) holds only Option constructors.

### Responsibility map: cmd/equori/main.go (474 lines, limit for main.go 80)

| Responsibility (current lines) | Target file | Target symbol |
|---|---|---|
| Entry point, dispatch on os.Args (39-105) | main.go | `main`, `run(args) error` (switch only, one call per case) |
| `version` variable (37) | version.go | `version`, `buildVersion` (464-474), beside `versionText` |
| Serve entry incl. Windows service branch and signal context (47-69) | serve.go | `runServe() error` |
| `serve` (107-253) | serve.go | step functions below |
| reportingCommand (256-281) | reporting.go | `reportingCommand` |
| planningCommand (284-309) | planning.go | `planningCommand` |
| portfolioCommand (312-337) | portfolio.go | `portfolioCommand` |
| Shared body of the three subcommands (setup, openDatabase, server.New with empty Config, close) | commands.go | `withApp(run func(ctx, *server.App) error) error`; the three commands pass `app.Reporting.RebuildAll`, `app.Planning.Backfill`, `app.Portfolio.RebuildAll` |
| config.Config to server.Config mapping (339-356) | config.go | `serverConfig`; the mutations of serve lines 162-171 move here as `serveConfig(cfg, file, ring, db, log)` |
| `families` (359-364), `setup` config load part (366-377), `keyDirectory` (421-427) | config.go | `families`, `loadConfig(file)`, `keyDirectory`, `loadSecretKey(cfg, getenv, log)` |
| Logging setup (407-417) | logging.go | `logHandler`, `newLogger(cfg)`; `setup` (366-405) is split into loadConfig, prepareDataDir, newLogger, loadSecretKey, startWarnings and stays in config.go as the caller |
| Healthcheck (429-462) | healthcheck.go | `healthcheck` |
| Existing small files | unchanged | environment.go, listen.go, setup_url.go |
| `errUsage` (user.go:30), used by the three subcommands | commands.go | `errUsage` |

### Step functions: `serve` (main.go:107-253, 145 lines) to serve.go, order of side effects kept

| # | Side effect and current lines | Step function (serve.go unless noted) |
|---|---|---|
| 1 | setup: read env file, load config, PrepareDataDir (managed), create logger, load or create secret.key, start warnings (108-111) | `loadConfig`, `newLogger` in config.go and logging.go; serve calls `setup()` |
| 2 | wrap log with logring (113-114) | `withLogRing(log) (*logring.Ring, *slog.Logger)` in logging.go |
| 3 | second `readEnvFile` (116-119); `setup` already reads it | `setup` returns the file; the second read is removed |
| 4 | `postgres.LatestVersion` and "starting equori" log (121-126) | `logStart(log)` |
| 5 | cancelable context (128-129), before the database opens | stays in `runServe` |
| 6 | `openDatabase` starts the managed cluster; `defer db.Close` registered here (131-135) | stays in `serve` (defer must sit in the opening function) |
| 7 | locale check and warning (136-144) | `checkLocale(ctx, db, log)` |
| 8 | goroutine that cancels on cluster exit, channel `postgresExit` (146-158) | `watchPostgres(ctx, stop, db) <-chan error` |
| 9 | build clock and server.Config (160-171) | `serveConfig` in config.go |
| 10 | `server.New` (173-176) | stays in `serve` |
| 11 | `ReconcileCurrencies` (178-180), then `StartSetup` and `announceSetup` (182-190); both before any goroutine | `prepareApp(ctx, app, cfg, log) error` |
| 12 | start dispatcher, scheduler, planning, feeds, versions, backups goroutines (192-231), all after step 11 and before the HTTP listener | `startBackground(ctx, app, cfg) *background` with `background.Stop(log)` |
| 13 | deferred shutdown: stop, wait for five loops, wait for dispatcher (233-244); runs before `db.Close` because defers run last-in first-out | `background.Stop(stop, log)`; `defer` registered in `serve` after step 12 |
| 14 | HTTP server run, listenError, postgresExit result (246-252) | `runHTTP(ctx, cfg, app, log, postgresExit) error` |

### Step functions: `server.New` (server.go:116-318, 201 lines)

Module constructors register outbox subscriptions on the dispatcher; the construction order below must stay, because it sets the subscription order and the dependency availability.

| # | Side effect and current lines | Step function and target file |
|---|---|---|
| 1 | contract validator (117-120) | stays in `New` (app.go) |
| 2 | dispatcher, clock default (122-127) | `newClock(cfg)` in app.go; `newDispatcher` in outbox.go |
| 3 | identity.New, then `dispatcher.UseBooks` (129-142) | `newIdentity(pool, cfg, log, dispatcher)` in modules.go; the UseBooks call moves to `wireOutbox(dispatcher, identity)` in outbox.go, called right after |
| 4 | version default, feed validation, sources, indexSources (144-164) | `newFeedSources(cfg, version)` in modules.go |
| 5 | marketdata.New, WithFeeds, WithProfiles, WithAdmins (166-170) | `newMarketdata(pool, cfg, identity, clk, log, sources)` in modules.go |
| 6 | ledger, reporting, classification constructors (171-173) | `newCoreModules(...)` in modules.go (three one-line constructors) |
| 7 | assistant.New, router, UseRouter (175-185) | `newAssistant(pool, cfg, identity, clk, log)` and `newRouter(...)` in modules.go |
| 8 | capture.New (186) | `newCapture(...)` in modules.go, or inline in `newCoreModules` |
| 9 | ingestion.New (188-195) | `newIngestion(...)` in modules.go |
| 10 | instance config assembly and instance.New, `identity.UseUpdateCheck` (196-207) | `newInstance(pool, cfg, deps, log)` in modules.go; `connections` stays in adapters.go |
| 11 | `assistant.UseNotices` (209) | `linkAdapters(m)` in adapters.go |
| 12 | portfolio.New (211-214) | `newPortfolio(...)` in modules.go |
| 13 | `reporting.OnImport`, `UseCredentials`, `UseIndicatorSources` (216-217, 220) and `assistant.UseSignals` (221), after planning.New (219) | `newPlanning(...)` in modules.go; the four Use calls in `linkAdapters` in adapters.go, called after step 12 and planning.New |
| 14 | tool registry, chatNames, chatTools, `assistant.UseTools` (223-243) | `buildTools(modules, cfg, log)` in modules.go or tools.go |
| 15 | mux: healthz, apidoc, module routes in the order identity, assistant, ledger, reporting, ingestion, instance, classification, capture, planning, portfolio, marketdata, `/api/`, SPA or dev redirect (245-269) | `registerRoutes(mux, app, cfg, log)` in routes.go |
| 16 | root mux: `/mcp` with Verify closure, authorize wrapper (271-297) | `mcpHandler(...)` and `mcpGrant(identity)` in routes.go; `mcpPrompts` moves to adapters.go |
| 17 | App literal and httpserver.Middleware with BodyLimits (299-317) | `newHandler(root, modules, log)` in routes.go; `App` literal in app.go |

### Findings

| File | Symbol | Problem | Target |
|---|---|---|---|
| cmd/demoseed/cashflow.go | `extras` (54 lines) | oversized function | `extrasTravel`, `extrasGifts`, `extrasHealth`; each step records its own events |
| cmd/demoseed/cashflow.go | `gross`, `inssOf`, `irrfOf` | mixed responsibility | cmd/demoseed/tax.go (payroll tax rules apart from expense and bill scheduling) |
| cmd/demoseed/chart.go | `buildChart` (60 lines) | oversized function | `buildInstitutions`, `buildAccounts`, `buildCards`, `buildCategoryTrees`; table of data in chart.go |
| cmd/demoseed/chart.go | `institutions`, `accounts`, `cards`, `*Categories` (314 lines) | mixed responsibility | cmd/demoseed/chart_data.go for tables; chart.go keeps builders |
| cmd/demoseed/invest.go | `goals`, `transfers`, `income` | mixed responsibility | cmd/demoseed/goals.go, cmd/demoseed/transfers.go; invest.go (398 lines) keeps securities and trades |
| cmd/demoseed/main.go | `run` (52 lines) | oversized function | `parseFlags`, `connect`, `ensureEmpty`; `run` calls them in order |
| cmd/demoseed/purchases.go | `purchases` (91 lines) | oversized function | table of data: exempt; split purchase list into `purchasesCard`, `purchasesInstallments`, `purchasesForeign` if rows are code |
| cmd/demoseed/purchases.go | `miniPDF`, `attach`, `day` | mixed responsibility | cmd/demoseed/attachment.go (`miniPDF`, `attach`); `day` to engine.go |
| cmd/demoseed/reconcile.go | `importStatements` (57 lines) | oversized function | `importBankStatements`, `importCardStatements`, `importExtraLines` |
| cmd/demoseed/reconcile.go | `bankOFX`, `cardOFX`, `ofxLine`, `upload` | mixed responsibility | cmd/demoseed/ofx.go (OFX builders), cmd/demoseed/seeder.go keeps HTTP `upload`; reconcile.go (341 lines) keeps reconciliation |
| cmd/demoseed/seeder.go | `money`, `brl`, `posting`, `post` | misplaced type | cmd/demoseed/money.go; seeder.go keeps HTTP client and state |
| cmd/equori/backup.go | `backupCommand` (54 lines) | oversized function | `parseBackupFlags`, `resolveBackupPath`, `runBackup` |
| cmd/equori/backup.go | `restoreCommand` (56 lines) | oversized function | `parseRestoreFlags`, `confirmRestore`, `runRestore`; move to cmd/equori/restore.go |
| cmd/equori/main.go | whole file (474 lines) | oversized file | main.go (<=80), serve.go, config.go, logging.go, healthcheck.go, version.go, reporting.go, planning.go, portfolio.go, commands.go |
| cmd/equori/main.go | `main` (65 lines) | oversized function | `run(args) error` with one function per case; `runServe` holds the service and signal branches |
| cmd/equori/main.go | `serve` (145 lines) | oversized function | `setup`, `withLogRing`, `logStart`, `checkLocale`, `watchPostgres`, `serveConfig`, `prepareApp`, `startBackground`, `runHTTP`; see step table |
| cmd/equori/main.go | `reportingCommand`, `planningCommand`, `portfolioCommand` | mixed responsibility | one file per subcommand over `withApp` in cmd/equori/commands.go; three bodies are identical except args check and one call |
| cmd/equori/main.go | `serverConfig` | wiring in the wrong place | cmd/equori/config.go, with the field assignments of serve lines 162-171 |
| cmd/equori/main.go | `setup` (40 lines) | mixed responsibility | cmd/equori/config.go: `loadConfig`, `loadSecretKey`; `newLogger` in logging.go |
| cmd/equori/main.go | `readEnvFile` called in `setup` and in `serve` | config scattered | `setup` returns the file; one call, in cmd/equori/config.go |
| cmd/equori/secrets.go | `secretsCommand` (64 lines) | oversized function | `parseRotateArgs`, `readPassphrase`, `rotateKeys`, `writeKeyFile` |
| cmd/equori/user.go | `createUser` (54 lines) | oversized function | `parseCreateArgs`, `buildUserInput`; `createUser` calls identity |
| cmd/equori/user.go | `errUsage` | misplaced type | cmd/equori/commands.go (used by reporting, planning, portfolio, user) |
| internal/server/server.go | `Config` | config scattered | internal/server/config.go |
| internal/server/server.go | `App` | misplaced type | internal/server/app.go, with `New` and `contractValidator` |
| internal/server/server.go | whole file (333 lines) | oversized file | config.go, app.go, modules.go, adapters.go, outbox.go, routes.go |
| internal/server/server.go | `New` (201 lines) | oversized function | `newIdentity`, `newFeedSources`, `newMarketdata`, `newAssistant`, `newIngestion`, `newInstance`, `newPortfolio`, `newPlanning`, `linkAdapters`, `buildTools`, `registerRoutes`, `mcpHandler`, `newHandler` |
| internal/server/server.go | `mcpPrompts` | wiring in the wrong place | internal/server/adapters.go (adapter from assistant prompts to mcp) |
| internal/server/server.go | `dispatcher.UseBooks`, `dispatcher.Counts` use | wiring in the wrong place | internal/server/outbox.go: `newDispatcher`, `wireOutbox` |
| internal/server/server.go | inline `Verify` closure of `/mcp` (lines 275-293) | wiring in the wrong place | internal/server/routes.go: `mcpGrant(identity) func(ctx, token) (mcp.Grant, error)` |
| internal/server/account_notices.go | `accountNotices` | wrong package | internal/server/adapters.go (merge four adapter files: account_notices.go, credential_source.go, instance_ports.go, signals.go) |
| internal/server/credential_source.go | `credentialSource`, `integrationCredentials`, `providerKeys` | unclear name | internal/server/adapters.go; keep type name, file name states no concept |
| internal/server/instance_ports.go | `connections` | unclear name | internal/server/adapters.go; file name "ports" conflicts with app/ports.go meaning |
| internal/server/signals.go | `recurringSignals` | wrong package | internal/server/adapters.go |
| internal/apitest/ofx.go | `Harness.Import` | mixed responsibility | internal/apitest/request.go (HTTP call on Harness); ofx.go keeps OFX builders |
| internal/apitest/fixture.go | `Brl` and `Posting` vs `Harness.Money`, `Harness.Posting` in profile.go | mixed responsibility | internal/apitest/profile.go keeps profiles; money helpers to internal/apitest/fixture.go |

## Group: platform-a


### Verdicts per package

- `internal/platform/llm`: name ok; file boundaries not ok (`router.go` holds Router and Client; `request.go` holds the response types; `use.go` holds provider ports; `tools.go` collides in name with package `tool`). Subpackages `openai`, `aistudio` (provider adapters) and `llmtest` (test support, separate package) are in the group.
- `internal/platform/tool`: name ok; file boundaries not ok (`preview.go` holds argument parsing and Registry methods; Set is split over three files). `ChangeFields` lists finance field names inside platform. No business rule is executed.
- `internal/platform/tool/mcp`: name ok; `Config` declared in `mcp.go` beside `New`; target `config.go`.
- `internal/platform/config`: name ok; configuration type `Config` is already in `config.go`; `Variable` methods are scattered over `config.go` and `variables.go`. `variables.go` is a table of data (exempt).
- `internal/platform/registry`: name ok, but two concepts in one file (generic keyed set, identifier format). Importers are four modules; no obvious owner; stays.
- `internal/platform/contract`: name ok; one file holds routing, request checks and error translation (321 lines, below 400).
- `internal/platform/apidoc`: name ok; single file with one importer (`internal/server`).
- `internal/platform/httpserver`: package comment says "lifecycle and health endpoint"; the package also holds handler adapters for module `httpapi` packages.

### Import cycles of the proposed moves

- `platform/httphandler` imports `platform/httpserver` (RequestID) and `platform/problem`; `httpserver` imports only `problem`. No cycle.
- `internal/server` absorbing `apidoc` adds no import: `apidoc` imports no internal package. No cycle.
- `internal/apitest` taking output validation from `tool` adds no import: `apitest/tool.go` already imports `tool`. No cycle.
- `platform/contract` imports `httpserver`; after the split it still imports only `httpserver` and `problem`. No cycle.
- Moves inside one package (`llm`, `tool`, `tool/mcp`, `config`, `registry`, `contract`, `aistudio`, `openai`) add no import.
- Rejected move: `ChangeFields` into each `internal/<module>/toolapi` would make `platform/tool` read module data, or force `toolapi` to import `server`. Cycle risk; not proposed.

### Findings

| File | Symbol | Problem | Target |
|---|---|---|---|
| internal/platform/apidoc/apidoc.go | package apidoc, Register | wrong package | `internal/server/apidoc.go` with `reference.html`; sole importer is `internal/server/server.go`; no cycle |
| internal/platform/config/config.go | Variable.expand, Variable.report, Lookup, Known, Removed, removedVariables, RemovedVariables | config scattered | `config/variables.go` holds the table, `Variable` and its methods (`valid` already there); `Config`, `Load`, `store` stay |
| internal/platform/config/config.go | DataDir, EnvFilePath | mixed responsibility | `config/data_dir.go`, beside `DefaultDataDir` |
| internal/platform/config/config.go | Load (52 lines) | oversized function | `loadVariables(getenv, families)` returns cfg and lines; `checkSecretKeys`; `resolveDataDir` |
| internal/platform/config/variables.go | Variables (174 lines) | none-needed | table of data: exempt |
| internal/platform/contract/contract.go | violations, schemaViolation, orBody, invalid, unknownMember, missingMember | mixed responsibility | `contract/violations.go`: translation of kin-openapi errors to `problem.FieldError` |
| internal/platform/httpserver/handle.go, created.go, errors.go, request.go | Handle, HandleCreated, WriteCreated, ErrorWriter, BadRequestError, Query, PathUUID, PathInt64 | wrong package | `internal/platform/httphandler` (same four files); server lifecycle and middleware stay in `httpserver`; 71 importers change; no cycle |
| internal/platform/httpserver/httpserver.go | package comment | unclear name | Comment states lifecycle and health only; middleware, `NotFound` and `RequestID` also live here. Update after the split |
| internal/platform/httpserver/middleware.go | accessLog, statusRecorder, maxLoggedBody | mixed responsibility | `httpserver/access_log.go`; `middleware.go` keeps chain, headers, request ID, panic recovery, body limit |
| internal/platform/llm/aistudio/aistudio.go | toWire, partToWire, asObject, fromWire, finishReason, mergePart | mixed responsibility | `aistudio/wire.go` (types already there); `openai/wire.go` holds its conversions the same way |
| internal/platform/llm/aistudio/aistudio.go | Stream (75 lines) | oversized function | `readChunks(body, onText)` returns merged response, parts, finish; `mergeChunk`; `blockedWithoutParts` check |
| internal/platform/llm/openai/openai.go | Stream (90 lines) | oversized function | `readStream(r, model, onText, &wire)` out of the closure; `applyToolDelta(calls, d)`; `finishWire(text, calls, finish)` |
| internal/platform/llm/request.go | Response, FinishReason, Usage, Target | misplaced type | `llm/response.go` for Response, FinishReason, Usage, Target; `request.go` keeps Request, ToolChoice, Tool |
| internal/platform/llm/router.go | Client, Client.bindings, Generate, Stream, record, classify | mixed responsibility | `llm/client.go`; `router.go` keeps Router, cooldown table, `NewRouter`, `Providers`, `Client`, `Use` constructors |
| internal/platform/llm/router.go | Client.Stream (77 lines) | oversized function | `pinnedBindings(bindings, pin)`; `callTarget(ctx, b, req, onText)`; `acceptResponse` (log, record, schema check); `failAttempt` (classify, cooldown) |
| internal/platform/llm/tools.go | file name; RunTools, Run, ToolHandler, LoopOptions, Result | unclear name | `llm/toolloop.go`; name `tools.go` collides with package `platform/tool` which declares the tools themselves |
| internal/platform/llm/tools.go | Run (78 lines) | oversized function | `assignCallIDs(step, parts)`; `collectToolCalls(msg)`; `restartPinned(&state, opts)`; `addUsage(&res.Usage, resp.Usage)` |
| internal/platform/llm/tools.go | runTools (52 lines) | oversized function | `runConcurrent(ctx, handlers, calls, results, errs, opts)`; `runSequential(...)`; `notifyToolCalls(calls, opts)` |
| internal/platform/llm/use.go | ModelLister | misplaced type | `llm/provider.go`, beside Provider and Streamer |
| internal/platform/llm/use.go | Resolver, Binding, Attempt, Recorder | misplaced type | `llm/resolver.go`: ports the Router calls; `use.go` keeps Capability, Use, DefaultTarget |
| internal/platform/registry/registry.go | IDPattern, ValidID, idRE | mixed responsibility | `registry/id.go`; `ValidID` is called by `ledger/domain/income.go` and `marketdata/domain/price.go` outside any registry |
| internal/platform/tool/mcp/mcp.go | Config | config scattered | `tool/mcp/config.go`, with `Grant` and `Verify` kept in `mcp.go`; `New` builds the handler from it |
| internal/platform/tool/preview.go | ParseAmount, ParsePositive | mixed responsibility | `tool/value.go`, beside Money and Date; they parse arguments and do not belong to Preview |
| internal/platform/tool/preview.go | Registry.Preview, Registry.preview, Set.Preview | mixed responsibility | `tool/registry_preview.go`; `preview.go` keeps Value, Change, Preview, ChangeFields, PreviewDigest, `NewWrite` |
| internal/platform/tool/preview.go | ChangeFields | misplaced type | `tool/change_fields.go`; closed list of finance field names (`closing_day`, `installments`, `symbols`) used only by `Registry.preview` |
| internal/platform/tool/registry.go | Set and its methods Tools, Call, Validate | mixed responsibility | `tool/set.go`; `Set.Preview` moves with it, `Set.LLM` moves from `llm.go`; `registry.go` keeps Group, Registry, Result |
| internal/platform/tool/schema.go | collectTypes (51 lines) | oversized function | `registeredSchema(t)` for Date, OptionalInt, OptionalBool, Enumerated; `collectChildren(t, types, seen)` for struct, slice, array, pointer, map |
| internal/platform/tool/tool.go | Tool.ValidateOutput | test support in production code | `internal/apitest/tool.go`, its only non-test caller, resolves `OutputSchema()` itself; delete the method; `tool_test.go` (package `tool`) keeps a local helper, since importing `apitest` from it would create a test import cycle |

## Group: platform-b

Verdicts per package (group platform-b):

- auth: name ok / file boundaries ok. `BookRole` (read/write/owner) is an identity concept, but `platform/tool` and `platform/tool/mcp` import it; a move into `identity` would make platform import a module. Left in place.
- backup: name ok / file boundaries ok (backup.go dump/restore, files.go naming and pruning, copy.go). Imports `pgcluster.Major` only.
- clock: name ok / file boundaries ok.
- layout: test-only package (`layout_test.go`); name ok.
- locale: name ok / file boundaries ok. `ConventionsOf` and `regionName` switch on region inside platform; consumed by 15 modules, so they act as the shared ADR 016 extension point. No move.
- logring: name ok / file boundaries ok.
- money: name ok / file boundaries ok. Value types allowed in `domain` by ADR 002; `currency.gen.go` produced by `money/gen`.
- outbox: name ok / file boundaries ok. SQL on `outbox_event` and `outbox_delivery` stays beside its dispatcher; no function above 50 lines.
- page: name ok / file boundaries ok.
- pgcluster: name ok; one function above 50 lines. Platform files split by build tag.
- postgres: `postgres.go` mixes pool opening and migration logic. `pgtest` mixes test harness and identity-table fixtures.
- prettylog: name ok / file boundaries ok.
- problem: name ok / file boundaries ok. `Details` carries `ArchiveVersion` and `InstanceVersion`, read only by `reporting/httpapi`; `contract` and `httpserver` marshal `Details`, so no move without a wire change.
- secret: name ok / file boundaries ok (secret.go box, passphrase.go, key_file.go).
- spa: name ok / file boundaries ok. Static handler and `DevRedirect` are both HTTP delivery of the web interface.
- textfold: name ok / file boundaries ok.
- winsvc: name ok / file boundaries ok (build-tag files plus `log.go`).

| File | Symbol | Problem | Target |
|---|---|---|---|
| internal/platform/money/gen/main.go | Generate (58 lines) | oversized function | Steps `parseList`, `mergeLock`, `renderSource`; `Generate` composes them. |
| internal/platform/pgcluster/pgcluster.go | start (64 lines) | oversized function | Steps `prepareSocket`, `checkMajor`, `spawn`, `awaitReady`; `start` composes them. |
| internal/platform/postgres/pgtest/pgtest.go | buildTemplate (66 lines) | oversized function | Steps `hashMigrations`, `lockTemplate`, `createTemplateDB`, `migrateTemplate`; `buildTemplate` composes them. |
| internal/platform/postgres/pgtest/pgtest.go | CreateMember, CreateBooks, CreateUserBeforeBooks, CreateUserBeforeProfile | wrong package | `internal/identity/identitytest/identitytest.go`. Rows target `identity_member`, `identity_books`, `identity_membership`, `identity_user`. No cycle: pgtest imports only `db` and `platform/postgres`; outbox imports no module. |
| internal/platform/postgres/postgres.go | LatestVersion, MigrateTo, Pending, newProvider, ErrSchemaAhead | mixed responsibility | `internal/platform/postgres/migrate.go`; `postgres.go` keeps `Open`, `poolConfig`, `Locale`, `MinMajor`. |

## Group: ledger-core

Package `ledger` (root): name ok / file boundaries need change: `ledger.go` mixes Module, New, events, DTO aliases, errors and ports; `categorization.go` holds `Transfer`.
Package `ledger/domain`: name ok / file boundaries ok except `transaction.go` (522 lines, four concepts) and the functions listed below.
Package `ledger/postgres`: name ok / file boundaries ok except `completeAll` and `mapping.go` `snapshot.transaction`; `mapping.go` (344 lines) holds the version snapshot beside row mappers.
Other ledger directories (`postgres/queries`, SQL only): not read, out of the Go file group.

Root file map today: `ledger.go` = package doc, event consts, DTO and error aliases, `MarketData`/`Profiles` ports, `CategoryMonth`, `Module`, `New`, `Tools`, `Today`, `RegisterRoutes`, `BodyLimits`. `adapters.go` = `regionDefaults`, `pricesAdapter`, `calendarAdapter`, `instruments`. `subscriptions.go` = outbox handlers `settleCards`, `provision`, `booksCreated`. `region_defaults.go` = four `Default*` functions. The other files are one group of `Module` methods each. No `config.go`: `New` takes no config type, so the file is not needed.
Root target shape: `ledger.go` (package doc, `Module`, `New`, `Tools`, `Today`, `RegisterRoutes`, `BodyLimits`), `types.go` (event consts, DTO aliases, `CategoryMonth`, error vars), `ports.go` (`MarketData`, `Profiles`), `adapters.go`, `subscriptions.go`, `region_defaults.go`, method-group files.

| File | Symbol | Problem | Target |
|---|---|---|---|
| internal/ledger/categorization.go | `Transfer` | misplaced type | `internal/ledger/transfers.go` (method group named by concept); `categorization.go` keeps `Categorize`, `LatestPayeeCategories` |
| internal/ledger/domain/account.go | `NewAccount` (51 lines) | oversized function | `validateAccountKind`, `validateAccountYield`, `normalizeAccount` |
| internal/ledger/domain/line.go | `ToLine` (61 lines) | oversized function | `checkLineTarget`, `applyLineAmount`, `rebuildLinePostings` |
| internal/ledger/domain/line.go | `SplitToLines` (60 lines) | oversized function | `checkLineParts`, `splitPosting`, `rebuildSplitPostings` |
| internal/ledger/domain/reimburse.go | `Reimburse` (100 lines) | oversized function | `checkReimbursable`, `allocateReimbursement`, `buildReimbursementLinks`, `buildReimbursementTransaction` |
| internal/ledger/domain/statement.go | `Summarize` (64 lines) | oversized function | `groupStatementInputs`, `summarizeStatement`, `sortSummaries` |
| internal/ledger/domain/trade.go | `BuildTrade` (96 lines) | oversized function | `checkTradeInput`, `tradeCashPostings`, `tradeSecurityPostings`, `assembleTrade` |
| internal/ledger/domain/transaction.go | whole file (522 lines) | oversized file | `domain/link.go` (LinkType, Link, linkTypes), `domain/posting.go` (Posting, `checkPosting`, `checkCardPosting`, ordinal helpers), `domain/tag.go` (`NormalizeTag`, `normalizeTags`) |
| internal/ledger/domain/transaction.go | `NewTransaction` (85 lines) | oversized function | `checkTransactionHeader`, `normalizePostings`, `checkBalanced`, `checkInstallmentRef` |
| internal/ledger/domain/transaction.go | `checkPosting` (57 lines) | oversized function | `checkPostingAccount`, `checkPostingAmount`, `checkPostingStatus` |
| internal/ledger/domain/transfer.go | `Transfer` (67 lines) | oversized function | `checkTransferEnds`, `transferPostings`, `assembleTransfer` |
| internal/ledger/ledger.go | file | mixed responsibility | `ledger.go` (Module, New, methods), `types.go` (consts, aliases, `CategoryMonth`, errors), `ports.go` (`MarketData`, `Profiles`) |
| internal/ledger/ledger.go | `MarketData` | unclear name | Comment reads "Calendar is the part of marketdata..." and does not name `MarketData`; rename comment in `ports.go` |
| internal/ledger/ledger.go | `New` | wiring in the wrong place | Wiring is correct (module root `New`); the subscribe loop moves to `subscribe(dispatcher, svc)` in `subscriptions.go` |
| internal/ledger/postgres/mapping.go | `snapshot`, `snapshotLink`, `snapshotPosting`, `toSnapshot`, `snapshot.transaction` | mixed responsibility | `postgres/snapshot.go`; `mapping.go` keeps row mappers and null helpers |
| internal/ledger/postgres/mapping.go | `snapshot.transaction` (59 lines) | oversized function | `snapshotPostings`, `snapshotLinks`, `snapshotInstallment` |
| internal/ledger/postgres/transaction.go | `completeAll` (83 lines) | oversized function | `loadTransactionChildren`, `groupPostingsByTransaction`, `attachTrades`, `assembleTransactions` |

## Group: ledger-layers


Verdicts:

- `internal/ledger/app`: name ok / file boundaries not ok: `imports.go` (596), `ports.go` (526), `categorize.go` (419) are above 400; `currency.go`, `card_operations.go`, `refunds.go` mix concepts; 28 functions above 50 lines.
- `internal/ledger/httpapi`: name ok / file boundaries not ok: `convert.go` mixes four concepts; settings handlers sit in `server.go`; 5 functions above 50 lines (`Register` is a table).
- `internal/ledger/toolapi`: name ok / file boundaries not ok: each tool file mixes schema, argument decoding and action; field-check and ID helpers are scattered; 17 functions above 50 lines.
- `internal/ledger/llmapi`: does not exist.

All three packages: no wiring outside `ledger.go` and `Tools`/`NewServer`; no configuration type; no test support in production files.

| File | Symbol | Problem | Target |
|---|---|---|---|
| internal/ledger/app/account.go | CloseAccount (56) | oversized function | `closeAccountTx` (InTx body): `lockAccountForClose`, `checkCloseable`, `saveClosed` |
| internal/ledger/app/account.go | UpdateAccount (54) | oversized function | `updateAccountTx`: `applyPatch`, `checkParent`, `saveAccount` |
| internal/ledger/app/assertion.go | AssertSynced (59) | oversized function | `assertSyncedTx` (InTx body), calls `decideAssertion`; date guard stays |
| internal/ledger/app/assertion.go | decideAssertion (70) | oversized function | `assertionBasis` (previous date, yield start, settled balance), `assertionOutcome` (switch), `storeAssertion` (insert or update) |
| internal/ledger/app/assertion_resolution.go | ResolveAssertion (68) | oversized function | `checkResolution` (guard), `resolveAssertionTx` (InTx body) |
| internal/ledger/app/billing.go | StatementView, StatementPlacement, StatementDates | misplaced type | `internal/ledger/app/statements.go`, beside `statementSummaries` and `PlaceStatement` callers |
| internal/ledger/app/card_operations.go | whole file (384) | mixed responsibility | `installment_purchase.go` (purchase, totals, parts), `statement_payment.go` (PayStatement, FinanceStatement), `commitment.go` |
| internal/ledger/app/card_operations.go | installmentPurchase (81) | oversized function | `checkInstallmentInput` (count, splits), `loadPurchaseCard`, `buildInstallmentPostings`, `insertInstallmentPlan`; `purchaseTotals`, `installmentParts` exist |
| internal/ledger/app/card_operations.go | FinanceStatement (78) | oversized function | `checkFinanceCount`, `financeStatementTx`: `lockStatementToFinance`, `buildFinancedPlan` |
| internal/ledger/app/card_operations.go | validationError | misplaced type | `internal/ledger/app/errors.go` with `fieldErr` (`currency.go:35`), same concept |
| internal/ledger/app/categorize.go | whole file (419) | oversized file | `categorize.go` (Categorize, CategorizeMany), `merge_category.go` (MergeCategories, checkMerge, reassign), `payee.go` (RenamePayee, MergePayees) |
| internal/ledger/app/categorize.go | categorize (52) | oversized function | `loadCategorizationAccounts` (ids from parts, WholeTo), `applyCategorization` (domain call, replace postings) |
| internal/ledger/app/categorize.go | MergePayees (63) | oversized function | `lockMergePayees`, `repointPayeeReferences`, `deleteMergedPayee`; moves to `payee.go` |
| internal/ledger/app/categorize.go | MergeCategories (59) | oversized function | `lockMergeCategories`, `checkMerge` (exists), `reassign` (exists), `deleteMergedCategory` |
| internal/ledger/app/categorize.go | PayeesMerged, RenamePayee | wrong package | none: payee concept; move to `internal/ledger/app/payee.go` |
| internal/ledger/app/currency.go | whole file (389) | mixed responsibility | `foreign_purchase.go`, `exchange.go`, `valuation.go` (ValuedBalance, ExternalFlows, RecordedYield), `account_loading.go` (loadAccount, baseCurrency) |
| internal/ledger/app/currency.go | Exchange (94) | oversized function | `loadExchangeAccounts`, `exchangePostings`, `insertExchange` |
| internal/ledger/app/currency.go | RecordForeignPurchase (79) | oversized function | `loadForeignPurchaseAccounts`, `foreignPurchasePostings`, `insertForeignPurchase` |
| internal/ledger/app/currency.go | ValuedBalance (62) | oversized function | `checkValuationInput` (basis, currency, account), `convertTotals` (sorted loop over instruments) |
| internal/ledger/app/group.go | ConfirmGroup (52) | oversized function | `checkGroupParts` (count, sort), `confirmGroupTx` (InTx body) |
| internal/ledger/app/imports.go | whole file (596) | oversized file | `imports.go` (record, batch, builders), `import_links.go` (ImportTarget, LinkedTransaction, Unlinked*), `import_update.go` (UpdateImportedPosting, retypeAsPayment), `import_matches.go` (ClearMatched*) |
| internal/ledger/app/imports.go | RecordImportedBatch (145) | oversized function | `collectBatchAccounts`, `loadBatchReferences`, `checkBatchLeaves`, `recordImportedLine`; `importedTransaction` exists |
| internal/ledger/app/imports.go | UpdateImportedPosting (56) | oversized function | `updateImportedTx` (InTx body), `retypeIfPayment` (second InTx); `retypeAsPayment` exists |
| internal/ledger/app/installment_import.go | confirmInstallment (63) | oversized function | `confirmedTarget` (statement, due date, status), `confirmedStatus`; `withConfirmedInstallment` exists |
| internal/ledger/app/installment_import.go | withConfirmedInstallment (56) | oversized function | `shiftCardSide` (delta on plan postings), `rebalanceCounterpart`; both loops of the body |
| internal/ledger/app/pairing.go | UnpairImported (51) | oversized function | `unpairImportedTx` (InTx body): `lockPairedTransactions`, `splitPairedTransaction` |
| internal/ledger/app/ports.go | whole file (526) | oversized file | `ports.go` (interfaces only), `port_records.go` (Price, Statement, Settings, Institution, Payee, TransactionQuery and other row types) |
| internal/ledger/app/refunds.go | whole file (352) | mixed responsibility | `refunds.go` (purchase, RefundPurchase), `plan_changes.go` (lockPlan, CancelPlan, AnticipatePlan) |
| internal/ledger/app/refunds.go | CancelPlan (96) | oversized function | `cancelPlanTx`: `lockPlan` (exists), `planReversalPostings`, `insertPlanReversal`, `closePlanInstallments` |
| internal/ledger/app/refunds.go | AnticipatePlan (85) | oversized function | `anticipatePlanTx`: `lockPlan` (exists), `anticipationPostings`, `insertAnticipation` |
| internal/ledger/app/reimburse.go | reimburse (74) | oversized function | `lockReimbursementTargets` (sorted ids), `loadReimbursementAccounts`, `buildAllocations`, `persistReimbursement` |
| internal/ledger/app/reimbursement_candidates.go | ReimbursementCandidates (59) | oversized function | `loadCandidateRows` (category side, query), `allocateCandidates` (remaining loop) |
| internal/ledger/app/statement_facts.go | RecordCardOpening (58) | oversized function | `checkOpening` (zero total), `recordOpeningTx` (InTx body) |
| internal/ledger/app/statement_facts.go | dateByFacts (55) | oversized function | `statementBounds` (before/after/refOf maps), `redatePostings` (loop over redatable postings) |
| internal/ledger/app/trades.go | RecordTrade (53) | oversized function | `recordTradeTx` (InTx body): `loadTradeAccounts` (exists as `tradeAccounts`), `insertTrade` |
| internal/ledger/app/transaction.go | correctIn (57) | oversized function | `checkCorrectable` (trade, income, later sales), `loadCorrectionAccounts`, `correctPlain` and `correctInstallments` branches |
| internal/ledger/app/transfer.go | transfer (63) | oversized function | `loadTransferTarget`, `mergeWithCandidate` (candidate lock, void, keep reconciled), `convertToTransfer` |
| internal/ledger/app/disputes.go | ResolveDispute (66) | oversized function | `checkOutcome` (guard), `resolveDisputeTx`: `lockDispute`, `disputeOutcomePostings`, `saveResolvedDispute` |
| internal/ledger/httpapi/convert.go | whole file (295) | mixed responsibility | `convert_scalar.go` (money, date, uuid, string), `convert_account.go`, `convert_transaction.go`, `convert_institution.go` (institution, payee) |
| internal/ledger/httpapi/convert.go | fromTransactionInput (67) | oversized function | `tagsFromInput`, `linksFromInput`, `postingFromInput` (loop body) |
| internal/ledger/httpapi/convert.go | toTransactionAPI (56) | oversized function | `postingToAPI`, `linksToAPI`, `installmentToAPI` |
| internal/ledger/httpapi/errors.go | ToProblem (74) | oversized function | `paramProblem`, `fieldProblem` (code by sentinel), `sentinelProblem` (status table of ErrNotFound and others) |
| internal/ledger/httpapi/server.go | Register (105) | oversized function | table of data: exempt |
| internal/ledger/httpapi/server.go | getSettings, updateSettings | mixed responsibility | `internal/ledger/httpapi/settings.go`; `server.go` keeps `Server`, `NewServer`, `Register` |
| internal/ledger/toolapi/accounts.go | listAccounts (55) | oversized function | `accountRows` (class filter, names), `institutionNames`; tool body keeps Spec and call |
| internal/ledger/toolapi/accounts.go | getBalances (53) | oversized function | `balanceDate` (defaults), `balanceRows` (amounts by class) |
| internal/ledger/toolapi/card.go | planCard (154) | oversized function | schema to `card_schema.go`; args `decodeCardArgs`; actions `planAddCard`, `planRemoveCard`, `planSetLimit` beside `planEditCard` in `card.go` |
| internal/ledger/toolapi/categorize.go | categorizeTransactions (69) | oversized function | `previewCategorize` (keys, Changes), `runCategorize`; `planCategorize` exists |
| internal/ledger/toolapi/change.go | changeTransaction (86) | oversized function | schema `change_schema.go`; `previewChange` (switch per action), `runChange` |
| internal/ledger/toolapi/change.go | planChange (79) | oversized function | args `decodeChangeArgs` (given map, per-action required), `planCorrect`, `planMakeTransfer`, `planReimburse` |
| internal/ledger/toolapi/change.go | correctedTransaction (70) | oversized function | `copyTransaction`, `applyHeaderFields` (date, description, payee), `applyAmountChange` |
| internal/ledger/toolapi/change.go | unusedFields | misplaced type | `internal/ledger/toolapi/fields.go` with `checkFields`, `givenFields` (`organize.go`); same required/optional check |
| internal/ledger/toolapi/details.go | getAccountDetails (77) | oversized function | schema (view types, lines 15-100) to `details_schema.go`; `decodeDetailsArgs` (month, from); action calls `reconciliationOf`, `cardDetailsOf` |
| internal/ledger/toolapi/details.go | cardDetailsOf (86) | oversized function | `cardViews`, `limitViews`, `statementRows`, `commitmentOf` |
| internal/ledger/toolapi/investment.go | planInvestment (145) | oversized function | schema `investment_schema.go`; args `decodeInvestmentArgs` (accounts, categories, amounts); actions `planBuy`, `planSell`, `planIncome` |
| internal/ledger/toolapi/labels.go | listPayeesAndTags (65) | oversized function | `listPayees`, `listTags`, `listInstitutions` (one per Kind case), shared `nameMatcher` |
| internal/ledger/toolapi/purchase.go | planPurchase (182) | oversized function | schema `purchase_schema.go`; args `decodePurchaseArgs` (given map, required by action, statement month); actions `planRefund`, `planOpenDispute`, `planResolveDispute`, `planCancel`, `planAnticipate` |
| internal/ledger/toolapi/reconcile.go | planReconcile (76) | oversized function | args `decodeReconcileArgs` (required by action); actions `planRecordBalance`, `planResolveDifference`, `planSync` |
| internal/ledger/toolapi/record.go | recordTransaction (105) | oversized function | schema `record_schema.go`; `previewRecord` (changes, payee, tags), `runRecord` |
| internal/ledger/toolapi/record.go | planRecord (127) | oversized function | `recordAccounts` (from, unit), `recordAmounts`, `recordDestinations`; `planExchangeFee` exists |
| internal/ledger/toolapi/settle.go | planSettle (156) | oversized function | schema `settle_schema.go`; args `decodeSettleArgs` (ids, given map); actions `planPayStatement`, `planFinanceStatement`, `planSettleGroup` |
| internal/ledger/toolapi/statement.go | getStatement (64) | oversized function | `statementLineViews` (postings to rows), `statementTotals`; tool keeps Spec and lookup |
| internal/ledger/toolapi/toolapi.go | allAccounts, allPages, minorMoney, accountClass | misplaced type | `internal/ledger/toolapi/paging.go` (allAccounts, allPages), `amounts.go` (minorMoney); `toolapi.go` keeps `Tools` |
| internal/ledger/toolapi/transaction.go | getTransaction (105) | oversized function | views (lines 16-90) to `transaction_schema.go`; steps `loadTransactionDetail`, `historyEntries`, `installmentPlanOf` (exists), `reimbursementsOf` (exists) |
| internal/ledger/toolapi/transaction.go | requiredID | misplaced type | `internal/ledger/toolapi/ids.go` with `optionalID` (`transactions.go:154`) |
| internal/ledger/toolapi/void.go | targetOf, basisOf | misplaced type | `internal/ledger/toolapi/preview.go`; used by `change.go`, `record.go` and others, not only by `void.go` |

Limits of this audit: function bodies inside `InTx` closures were read at first-level statements only; step names for those rows follow the visible phases and the names of existing helpers. `wording.go` (writer type) and `statements.go` were not read in full; no finding recorded for them.

## Group: planning


Verdicts per package:

- `planning` (root): name ok / file boundaries not ok. `planning.go` (349 lines) holds Module, New, outbox handlers, Tools, scheduler, `toolLedger`, `ledgerPort`, `pricesPort`, `calendarPort` and the `Profiles` interface. No Config, no DTO aliases, no `region_defaults.go`. `recurring.go` holds the public type `RecurringProbe` and the method `RecurringFor`. `export_test.go` is test support in a `_test.go` file (ok).
- `planning/domain`: name ok / file boundaries ok. `recurrence.go` has `Rule.Validate` at 62 lines.
- `planning/app`: name ok / file boundaries not ok. `plan.go` is oversized. `schedules.go` mixes Service, schedule use cases and occurrence views. `recurring.go` mixes a pure detector with `Service.Recurring`.
- `planning/httpapi`: name ok / file boundaries not ok. Occurrence code sits in `schedules.go` and `changes.go`; `parseMonth` and `monthLayout` sit in `budgets.go`; `server.go` mixes routes, error mapping and converters.
- `planning/toolapi`: name ok / file boundaries not ok. Ten functions above 50 lines. `manage_schedule.go` is oversized. Each tool file mixes schema types, argument decoding and action.
- `planning/postgres`: name ok / file boundaries ok. One `Repository` split by concept (budget, goal, schedule, occurrence, merge); no function above 50 lines.

Target shape of the module root:

| Concern | Now | Target file |
|---|---|---|
| Module, New, Tools, RegisterRoutes, CommittedTotal, Tick, Backfill, RunScheduler | `planning.go` | `planning.go` (Module, New, exported methods) |
| Outbox subscriptions and handlers `handle`, `handleMerge`, `handlePayeeMerge`, `consumer` | `planning.go` | `events.go` |
| `ledgerPort`, `pricesPort`, `calendarPort`, `toolLedger` | `planning.go` | `adapters.go` |
| `Profiles` (consumed port, public because `New` takes it) | `planning.go` | `types.go` |
| `RecurringProbe` (public DTO) | `recurring.go` | `types.go` |
| `RecurringFor`, `probeFact` | `recurring.go` | `recurring.go` (method group) |
| Config | none: `New` takes eight positional arguments | `config.go` with `Deps` struct only if the owner accepts a signature change; otherwise none |
| DTO aliases | none; `New` exposes `app.Returns` in its signature | `types.go`: `type Returns = app.Returns` |
| Region defaults | none: `DefaultCalendar` is delegated to marketdata | `region_defaults.go` not needed |

| File | Symbol | Problem | Target |
|---|---|---|---|
| internal/planning/planning.go | ledgerPort, pricesPort, calendarPort, toolLedger | wiring in the wrong place | `internal/planning/adapters.go`: four adapter types and their methods (about 230 lines); `planning.go` keeps Module and New |
| internal/planning/planning.go | handle, handleMerge, handlePayeeMerge, consumer | mixed responsibility | `internal/planning/events.go`: outbox subscription and three handlers; New calls `subscribe(dispatcher, m)` |
| internal/planning/planning.go | Profiles | misplaced type | `internal/planning/types.go` beside `RecurringProbe` and an alias for `app.Returns` |
| internal/planning/planning.go | New | unclear name | Eight positional arguments, 160-column line; one argument per line in `New`; build `app.Service` in `newService(...)` inside `adapters.go` |
| internal/planning/recurring.go | RecurringProbe | misplaced type | `internal/planning/types.go` |
| internal/planning/app/budgets.go | BudgetProgress | oversized function (52) | Steps: `loadBudgetCategory`, `monthlyTotals` (rollover query), `spentFunc`; `Progress` call stays in body |
| internal/planning/app/changes.go | ChangeTerms | oversized function (65) | Steps: `validateTerms` (ended, order, amount or rule present), `nextTerms` (build Terms), `persistTerms` (InsertTerms, DeleteExpected), `regenerateFrom` (from date) |
| internal/planning/app/plan.go | (file, 480 lines) | oversized file | `app/plan.go` (BudgetPlan, planOccurrences, receivedIncome), `app/plan_types.go` (Plan, PlanIncome, derived methods), `app/plan_save.go` (SaveBudgetPlan) |
| internal/planning/app/plan.go | BudgetPlan | oversized function (114) | Steps: `classifyAccounts`, `loadLedgerTotals`, `budgetsOfExpenses`, `sumPlanned`, `incomeHistory`, `resolveReference`; `planOccurrences` stays |
| internal/planning/app/plan.go | planOccurrences | oversized function (70) | Steps: `indexSchedules`, `occurrenceAmount` (actual vs expected, price conversion), `addIncomeItem`, `addSavings` |
| internal/planning/app/plan.go | SaveBudgetPlan | oversized function (121) | Steps: `checkPlanArguments` (month, target), `buildReference` (fixed source), `checkPlanAmounts` (category, duplicate, amount), `persistPlan` (InTx loop) |
| internal/planning/app/realize.go | reevaluate | oversized function (78) | Steps: `loadChange` (schedules, facts, current), `releaseManual`, `findBest` (ExpectedOccurrences, Match), `applyBest` (release old, realize new) |
| internal/planning/app/realize.go | view, Occurrence, OccurrenceView use | mixed responsibility | `Occurrence` and `view` move to `app/occurrences.go` with `Occurrences`, `OccurrencesOfTransaction`, `occurrenceViews`, `fillActuals`, `OccurrenceView` |
| internal/planning/app/recurring.go | DetectSeries, detectGroup, cadences, SeriesFact, Series | mixed responsibility | Pure detector to `domain/series.go`; `app/recurring.go` keeps `Service.Recurring`, `seriesFacts`, `coveringSchedule`, `RecurringFilter` |
| internal/planning/app/schedules.go | CreateSchedule | oversized function (66) | Steps: `defaultCalendar`, `checkCalendar`, `newSchedule` (build from input, apply overrides), `persistSchedule` (InTx insert and generate) |
| internal/planning/app/schedules.go | checkAccounts | oversized function (57) | Steps: `indexAccounts`, `checkAccountSide`, `checkCounterpart` (kind fit, instrument), `checkPayee` |
| internal/planning/app/schedules.go | Service, NewService, WithRepository | misplaced type | `internal/planning/app/service.go` |
| internal/planning/app/schedules.go | OccurrenceView, Occurrences, occurrenceViews, fillActuals | mixed responsibility | `internal/planning/app/occurrences.go` |
| internal/planning/app/views.go | Project | oversized function (89) | Steps: `checkProjectionArguments` (date, balance account), `projectionPoints` (expected occurrences to points), `sortPoints`, `runBalances` (opening, closing, running) |
| internal/planning/app/views.go | Committed | oversized function (71) | Steps: `cardInstallments`, `indexSchedules`, `committedOccurrences` (filter, convert); shares `indexSchedules` and price conversion with `planOccurrences` |
| internal/planning/domain/plan.go | PlanRows | oversized function (114) | Steps: `newPlanTree` (parent, children, budgets maps), `tree.ancestorHas`, `tree.subtotal`, `tree.history`, `budgetedRow`, `unbudgetedRow`, sort |
| internal/planning/domain/recurrence.go | Validate | oversized function (62) | Steps: `validateFrequency`, `validateSelectors` (day, weekday ordinal, business day), `validateAdjustment`, `validateBounds` (until, count) |
| internal/planning/httpapi/budgets.go | parseMonth, monthLayout | misplaced type | `internal/planning/httpapi/convert.go` (shared with plan.go and views.go) |
| internal/planning/httpapi/changes.go | skipOccurrence, moveOccurrence | mixed responsibility | Move to `internal/planning/httpapi/occurrences.go`; `changes.go` keeps the five schedule handlers |
| internal/planning/httpapi/plan.go | toBudgetPlanAPI | oversized function (69) | Steps: `planIncomeAPI` (expected items), `planSavingsAPI` (rate, target, gap), `planReferenceAPI`, `planRowAPI` |
| internal/planning/httpapi/schedules.go | toOccurrenceAPI, listOccurrences, intOf, optInt, stringOf | mixed responsibility | Occurrence code to `httpapi/occurrences.go`; pointer helpers to `httpapi/convert.go` |
| internal/planning/httpapi/server.go | Register | oversized function (53) | Table of data: exempt. Routes grouped as `registerSchedules`, `registerOccurrences`, `registerBudgets`, `registerGoals` if split is wanted |
| internal/planning/httpapi/server.go | ToProblem, fieldProblem, paramError, listPage, toPricesAPI, toMoneyAPI, fromMoneyAPI, date and UUID helpers | mixed responsibility | `httpapi/problems.go` (ToProblem, fieldProblem, paramError, listPage); `httpapi/convert.go` (Money, Price, date, UUID helpers) |
| internal/planning/toolapi/budget_goal.go | prepareBudgetOrGoal | oversized function (136) | Steps: `checkBudgetGoalFields` (required table), `decodeBudgetGoalIDs`, `loadAccountNames`, `resolveCurrency` per action, `decodePlanAmounts`, `parseAmount` |
| internal/planning/toolapi/budget_goal.go | manageBudgetOrGoal | oversized function (167) | Schema: `manageBudgetOrGoalIn` to `budget_goal_schema.go`. Preview: `previewBudget`, `previewGoal`, `previewPlan`. Action: `runBudget`, `runGoal`, `runPlan` (`planSaveArguments`) |
| internal/planning/toolapi/budgets.go | toPlanView | oversized function (59) | Steps: `planTotalsView`, `planReferenceView`, `planRowViews`; the `{amount, into}` loop becomes one helper `fillMoney` |
| internal/planning/toolapi/budgets.go | getBudgetsAndGoals | oversized function (102) | Steps: `planOutput` (kind plan), `budgetViews` (paged loop and progress), `goalViews` (paged loop); `allBudgets`, `allGoals` page helpers |
| internal/planning/toolapi/manage_schedule.go | (file, 446 lines) | oversized file | `manage_schedule.go` (tool definition), `manage_schedule_schema.go` (In type, enums), `manage_schedule_prepare.go` (prepareSchedule, checkPaidBy), `manage_schedule_preview.go` (describeTerms, updateChanges) |
| internal/planning/toolapi/manage_schedule.go | prepareSchedule | oversized function (149) | Steps: `checkScheduleFields` (required table per action), `decodeScheduleIDs`, `prepareCreate`, `prepareChangeTerms`, `preparePause`, `checkNotEnded`, `parseScheduleAmount` |
| internal/planning/toolapi/manage_schedule.go | manageSchedule | oversized function (111) | Preview: `previewCreate`, `previewUpdate`, `previewTerms`, `previewPauseOrEnd`. Action: `applyScheduleAction` returns the schedule; `toScheduleView` call stays |
| internal/planning/toolapi/manage_schedule.go | validationError, unitWords | misplaced type | `validationError` to `toolapi/toolapi.go` (used by budget_goal.go and occurrence.go); `unitWords` stays with `describeTerms` |
| internal/planning/toolapi/occurrence.go | manageOccurrence | oversized function (99) | Preview: `previewOccurrence` (state check, `occurrenceChanges` per action, `checkMove`). Action: `applyOccurrenceAction`, `occurrenceResult` |
| internal/planning/toolapi/projection.go | projectBalance | oversized function (56) | Steps: `scheduleDescriptions` (reused by listSchedules), `projectionPoints`, `projectionTotals` |
| internal/planning/toolapi/recurring.go | findRecurring | oversized function (60) | Steps: `decodeRecurringFilter`, `loadRecurringNames`, `matchSeries` (text filter, cap at 20); `toSeriesView` and `EncodeSeries` stay |
| internal/planning/toolapi/schedules.go | listSchedules | oversized function (125) | Steps: `decodeScheduleRange` (from, to, month), `loadSchedules`, `scheduleViews`, `occurrencePage`, `committedOf`; types and views go to `schedules_views.go` |
| internal/planning/toolapi/toolapi.go | field, required, optionalID, parseMonth, firstOfMonth, moneyOf, unitOf, optionalInt, pick | mixed responsibility | Argument decoding helpers to `toolapi/args.go`; `toolapi.go` keeps Account, Ledger, Transaction, Tools and `allSchedules` |

## Group: ingestion-core


Package verdicts:
- `ingestion` (root): name ok / file boundaries not ok: one 583-line file holds Module, Config, DTO aliases, the ledger adapter (lines 210-568) and two event/credential helpers.
- `domain`: name ok / file boundaries ok. `NewProfile` (65 lines) is the only oversized function.
- `app`: name ok / file boundaries ok except `sync.go` (syncAccount 157 lines), `review.go` (Resolve 110 lines) and `ledger_port.go` (DTOs of the port, outside `ports.go`).
- `httpapi`: name ok / file boundaries ok except `server.go` (Register 51 lines, ToProblem 55 lines).
- `toolapi`: name ok / file boundaries ok except `manage.go` (manageImports 169 lines) and `imports.go` (getImports 66, connections 54 lines).
- `llmapi`: name ok / file boundaries ok (one file, 80 lines).
- `postgres`: name ok / file boundaries not ok: `record.go` (540 lines) holds records, batches, locks and undo; `sync.go` holds record, connection-state, installment and sync-run queries.

Root shape today (`ingestion.go`): Module (l.40), Config and Admins (l.47-66), SuggestColumnsUse (l.38), AggregatorIDs (l.68), New with aggregator/secret wiring (l.70-109), exported methods (Tools, SyncConnection, Tick, RunScheduler, RotateSecrets, ExportCredentials, SealCredentials, RegisterRoutes, BodyLimits, FeedStates, ConnectionDiagnostics), aliases (ErrIntegrationUnavailable l.176, FeedState l.570, ConnectionDiagnostic l.578), followPairing (l.191), accountNames (l.115), ledgerPort with 30 methods (l.210-568). No regional value exists in the root: `region_defaults.go` is not created.
Target shape: `ingestion.go` (Module, New, Tools, RegisterRoutes, BodyLimits), `config.go` (Config, Admins, AggregatorIDs), `types.go` (SuggestColumnsUse, ErrIntegrationUnavailable, FeedState, ConnectionDiagnostic), `adapters.go` (ledgerPort, accountNames, followPairing), `sync.go` (SyncConnection, Tick, RunScheduler), `credentials.go` (RotateSecrets, ExportCredentials, SealCredentials), `status.go` (FeedStates, ConnectionDiagnostics).

| File | Symbol | Problem | Target |
|---|---|---|---|
| internal/ingestion/app/import_match.go | repeats | oversized function (59 lines) | Steps: `collectRepeatLines` (fresh/recorded/at/window), `storedRepeatLines` (SyncedRecords to RepeatLine), `repeatedIndexes` (domain.Repeats mapped by at) |
| internal/ingestion/app/import_write.go | update | oversized function (69 lines) | Steps: `needsUpdate` (identified/settled/retype/moved guard), `applyPostingChange` (UpdateImportedPosting and notes), `applyUnappliedNotes` (notes, ReviewReason, Decision reset) |
| internal/ingestion/app/connection.go | CreateConnection | oversized function (51 lines) | Steps: `integrationOf` (load, unknown to FieldError), `readItem` (agg.Item and error mapping), `storeConnection` (name, holder digests, insert) |
| internal/ingestion/app/connection.go | MapAccount | oversized function (58 lines) | Steps: `externalAccountOf` (find by id), `importTargetOf` (target and unknown account), `releaseHeldMapping` (A214 pass-over, ReplaceMapping) |
| internal/ingestion/app/import_plan.go | importRecords | oversized function (60 lines, 13 sequential stages, one step per statement) | Sequence of named steps already; extract `planLines` (claim, unlinked, classify, assign) and `placeLines` (link, pair, create, installments, outcomes) |
| internal/ingestion/app/importer.go | Import | oversized function (53 lines) | Steps: `validateImportFile` (switch of format, name, size), `recordFileBalance` (AssertBalance and skipped status) |
| internal/ingestion/app/review.go | Resolve | oversized function (110 lines) | Steps: `lockedRecord` (read, lock, reread, state check), `acceptedCandidates` (refresh and keep stored), `resolveMatch`, `resolveCreate`; ActionDiscard inline |
| internal/ingestion/app/sync.go | syncAccount | oversized function (157 lines) | Steps: `lockAccount` (two locks), `readWindow` (readFrom, createdFrom, ReadAccount, filters), `recordBills` (statement facts, opening), `assertBalance` (recorded or skipped), `markSynced` |
| internal/ingestion/app/sync.go | syncItem | oversized function (71 lines) | Steps: `itemOf` (integration, credentials, aggregator, ItemState), `shouldSkip` (needs-owner or no newer data), `syncMapped` (ordered loop with gone handling) |
| internal/ingestion/app/sync_accounts.go | addMissingAccounts | oversized function (71 lines) | Steps: `previousListing` (date of last sync), `refreshKnownAccount` (holder digest, rename), `insertListedAccount`, `reloadAccounts` |
| internal/ingestion/app/undo.go | UndoDecision | oversized function (57 lines) | Steps: `lockedRecord` (shared with Resolve), `undoByKind` (switch of five decisions returning line), `saveUndone` (SaveUndo and batch reload) |
| internal/ingestion/app/ledger_port.go | Line, NewLine and siblings | misplaced type | Port DTOs sit apart from `app/ports.go` that declares the Ledger port; move them to `app/ports.go` or rename the file `app/ledger_lines.go` |
| internal/ingestion/domain/profile.go | NewProfile | oversized function (65 lines) | Steps: `withProfileDefaults`, `validateFormat` (switch of 14 cases, table of data), `validateColumns` (required and position checks) |
| internal/ingestion/httpapi/server.go | Register | oversized function (51 lines) | Table of data (27 route registrations): exempt |
| internal/ingestion/httpapi/server.go | ToProblem | oversized function (55 lines) | Table of data (error-to-problem switch): exempt; optional split `problemOfTyped` (three errors.AsType branches) and `problemOfSentinel` (switch) |
| internal/ingestion/postgres/record.go | file (540 lines) | oversized file | Split: `postgres/record.go` (toRecord, ClaimRecords, Record, Records, Resolve/Reopen, outcomes), `postgres/batch.go` (InsertBatch, CompleteBatch, Batch), `postgres/lock.go` (LockAccountImports, LockBookPairing), `postgres/undo.go` (SaveUndo, undoParams, encode/decodeUndo) |
| internal/ingestion/postgres/record.go | ClaimRecords | oversized function (55 lines) | Steps: `insertParamsOf` (recs to params), `insertNewRecords` (batch insert, collect existing keys), `loadExistingRecords` (ListRecordsByKeys, byKey fill) |
| internal/ingestion/postgres/sync.go | file (278 lines; Record, ConnectionState, InstallmentPlan and SyncRun queries) | mixed responsibility | Move record queries to `postgres/record_sync.go`, connection state to `postgres/connection.go`, installment plans to `postgres/installment.go`; keep `postgres/sync.go` for SyncRuns |
| internal/ingestion/postgres/sync.go | SyncRuns | oversized function (53 lines) | Steps: `syncHeads` (ListConnectionSyncs to runs and index), `attachBatches` (ListSyncBatches, owner map), `attachSummaryRecords` (ListSummaryRecords) |
| internal/ingestion/toolapi/imports.go | getImports | oversized function (66 lines) | Steps: `viewFields` (field presence list), `batchesView` (default branch: page, list, cursor); view switch stays; `records`, `syncs`, `unconfirmed` already extracted |
| internal/ingestion/toolapi/imports.go | connections | oversized function (54 lines) | Steps: `toConnectionView` (state, last sync, accounts with names), `integrationViews` (aggregator names, ListIntegrations) |
| internal/ingestion/toolapi/manage.go | manageImports | oversized function (169 lines; preview and run closures, one switch each over eight actions) | Steps: `previewManage` with `previewConnection`, `previewResolve`, `previewReopen`, `previewUndo`, `previewIntegrationDelete`; `runManage` with `runSync`, `runMapAccount`, `runResolve`; file `toolapi/manage_preview.go` |
| internal/ingestion/ingestion.go | file (583 lines) | oversized file | Split into `ingestion.go`, `config.go`, `types.go`, `adapters.go`, `sync.go`, `credentials.go`, `status.go` as in the target shape above |
| internal/ingestion/ingestion.go | Config, Admins, AggregatorIDs | config scattered | `internal/ingestion/config.go`; the secret, URL-redirect and aggregator registration inside New (l.71-98) becomes `newAggregators(cfg)` in `internal/ingestion/adapters.go` |
| internal/ingestion/ingestion.go | ledgerPort (30 methods, l.210-568) | mixed responsibility | `internal/ingestion/adapters.go`; split by group if above 400 lines: `adapter_ledger_import.go` (record, installments), `adapter_ledger_assert.go` (balances, statements, pairing) |
| internal/ingestion/ingestion.go | ErrIntegrationUnavailable, FeedState, ConnectionDiagnostic, SuggestColumnsUse | misplaced type | `internal/ingestion/types.go` (aliases and the LLM use declaration) |
| internal/ingestion/ingestion.go | followPairing, accountNames | wiring in the wrong place | `internal/ingestion/adapters.go` (event subscriber and account-name closure); `New` only subscribes and constructs |

## Group: ingestion-mechanisms


Paths relative to `internal/ingestion/`.

Verdicts per package:

- `aggregator/` (directory, no Go file): name ok / holds `pluggy` and `aggregatortest`; ok.
- `aggregator/aggregatortest`: name ok / one file, one concept (contract suite A211, `Backend` interface); production-tree package imported only by tests and named in `app/ports.go`; location ok.
- `aggregator/pluggy`: name ok / `port.go` (383 lines) mixes the `app.Aggregator` adapter with account and reserve mapping; split below.
- `aggregator/pluggy/client`: name ok (package comment in `model.go` says "Package pluggy", wrong) / transport (`client.go`) and translation to ingestion `domain` (`normalize.go`) share one package; dead constants in `model.go`.
- `aggregator/pluggy/client/pluggytest`: name ok / test support in its own package, imported only by `_test.go` files (`connection_test.go`, `client_test.go`, `conformance_test.go`); not linked into the binary; one file mixes server, fixture mutators and handler; sits 4 levels below the module (ADR 033 limit: mechanism adds one level).
- `ofx`: name ok / file boundaries ok; one concept (parser). `race_test.go` and `norace_test.go` are test-only build-tag helpers; ok.
- `csvfile`: name ok / file boundaries ok (260 lines, one concept).
- `charset`: name ok / file boundaries ok (`charset.go` Decode, `registry.go` Decoder and Names).

Test support check: `pluggytest/server.go` (442 lines, 357 non-blank) has no build tag and imports `testing`, but only test files import it; separation from production code holds. Location is inconsistent with `aggregatortest` (sibling of `pluggy`): both serve tests outside the `client` package.

Wiring check: `pluggy.NewPort` is called only from `ingestion.go:86` (module root `New`); no wiring inside the audited packages. `client.NewClient` and `client.NewSessions` are called only from `pluggy.NewPort`.

Configuration check: `DefaultURL` sits in `port.go` beside `NewPort`, which applies it; ok.

| File | Symbol | Problem | Target |
|---|---|---|---|
| aggregator/pluggy/client/model.go | package comment "Package pluggy ..." | unclear name | Comment states `Package client` calls the Pluggy API and decodes its payloads |
| aggregator/pluggy/client/model.go | `TypeCredit`, `SubtypeChecking`, `SubtypeSavings`, `StatusUpdated`, `StatusUpdating`, `recordDateLayout` | misplaced type | No non-test reference in the repository; delete, or move test-only ones to `pluggytest` |
| aggregator/pluggy/client/model.go | `statusPending`, `SubtypeCard`, `SubtypeReserve` in one `Account kinds` const block | misplaced type | `statusPending` moves to `aggregator/pluggy/client/normalize.go`, its only user |
| aggregator/pluggy/client/normalize.go | `Normalize`, `ReadBill`, `Date`, `counterparty`, `reserveName` | wrong package | `aggregator/pluggy/translate.go`; `client` keeps transport and wire models without importing `ingestion/domain` |
| aggregator/pluggy/client/normalize.go | `Normalize` (95 lines) | oversized function | `skipPending`, `readAmount`, `applyCardFields`, `applyBankFields`, `readInstallment`, `readDueDate`; `Normalize` calls each |
| aggregator/pluggy/client/normalize.go | `documentSchemes`, `cardKinds`, `operationReservedTransfer`, prefixes | misplaced type | Declared at the top of the file after imports, above `Normalize` per declaration order |
| aggregator/pluggy/client/amount.go | `Minor`, `Rounded` | mixed responsibility | Duplicate Rat parse, scale and range check; extract `scaled(d, scale)` used by both; same file |
| aggregator/pluggy/port.go | `Port` methods, `externalAccounts`, `holder`, `readReserve`, `itemInstant`, `updatedAt` | mixed responsibility | Port methods stay in `port.go`; `aggregator/pluggy/accounts.go` (externalAccounts, holder), `aggregator/pluggy/reserve.go` (readReserve) |
| aggregator/pluggy/port.go | `ReadAccount` (86 lines) | oversized function | `readBills`, `readBalance`, `readLines`, `readCreated`; closure of `session` calls them in sequence |
| aggregator/pluggy/port.go | balance date construction in `ReadAccount` and `readReserve` | mixed responsibility | Extract `balanceAt(updatedAt, amount, loc) *domain.Balance`; both call it |
| aggregator/pluggy/client/pluggytest/server.go | `serve` (60 lines) | oversized function | `failIfScheduled`, `authenticate`, `route`; `serve` locks and calls them |
| aggregator/pluggy/client/pluggytest/server.go | `Server` mutators (`AddItem` ... `SetNext`) vs `serve`, `transactionPage`, `matches` | mixed responsibility | `aggregator/pluggy/pluggytest/server.go` (Server, New, URL, serve, routes) and `aggregator/pluggy/pluggytest/fixtures.go` (mutators) |
| aggregator/pluggy/client/pluggytest/server.go | package path, 4 levels under the module | wrong package | `aggregator/pluggy/pluggytest`, sibling of `aggregatortest`'s depth; imports of 3 test files change |
| aggregator/pluggy/client/pluggytest/server.go | `RenameReservedBalance`, `SetReservedAmount`, `ChangeReservedIdentification` | mixed responsibility | Repeat the `BankData` nil-check and index loop; extract `eachReserve(accountID, identification, fn)` |
| aggregator/pluggy/client/pluggytest/server.go | `eachAccount` between mutators | unclear name | Move below its first caller, `RenameAccount`, per declaration order; same file or `fixtures.go` |

Oversized functions of the group in `long-before.txt`: `Normalize` (95), `ReadAccount` (86), `serve` (60) - 3 rows above, 3 covered. Files above 400 lines: `pluggytest/server.go` (442); below the ADR 033 limit of 600; covered by the split row.

## Group: marketdata


Verdicts per package:

- `marketdata` (root): name ok. Boundaries not ok: `marketdata.go` (524 lines) mixes Module struct, `New`, port interfaces, HTTP/tool adapters, calendar listing and instrument CRUD. No `app/` by ADR 033 Deviations; the split below stays in the root.
- `marketdata/toolapi`: name ok. `instrument.go` (493 lines) mixes input schema, argument decoding and preview/apply actions.
- `marketdata/domain`: name ok. File boundaries ok. `Accrue` is above 50 lines.
- `marketdata/feed`, `feed/*`, `index/*`, `expectation/*`: names ok. Function-level issues only (parsers above 50 lines).
- `marketdata/calendar`, `httpapi`: name ok. Only `httpapi/server.go` declarations were read; no finding.
- Test support in production code: none found in the files read.

Root split proposal (files in `internal/marketdata/`):

- `marketdata.go`: package comment, `Module` struct, `New` (about 70 lines).
- `config.go`: `FeedConfig`, `WithFeeds`, `Profiles`, `Admins`, `WithProfiles`, `WithAdmins`, constants `feedWindowDays`, `indexWindowDays`, `indexHistoryYears`, `probeDays`, default catalog and probe bounds.
- `types.go`: error aliases, `Instrument`, `Price`, `IndexSummary`, `IndexRate`, `Feed`, `Terms`, `IndexExpectations`, `Conversion`, `Holiday`, `Adjustment`.
- `adapters.go`: `Tools`, `RegisterRoutes`, `BodyLimits`, `listHolidays`, `calendarList`, `listCalendars`.
- `instruments.go`: `Instrument`, `Currencies`, `ListInstruments`, `DefineInstrument`, `EditInstrument`, `DeleteInstrument` and its helpers, `toInstrument`, `optional`.
- `region_defaults.go`: stays; gains `euroArea` above its first caller.

| File | Symbol | Problem | Target |
|---|---|---|---|
| internal/marketdata/accrual.go | accrue (64 lines) | oversized function | `accrualEnd`, `storedIndexRates(ctx,row)`, `toAccruedPrices(in,accrued)`; `accrue` calls the three |
| internal/marketdata/calendar.go | Holiday, Adjustment, Calendar | misplaced type | `internal/marketdata/types.go` for `Holiday`, `Adjustment`; `Calendar` interface stays |
| internal/marketdata/client.go | FeedClient, userAgentTransport | unclear name | `internal/marketdata/feed_client.go` |
| internal/marketdata/coverage.go | Coverage (52 lines) | oversized function | `sourceCoverageEntries(in,stored,on)` and `staleCoverage(cov,lag,today)` |
| internal/marketdata/domain/accrual.go | Accrue (63 lines) | oversized function | `accrualFace(t,quoteScale)`, `advanceDailyIndex`, `advanceMonthlyIndex`, `priceAt(d,state)`; `Accrue` loops over `pricedDays` |
| internal/marketdata/expectation/brfocus/brfocus.go | Fetch (55 lines) | oversized function | `focusQuery()`, `decodeRows(body)`, `latestSurveyDate(rows)`, `pointOfRow(r)` |
| internal/marketdata/expectations.go | expectationEntries, tickExpectation | mixed responsibility | `internal/marketdata/expectation_sources.go` (entries, IDs, `NewExpectationSources`); tick and `Expectations` stay |
| internal/marketdata/feed/b3consolidated/b3consolidated.go | parse (77 lines) | oversized function | `splitLines`, `readHeader(lines)` returning column indexes, `parseRecord(rec,cols,day,want)` |
| internal/marketdata/feed/b3cotahist/b3cotahist.go | readZIP (64 lines) | oversized function | `openSingleFile(zr,name)`, `parseRecord(rec,line,from,to,strict)`; `readZIP` scans lines |
| internal/marketdata/feed/cvmfunds/cvmfunds.go | readQuotes (63 lines) | oversized function | `readHeader(cr)` returning column indexes, `parseRow(row,cols,codes,from,to)`; header code shared with tesourodireto |
| internal/marketdata/feed/ecb/ecb.go | Fetch (60 lines), fetchHistory (61 lines) | oversized function | `earliestDay(env)`, `quotesOfEnvelope`; `openHistoryCSV(body)`, `quotesOfHistoryRows(rows,codes,from,to)` |
| internal/marketdata/feed/tesourodireto/tesourodireto.go | readFile (77 lines) | oversized function | `readHeader(cr)`, `parseRow(row,cols,n)` returning code and base date, `titleListing`; `readFile` loops |
| internal/marketdata/feed/yahoochart/yahoochart.go | parse (59 lines) | oversized function | package type `chartAnswer`, `decodeChart(body)`, `quotesOfResult(result,code,quote,from,to)` |
| internal/marketdata/feed_settings.go | Feeds (73 lines) | oversized function | `priceFeeds(ctx,env)`, `indexFeeds(ctx,env)`, `expectationFeeds(ctx,env)`, `feedEnv` struct for on, suggested, lags |
| internal/marketdata/feed_settings.go | feedRun, ran, Refresh, WaitRefresh, requireAdmin | mixed responsibility | `internal/marketdata/refresh.go`; `ErrUnknownFeed`, `ErrAdminRequired`, `Feed` alias to `types.go`; `Admins` to `config.go` |
| internal/marketdata/feeds.go | FeedConfig, WithFeeds, feedWindowDays | config scattered | `internal/marketdata/config.go`; `WithFeeds` also creates `life` and `stop`, which `RunFeeds` needs; create them in `New` |
| internal/marketdata/history.go | tickHistory, fetchHistory, finishHistory, historyFailures, leaves, quotesOfRows, historyJob | mixed responsibility | `internal/marketdata/history_tick.go`; `requestTick`, `wake`, `enabledSources`, `feedInstruments` move to `feeds.go` |
| internal/marketdata/index/cpi/cpi.go | readBLS (53 lines) | oversized function | `blsRequest(ctx,s,from,to)`, package type `blsDoc`, `levelsOfBLS(doc)` |
| internal/marketdata/indexes.go | indexEntries, IndexSourceIDs, NewIndexSources, businessDayIndexes | mixed responsibility | `internal/marketdata/index_sources.go`; `tickIndex`, `Indexes`, `IndexRates`, `storeRates`, `rank` stay |
| internal/marketdata/marketdata.go | whole file (524 lines) | oversized file | `marketdata.go`, `config.go`, `types.go`, `adapters.go`, `instruments.go` as listed above |
| internal/marketdata/probe.go | ProbeQuote (56 lines) | oversized function | `checkProbeInstrument(ctx,in)`, `splitProbeSources(ctx,in,on)`, `probeSources(ctx,sources,in)`; `latestQuote` stays |
| internal/marketdata/region_defaults.go | DefaultCalendar, euroArea | unclear name | Constant `CalendarWeekend` in `calendar.go` replaces the literal "weekend" here and in `New`; move `euroArea` above `SuggestedFeeds` |
| internal/marketdata/sources.go | sourceEntries (82 lines) | oversized function | table of data: exempt |
| internal/marketdata/toolapi/instrument.go | manageInstrument (227 lines), file 493 lines | oversized function | Schema: `instrument_schema.go` (types, `Values`, `manageInstrumentIn/Out`, `checkInstrumentArgs`, `without`). Decoding: `instrument_args.go` (`symbolMap`, `instrument`, `edited`, `terms`, `symbolsForEdit`, `parsePrice`). Action: `instrument_preview.go` with `previewDefine`, `previewRename`, `previewEdit`, `previewRecordPrice`, `previewDelete`, `previewRequestHistory`, `previewSetTerms`; `instrument_apply.go` with the matching `apply*` |
| internal/marketdata/toolapi/instrument.go | currency guard in rename, edit, delete (preview and apply) | mixed responsibility | `loadSecurity(ctx,svc,code)` in `instrument_args.go` returns the instrument or the "is a currency" `FieldError`; six repeated blocks call it |
| internal/marketdata/toolapi/market.go | getMarketData (149 lines) | oversized function | `checkMarketDataArgs(in)`, then one function per view: `viewInstruments`, `viewInstrument`, `viewPrices`, `viewCatalog`, `viewIndexes`, `viewIndexRates`, `viewIndexExpectations`, `viewCalendars`, `viewHolidays` |
| internal/marketdata/toolapi/market.go | instrumentView, termsView, priceView, `toInstrumentView`, `toTermsView`, `toCoverageView` | misplaced type | `internal/marketdata/toolapi/views.go`; `manageInstrument` also uses them |

Report:

- Rows: 27.
- Oversized functions covered: 17 of 17 in long-before.txt for the group.
- Not fully read (declarations only): `price.go`, `history.go`, `terms.go`, `calendar.go`, `convert.go`, `catalog.go`, `indexes.go` and `expectations.go` bodies, `feed/feed.go`, `feed/catalog.go`, `feed/coinbase`, `feed/bcbptax`, `index/brsgs`, `index/overnight`, `index/index.go`, `calendar/*`, `domain/*` except `accrual.go`, `httpapi/*` except the `server.go` function list.

## Group: classification-reporting


### Package verdicts

- classification (root): name ok; `classification.go` (302 lines) holds Module, New, event handlers, DTO aliases, import/manual decision methods and the ledger adapter in one file.
- classification/domain: name ok; `rule.go` (497 lines) holds rule types, validation and matching; `Category` sits in `split.go`.
- classification/app: name ok; `Service` and `NewService` sit in `rules.go`; `accounts` (ledger lookup) sits in `rules.go`. Other file boundaries ok.
- classification/httpapi: name ok; `rules.go` (390 lines) holds rule handlers and payee alias handlers.
- classification/postgres: name ok; `repository.go` (299 lines), `categorization.go`, `source_category.go`, `suggestion.go` not read; no finding.
- classification/toolapi: name ok; `manage_rule.go` (455 lines) and `toolapi.go` mix schema, argument decoding, rendering, lookup and action.
- reporting (root): name ok; `reporting.go` (167 lines) holds Module, New, wiring closure, aliases, interfaces, adapter and event handler. No config type exists.
- reporting/app: name ok; `cash.go` (403 lines) holds types, use cases, allocation and arithmetic; `Service` sits in `series.go`; `Clock` sits in `export.go`.
- reporting/httpapi: name ok; `export.go` mixes export and import handlers; `server.go` holds the error map.
- reporting/postgres: name ok; `archive.go` holds export state methods and archive building; `import.go` holds ordering, rows and secrets.
- reporting/toolapi: name ok; file boundaries ok except function sizes below.

No `region_defaults.go` is needed: neither module holds a regional value.

### Module roots

| Element | classification.go (today) | Target |
|---|---|---|
| Module, New, RegisterRoutes, Tools | `classification.go` | `classification.go` |
| Config | none; New takes pool, dispatcher, ledger, logger | no `config.go` |
| DTO aliases and types (MethodRule, ImportLine, LineCategory, ManualLine) | `classification.go`, interleaved with methods | `types.go` |
| Subscriptions, consumer, eventTypes, handle, handleMerge, handlePayeeMerge, handleTagRename | `classification.go` | `events.go` with `subscribe(dispatcher, port)` called by New |
| Method group DecideImport, DecideManual, importDecision(s) | `classification.go` | `decide.go` |
| Adapter ledgerPort (6 methods) and `names` | `classification.go` bottom and middle | `adapters.go` |

| Element | reporting.go (today) | Target |
|---|---|---|
| Module, New, RegisterRoutes, Tools, RebuildAll, BodyLimits | `reporting.go` | `reporting.go` |
| Config | none; New takes appVersion string | no `config.go` |
| DTO aliases (ArchiveVersion, Credentials, SealedCredentials, errors) and Commitments/Valuations | `reporting.go` | `types.go`; Commitments/Valuations also declared in `app/ports.go`, so alias them |
| Export group (OnImport, UseCredentials) | `reporting.go` | `export.go` |
| Indicator group (UseIndicatorSources) | `reporting.go` | `indicators.go` |
| Adapter `priced`, `priceMissing` | `reporting.go` | `adapters.go` |
| Handler `rebuildSeries` and inline export closure in New | `reporting.go` | `events.go`, closure named `onExportRequested` |

### Findings

| File | Symbol | Problem | Target |
|---|---|---|---|
| internal/classification/app/classify.go | classify (64 lines) | oversized function | `classifiable(facts, accounts)` returns subjects and targets; `applyDecisions(ctx, booksID, decisions, targets)` with `applyTransfer`; returns count. |
| internal/classification/app/events.go | HandleEvent (63 lines) | oversized function | `recordFor(ctx, e)` builds Record; `inheritRecord(ctx, e, rec)` replaces the two duplicated copy branches; `describeIfCorrected`; `classifyRecorded`; `persistRecord`. |
| internal/classification/app/preview.go | PreviewRule (56 lines) | oversized function | `previewBatch(ctx, booksID, ids, c, accounts, out)` loads facts and tallies; `tally(out, f, d)` holds the WouldCategorize/Conflicts switch. |
| internal/classification/app/rules.go | Service, NewService, accounts | misplaced type | `app/service.go` for Service and NewService; `app/accounts.go` for `accounts` and `invalidRef`. |
| internal/classification/app/rules.go | checkRule (70 lines) | oversized function | `checkConditionRefs(accounts, conds)`, `checkActionRefs(accounts, actions)`, `checkPayees(ctx, booksID, payees, fields)`, `isUsableCategory(account)` for the repeated test. |
| internal/classification/app/source_category.go | sourceCategories (59 lines) | oversized function | `countLineCategories(lines)`, `lineCategoryNames(lines)`, `mappedCategories(ctx, booksID, byAggregator)`, `categoryPerLine(lines, mapped)`. |
| internal/classification/classification.go | Module, handlers, ledgerPort, aliases | mixed responsibility | `classification.go`, `types.go`, `events.go`, `decide.go`, `adapters.go` as in Module roots table. |
| internal/classification/domain/codec.go | ConditionFromDoc (56 lines) | oversized function | `conditionValues(c, d.Value)` list extraction; `appendValue(&c, v)` per-field switch; `bad` closure becomes `wantError(field, want)`. |
| internal/classification/domain/decide.go | Decide (59 lines) | oversized function | `resolveAliasPayee`, `applyRules(subj, c, total, d)`, `decideFromSource(s, c, total, d)`, `decideFromHistory(s, c, total, d)`. |
| internal/classification/domain/decide.go | Catalog | misplaced type | `domain/catalog.go` holding Catalog, HistoryKey and Category (moved from `split.go`). |
| internal/classification/domain/rule.go | whole file (497 lines) | oversized file | `rule.go` (types, NewRule), `rule_check.go` (checkCondition, conditionShape, checkAction, checkParts), `subject.go` (Subject, matches, holds*). |
| internal/classification/domain/rule.go | MethodRule, MethodSource, MethodHistory | misplaced type | `domain/decide.go`, the decision method constants. |
| internal/classification/domain/rule.go | checkCondition (80 lines) | oversized function | `checkValueCount(want, n)`, `checkTextValues`, `checkEnumValues`, `checkMoneyValues`, `checkDayValues`; switch in `checkCondition` dispatches. |
| internal/classification/domain/rule.go | checkParts (57 lines) | oversized function | `checkPart(pf, p, &currency)` returns percent and remainder count; `checkPartTotals(field, percent, remainders)`. |
| internal/classification/domain/split.go | Category | misplaced type | `domain/catalog.go`; `split.go` keeps Allocation and Allocate. |
| internal/classification/domain/split.go | Allocate (56 lines) | oversized function | `fixedShares(total, parts, categories, date)` returns shares and left; `buildAllocations(total, parts, shares, left)`. |
| internal/classification/httpapi/rules.go | toAliasAPI, fromAliasInput, listPayeeAliases, createPayeeAlias, getPayeeAlias, changePayeeAlias, deletePayeeAlias | mixed responsibility | `httpapi/aliases.go` for alias handlers and converters; `rules.go` keeps rule handlers (about 280 lines). |
| internal/classification/toolapi/explain.go | explainCategorization (98 lines) | oversized function | Schema stays; `decodeExplain(in)` returns checked ids; `explainTransactions`, `explainStatistics`, `explainRulePreview`; handler dispatches by view. |
| internal/classification/toolapi/explain.go | descriptionRule | unclear name | Duplicates the simple-form branch of `ruleDocs` in `rule_build.go`; keep one `simpleRule(text, category, payee)` in `rule_build.go`. |
| internal/classification/toolapi/manage_rule.go | whole file (455 lines) | oversized file | `manage_rule.go` (Spec, schema types), `manage_rule_args.go` (ids, parseManage), `manage_rule_preview.go`, `manage_rule_apply.go`, `manage_rule_changes.go` (ruleChanges, ruleStatus). |
| internal/classification/toolapi/manage_rule.go | manageRule (205 lines) | oversized function | Keep `tool.NewWrite` with Spec and two calls. `previewManage` dispatches to `previewRuleChange`, `previewDeleteRule`, `previewReorder`, `previewSuggestion`, `previewRunRules`, `previewMapSource`, `previewAlias`; `applyManage` to `applyRuleChange`, `applyAlias` and one-line cases. |
| internal/classification/toolapi/manage_rule.go | parseManage (59 lines) | oversized function | `manageFields(in)` list; `manageNeeded(action, fields)`; `parseManageIDs(in)` returns ids; `parseManage` composes. |
| internal/classification/toolapi/manage_rule.go | ruleChanges (57 lines) | oversized function | `nameChange`, `patternChange`, `categoryChange`, `payeeChange`, `statusChange`, each returning an optional `tool.Change`. |
| internal/classification/toolapi/manage_rule.go | findSuggestion, findSourceCategory | misplaced type | `toolapi/lookup.go` with `allRules`; the two paging scans share one generic `scan[K, T](fetch, match)`. |
| internal/classification/toolapi/rules.go | listRules (133 lines) | oversized function | `decodeListRules(in)`; `listRulesKindRules`, `listSuggestions`, `listSourceCategories`, `listAliases`, each filling one `listRulesOut` field; views to `list_rules_views.go`. |
| internal/classification/toolapi/toolapi.go | optionalID, field, required, pageRequest, nextCursor, conditionsText, actionsText, allRules | mixed responsibility | `toolapi.go` (Names, Tools), `args.go` (optionalID, field, required, pageRequest, nextCursor), `render.go` (conditionsText, actionsText), `lookup.go` (allRules). |
| internal/reporting/app/cash.go | whole file (403 lines) | oversized file | `cash_types.go` (View, CardLine, CardPayment, Shares, CardFacts, CashPayment), `cash.go` (cashTotals, cashMonthTotals, CategoryCashPayments), `cash_allocation.go` (allocate, lineCategories, spread), `shares.go` (arithmetic). |
| internal/reporting/app/cash.go | allocate (87 lines) | oversized function | `financingTransactions(f)`, `statementBuckets(f, categories)`, `passEmptyStatements(buckets)`, `payBuckets(p, buckets)`, `moveFinancing(p, moved, byTx, bucketOf, categories)`. |
| internal/reporting/app/export.go | Clock | misplaced type | `app/ports.go`, with the other interfaces of the module. |
| internal/reporting/app/import.go | Import (104 lines) | oversized function | `readManifest(files)`, `archiveVersionOf(m)`, `readTables(files, m)`, `checkImportable(ctx, tables)`, `readAttachments(files, m)`, `readCredentialsBundle(files, m)`, `rebuildAll(ctx, booksID)`. |
| internal/reporting/app/indicators.go | Indicators (119 lines) | oversized function | `accountSets(accounts, base)`, `monthEnd(m, current, today)`, `addShares(f, shares, sets)`, `addBalances(ctx, f, m, sets)`, `committedOf(ctx, m, base)`. |
| internal/reporting/app/series.go | Service, NewService | misplaced type | `app/service.go`; `series.go` keeps Series, Basis, Point and rebuild methods. |
| internal/reporting/app/statement_analytics.go | analyse (56 lines) | oversized function | `statementCategories(facts, categories, charges, ref)` returns map; `totalParts(ref, byCategory)` builds StatementAnalytics; `sortCategoryParts`. |
| internal/reporting/httpapi/export.go | restoreArchive (80 lines) | oversized function | `readImportForm(body)` returns archive, creds, replace; `readLimited(part, limit)` replaces four copies; `toArchiveImport(res)`. |
| internal/reporting/httpapi/export.go | importArchive, restoreArchive, size constants | mixed responsibility | `httpapi/import.go` for import handler, form reading and constants; `export.go` keeps request, get, content, writeJSON. |
| internal/reporting/httpapi/server.go | ToProblem (81 lines) | oversized function | `httpapi/problems.go`: `rangeProblem(msg, fieldMsg)`, `archiveProblem(err)`, `credentialsProblem(err)`, `importProblem(err)`, `exportProblem(err)`; ToProblem chains them. |
| internal/reporting/postgres/archive.go | buildArchive (132 lines) | oversized function | `schemaVersion(ctx, tx)`, `archiveSources(facts)`, `writeTable(ctx, tx, src, booksID, w)`, `writeAttachments(ctx, tx, booksID, w, m)`, `finishArchive(z, buf, m)`; `archiveWriter` type replaces the closure. |
| internal/reporting/postgres/archive.go | NewExports, Exports, RequestExport, Export, ExportContent, FinishExport, EventExportRequested | mixed responsibility | `postgres/export.go` for export state methods; `archive.go` keeps manifest types, FactTables, primaryKey, BuildArchive, buildArchive. |
| internal/reporting/postgres/cash.go | CardFacts (52 lines) | oversized function | `cardLinesOf(rows)`, `cardPaymentsOf(rows)`, `categoryShares(postings)`; CardFacts composes the queries. |
| internal/reporting/postgres/cash.go | StatementCard, CardStatements, ChargeCategories | mixed responsibility | `postgres/statement_analytics.go`, matching `app/statement_analytics.go`. |
| internal/reporting/postgres/import.go | Import (118 lines) | oversized function | `deleteSignupRows(ctx, tx, order, facts, booksID)`, `insertTables(ctx, tx, order, byName, attachments, booksID)`, `applyLaterReferences`, `restoreSecrets(ctx, tx, sealed, booksID)`, `importError(err)`. |
| internal/reporting/postgres/import.go | loadOrder, columns, insert, foreignBook, jsonArray, withContent | mixed responsibility | `import_order.go` (laterReferences, loadOrder, columns); `import_rows.go` (insert, foreignBook, jsonArray, withContent); `import.go` keeps Import, clearable. |
| internal/reporting/reporting.go | Module, New, aliases, priced, rebuildSeries | mixed responsibility | `reporting.go`, `types.go`, `export.go`, `indicators.go`, `adapters.go`, `events.go` as in Module roots table. |
| internal/reporting/reporting.go | Commitments, Valuations | misplaced type | Both interfaces exist in `app/ports.go`; root declares `type Commitments = app.Commitments` in `types.go`. |
| internal/reporting/toolapi/history.go | getAccountHistory (73 lines) | oversized function | `checkHistoryRange(in)`, `flowDays(ctx, svc, ...)`, `balancePoints(ctx, svc, ...)`; handler dispatches by view. |
| internal/reporting/toolapi/indicators.go | getFinancialIndicators (65 lines) | oversized function | `indicatorMonth(in, today)` parses month; `indicatorViewOf(m, amount)` builds one view; `amountFunc(currency)`; `todayOf(clk)`. |

### Notes

- Test support in production code: none found; no non-test file imports `testing`.
- Config scattered: none; neither root declares a configuration type.
- Not fully read: classification `domain/{alias,suggestion,text,errors}.go`, `app/{aliases,imports,merge,stats,suggestions,ports}.go`, `httpapi/{categorization,source_categories,suggestions}.go`, all `postgres/*.go`; reporting `app/{categories,flows,indicator_months,archive_steps}.go`, `httpapi/{reports,indicators,statement_analytics}.go`, `postgres/{repository,indicators}.go`, `toolapi/categories.go`.
- `compareIDs` exists in `classification/app/rules.go` and `classification/toolapi/manage_rule.go`; the tool copy replicates the reorder check of `ReorderRules`.

## Group: portfolio-capture-instance


Verdicts per package:

- internal/portfolio: name ok; root file `portfolio.go` (392 lines) mixes Module, wiring, event handler and two adapters; the other layers' file boundaries are ok.
- internal/portfolio/app: name ok; `service.go` mixes service core, positions and tax-year use cases and their DTO types.
- internal/portfolio/httpapi, toolapi: name ok; handlers and mappers share one file (`server.go`, `portfolio.go`).
- internal/portfolio/domain, postgres, jurisdiction/br: name ok / file boundaries ok.
- internal/capture: name ok; root file `capture.go` (135 lines) holds Module, New, Profiles, and two adapters; no oversized file.
- internal/capture/app: name ok; `service.go` holds domain-like DTO types beside the use case.
- internal/capture/domain: name ok / file boundaries ok except the long readers listed below.
- internal/capture/httpapi, llmapi, postgres: name ok / file boundaries ok.
- internal/instance: name ok; `instance.go` (157 lines) holds Config, DTO types, constants, Module, New, two helpers.
- internal/instance/app, domain, httpapi, postgres, releases: name ok / file boundaries ok.
- Files above 400 lines in the group: none (largest `portfolio/httpapi/server.go` 399, `portfolio/portfolio.go` 392).

### Module root target shape

portfolio root (`portfolio.go` today holds everything except `region_defaults.go`):

| Item | Now | Target |
|---|---|---|
| Module, New, handle, RebuildAll, RebuildBooks, TrailingReturn, Tools, RegisterRoutes, ValuedBalances, accountNames | `portfolio.go` | `portfolio.go` (Module, New, RegisterRoutes, Tools); `rebuild.go` (handle, RebuildAll, RebuildBooks); `reads.go` (TrailingReturn, ValuedBalances, accountNames) |
| Profiles interface, `jurisdictions` adapter | `portfolio.go` | Profiles in `portfolio.go`; `jurisdictions` in `adapters.go` |
| `ledgerPort`, `marketPort`, consts dailyPeriod/monthlyPeriod | `portfolio.go` | `adapters.go` (or `ledger_port.go` and `market_port.go` if `adapters.go` passes 400 lines) |
| Config | none | none needed |
| DTO aliases | none | none |
| region_defaults | `region_defaults.go` | stays |

capture root:

| Item | Now | Target |
|---|---|---|
| Module, New, RegisterRoutes, SuggestUse | `capture.go` | `capture.go` |
| Profiles | `capture.go` | `capture.go` |
| `ledgerPort`, `classifierPort` | `capture.go` | `adapters.go` |
| Config, DTO aliases, region_defaults | none | none needed (language lexicon selection is in `app/service.go` `lexiconOf`) |

instance root:

| Item | Now | Target |
|---|---|---|
| Module, New, RegisterRoutes, RunBackups, RunVersionChecks, CheckVersion, StoreUpdateCheck, RotateSecrets | `instance.go` | `instance.go` (Module, New, RegisterRoutes); `jobs.go` (RunBackups, RunVersionChecks, CheckVersion, StoreUpdateCheck, RotateSecrets) |
| Config, Admins, Connection (public types) | `instance.go` | `config.go` (Config, Admins, Connection) |
| ReleasesURL, LogRecordsKept, LogKeys | `instance.go` | `config.go` |
| `connections`, `newSealer` | `instance.go` | `adapters.go` |

Two Config types in instance:

- `instance.Config` (`instance/instance.go`): input of the module, filled by `cmd/equori/main.go:349` and `internal/server` (fields Version, SecretKey, Clock, Admins, Outbox, Connections set by the server). Carries raw inputs: SecretKey, PreviousSecretKey, ReleaseURL, Connections of public type `instance.Connection`.
- `app.Config` (`instance/app/service.go`): subset the service reads. `New` derives it from `instance.Config`: adds Schema from `platformpostgres.LatestVersion()`, drops secret keys, Clock, Admins and ReleaseURL, and converts Connections to `domain.Connection`.
- Relation: `instance.Config` is the public wiring input; `app.Config` is the app-layer view built by `New`. They are two types with overlapping fields, not a duplicate.
- Target: `instance.Config` moves to `instance/config.go`. `app.Config` moves to `instance/app/config.go` and keeps its name; its Schema comment stays. `app/service.go` keeps Service, NewService, requireAdmin and the sentinel errors.

### Findings

| File | Symbol | Problem | Target |
|---|---|---|---|
| internal/capture/app/service.go | Account, Payee, Entry, Decision, Line, Clock | misplaced type | Port DTOs and `Clock` move to `internal/capture/app/ports.go` (it declares the other ports); `Line` to `app/line.go` |
| internal/capture/app/service.go | vocabulary, lexiconOf, entryOf, payeeNames | mixed responsibility | `internal/capture/app/preview_vocabulary.go` (mappers from ledger facts to domain); Preview stays in `service.go` |
| internal/capture/app/service.go | Preview | oversized function | 89 lines: `checkLineLimit`, `loadVocabulary`, `resolveDay`, `collectEntries`, `applyDecisions` |
| internal/capture/app/suggest.go | Suggest | oversized function | 103 lines: `keysOf`, `usableOptions`, `knownHints`, `askItems`, `askModel`, `saveAnswers` |
| internal/capture/app/suggest.go | SuggestItem, CategoryOption, Hint, Suggestion, hintKey | misplaced type | Types to `internal/capture/app/suggest_types.go`; Suggester/HintRepository DTOs stay beside ports |
| internal/capture/capture.go | ledgerPort, classifierPort | wiring in the wrong place | `internal/capture/adapters.go` |
| internal/capture/domain/amount.go | readAmount | oversized function | 54 lines: `readSignAndSymbol`, `readNumberWord`, `readFactorAndCurrency` |
| internal/capture/domain/date.go | readDate | oversized function | 59 lines: `readRelativeDay`, `readDayNumber`, `readSlashDate`, `readISODate` |
| internal/capture/domain/installments.go | readInstallments | oversized function | 52 lines: `readLead`, `readCount`, `readEachAmount` |
| internal/capture/domain/read_account.go | readAccounts | oversized function | 57 lines: `readNoMention`, `readOneMention`, `readTwoMentions` (orders the pair) |
| internal/instance/instance.go | Config, Connection, Admins, ReleasesURL, LogRecordsKept, LogKeys | config scattered | `internal/instance/config.go` |
| internal/instance/instance.go | connections, newSealer | wiring in the wrong place | `internal/instance/adapters.go` |
| internal/instance/instance.go | RunBackups, RunVersionChecks, CheckVersion, StoreUpdateCheck, RotateSecrets | mixed responsibility | `internal/instance/jobs.go` (methods by group) |
| internal/instance/app/service.go | Config | config scattered | `internal/instance/app/config.go` |
| internal/instance/app/backup.go | Backup, RunBackups, copyStep, writeCopy, RotateSecrets, SetCopyPassword | mixed responsibility | Split: `backup.go` (status, run), `copy.go` (copy password, copyStep, writeCopy, passwordSet, RotateSecrets); no file above 400 |
| internal/portfolio/portfolio.go | ledgerPort, marketPort, jurisdictions, dailyPeriod, monthlyPeriod | wiring in the wrong place | `internal/portfolio/adapters.go` |
| internal/portfolio/portfolio.go | handle, RebuildAll, RebuildBooks, TrailingReturn, ValuedBalances, accountNames | mixed responsibility | `internal/portfolio/rebuild.go` and `internal/portfolio/reads.go` |
| internal/portfolio/app/benchmark.go | benchmark | oversized function | 81 lines: `rateWindow` (filter held rates), `newBenchmark`, `applyIndexAnnual`, `applyReturnPercent` |
| internal/portfolio/app/benchmark_window.go | comparedWindow | oversized function | 52 lines: `recordedWindow` (credit checks, restart start) split from plain window setup |
| internal/portfolio/app/return.go | returnOf | oversized function | 51 lines: `checkReturnRange`, `reportCurrency` reuse, `externalFlowsValued` (flows + cash flows) |
| internal/portfolio/app/service.go | Position, Positions | mixed responsibility | `internal/portfolio/app/positions.go`; Positions body 52 lines: `positionOf`, `marketValueOf` |
| internal/portfolio/app/service.go | Result, IncomeEvent, TaxYear, RealizedResults, IncomeEvents | mixed responsibility | `internal/portfolio/app/tax_year.go` |
| internal/portfolio/app/service.go | Account, Price | misplaced type | `internal/portfolio/app/ports.go` (port DTOs used by Ledger and MarketData) |
| internal/portfolio/domain/rebuild.go | Rebuild | oversized function | 68 lines: `positionDays`, `realizedResults`, `incomeEvents` |
| internal/portfolio/httpapi/server.go | getReturn, excludedOf | oversized function | getReturn 85 lines: `returnParams`, `toReturnBenchmark`, `toReturnInflation`, `toReturnExcluded`; mappers to `httpapi/return.go` |
| internal/portfolio/httpapi/server.go | listPositions, listRealizedResults, listIncomeEvents, getAllocation, getNetWorth, getNetWorthDays, helpers | mixed responsibility | Handlers by topic: `positions.go`, `tax.go`, `return.go`, `allocation.go`; server.go keeps Server, Register, ToProblem |
| internal/portfolio/toolapi/portfolio.go | getPortfolio | oversized function | 95 lines: `validateView`, `allocationOut`, `netWorthOut`, `returnOut`; types stay |
| internal/portfolio/toolapi/portfolio.go | benchmarkView, excludedView, inflationView, benchmarkOf, inflationOf, excludedViewOf | mixed responsibility | `internal/portfolio/toolapi/return_views.go` |
| internal/portfolio/toolapi/tax_year.go | getTaxYear | oversized function | 52 lines: `salesOut`, `incomeOut` |

### Oversized functions (long-before.txt rows of the group)

| File | Symbol | Lines | Split |
|---|---|---|---|
| internal/capture/app/suggest.go | Suggest | 103 | `keysOf`, `usableOptions`, `knownHints`, `askItems`, `askModel`, `saveAnswers` |
| internal/portfolio/toolapi/portfolio.go | getPortfolio | 95 | `validateView`, `allocationOut`, `netWorthOut`, `returnOut` |
| internal/capture/app/service.go | Preview | 89 | `checkLineLimit`, `loadVocabulary`, `resolveDay`, `collectEntries`, `applyDecisions` |
| internal/portfolio/httpapi/server.go | getReturn | 85 | `returnParams`, `toReturnBenchmark`, `toReturnInflation`, `toReturnExcluded` |
| internal/portfolio/app/benchmark.go | benchmark | 81 | `rateWindow`, `newBenchmark`, `applyIndexAnnual`, `applyReturnPercent` |
| internal/portfolio/domain/rebuild.go | Rebuild | 68 | `positionDays`, `realizedResults`, `incomeEvents` |
| internal/capture/domain/date.go | readDate | 59 | `readRelativeDay`, `readDayNumber`, `readSlashDate`, `readISODate` |
| internal/capture/domain/read_account.go | readAccounts | 57 | `readNoMention`, `readOneMention`, `readTwoMentions` |
| internal/capture/domain/amount.go | readAmount | 54 | `readSignAndSymbol`, `readNumberWord`, `readFactorAndCurrency` |
| internal/portfolio/toolapi/tax_year.go | getTaxYear | 52 | `salesOut`, `incomeOut` |
| internal/portfolio/app/service.go | Positions | 52 | `positionOf`, `marketValueOf` |
| internal/portfolio/app/benchmark_window.go | comparedWindow | 52 | `recordedWindow`, plain window setup |
| internal/capture/domain/installments.go | readInstallments | 52 | `readLead`, `readCount`, `readEachAmount` |
| internal/portfolio/app/return.go | returnOf | 51 | `checkReturnRange`, `externalFlowsValued`, `cashFlowsOf` |

## Group: assistant-identity

Verdicts per package (paths under `internal/`).

- `assistant` (root): name ok. File boundaries not ok: `assistant.go` (245 lines) holds Config, ChatUse, DTO aliases, Module, New, adapters and five method groups.
- `assistant/app`: name ok. `turn.go` mixes the agent contracts, setters and the turn use case. `Turn` is 175 lines. `Usage`, `candidates`, `Confirm` exceed 50 lines.
- `assistant/domain`, `assistant/guide`, `assistant/llmapi`, `assistant/toolapi`, `assistant/postgres`: name ok / file boundaries ok.
- `assistant/httpapi`: name ok. `server.go` (300 lines) holds the provider and use handlers beside Register; `toProblem` is 61 lines.
- `identity` (root): name ok. File boundaries not ok: `identity.go` (186 lines) holds consts, errors, DTOs, Config, Module, New and four method groups. `region_defaults.go` is correct.
- `identity/app`: name ok. `CompleteSetup` (71) and `Login` (61) exceed 50 lines. `service.go` holds the sentinel errors of every use case.
- `identity/domain`, `identity/password`, `identity/toolapi`: name ok / file boundaries ok.
- `identity/httpapi`: name ok. `server.go` (422 lines) mixes Register, Authorize, cookies, session/setup/me handlers, JSON helpers and `ToProblem` (71 lines).
- `identity/postgres`: name ok. `repository.go` (519 lines) holds eight concepts; `second_factor.go` (386), `invitation.go` (212) are single-concept.
- Test support in production code: none found (grep of `testing`/`httptest` imports in non-test files of both modules returned nothing).
- Region defaults: `assistant` has no regional value (ChatUse defaults are provider models). `identity` already has `region_defaults.go`.

Module-root target shape.

| Item | assistant now (`assistant.go`) | assistant target | identity now (`identity.go`) | identity target |
|---|---|---|---|---|
| Module, New | Module struct, New (59 lines) | `assistant.go` | Module struct, New | `identity.go` |
| Config | Config, ChatUse var | `config.go` (Config); `chat_use.go` is not needed, ChatUse moves to `config.go` | Config, PasswordCost | `config.go` |
| DTO aliases and types | AccountNotice, Signal, Prompt, PromptArgument, ErrSecretKeyMissing | `types.go` | RoleAdmin/RoleMember, ErrEmailTaken/ErrUnknownEmail/ErrInvalidAccessToken, AccessGrant, Member | `types.go` |
| Adapters | instancePreset, wait default closure, sealer opening in New | `adapters.go`: `newSealer`, `instancesOf`, `defaultWait` | sealer opening in New | `adapters.go`: `newSealer` |
| Region defaults | none | none | `DefaultTimeZone` | `region_defaults.go` (unchanged) |
| Method group: chat wiring | Tools, UseTools, UseNotices, UseSignals, UseRouter, bindAgent | `chat.go` | none | none |
| Method group: provider keys | RotateSecrets, ExportProviderKeys, SealProviderKeys | `keys.go` | RotateSecrets | `members.go` |
| Method group: MCP | Instructions, Prompts | `mcp.go` | none | none |
| Method group: HTTP | Resolver, RegisterRoutes | `assistant.go` | RegisterRoutes, Authorize, VerifyAccessToken | `access.go` (Authorize, VerifyAccessToken); RegisterRoutes in `identity.go` |
| Method group: books and profile | none | none | Profile, InBooks, Location, StartSetup, UseUpdateCheck | `books.go` (Profile, InBooks, Location); `setup.go` (StartSetup, UseUpdateCheck) |
| Method group: members | none | none | IsAdmin, CreateMember, ResetSecondFactor | `members.go` |

| File | Symbol | Problem | Target |
|---|---|---|---|
| internal/assistant/app/proposal.go | Confirm (54 lines) | oversized function | Steps: `claimProposal`, `verifyBasis` (stale branch), `executeProposal`, `recordDecision`. |
| internal/assistant/app/proposal.go | UseTools | misplaced type | Setter moves to `app/service.go` with the other `Use*` setters. |
| internal/assistant/app/resolve.go | candidates (64 lines) | oversized function | `chainTargets(chain, byID, use)`, `defaultTargets(providers, use)`, `instanceTargets(use)`. |
| internal/assistant/app/turn.go | Turn (175 lines) | oversized function | `validateText`, `loadConversation`, `requireChat`, `loadPromptContext`, `openConversation`, `runAgent`, `recordFailure`, `storeAnswer`. |
| internal/assistant/app/turn.go | AgentRequest, AgentResult, UseAgent, UseNotices | misplaced type | Types go to `app/ports.go` beside `Agent`; setters go to `app/service.go`. |
| internal/assistant/app/turn.go | turnState, turnKey, TurnConversation | mixed responsibility | `app/turn_state.go`. |
| internal/assistant/app/usage.go | Usage (82 lines) | oversized function | `usageInputs`, `usageRowIndex`, `sortUsageRows`, `buildUsageRows`. |
| internal/assistant/assistant.go | Config, ChatUse | config scattered | `assistant/config.go`. |
| internal/assistant/assistant.go | AccountNotice, Signal, Prompt, PromptArgument | misplaced type | `assistant/types.go`. |
| internal/assistant/assistant.go | New (59 lines) | oversized function | `newSealer`, `instancesOf`, `usesOf`, `defaultWait` in `assistant/adapters.go`. |
| internal/assistant/assistant.go | instancePreset | wiring in the wrong place | `assistant/adapters.go`. |
| internal/assistant/assistant.go | UseTools, UseNotices, UseSignals, UseRouter, bindAgent | mixed responsibility | `assistant/chat.go`. |
| internal/assistant/assistant.go | RotateSecrets, ExportProviderKeys, SealProviderKeys | mixed responsibility | `assistant/keys.go`. |
| internal/assistant/assistant.go | Instructions, Prompts | mixed responsibility | `assistant/mcp.go`. |
| internal/assistant/httpapi/server.go | toProblem (61 lines) | oversized function | Sentinel-to-problem table `problemTable` plus a loop; typed-error branches stay. Table of data: exempt for the switch. |
| internal/assistant/httpapi/server.go | listPresets, listProviders, createProvider, updateProvider, deleteProvider, listProviderModels, toProvider, caps, value | mixed responsibility | `httpapi/provider.go`. |
| internal/assistant/httpapi/server.go | listUses, setUseChain, toUse | mixed responsibility | `httpapi/use.go`. |
| internal/identity/app/service.go | ErrNotFound ... ErrAppearanceTooLarge | mixed responsibility | `app/errors.go`; `service.go` keeps Service, NewService, limits. |
| internal/identity/app/session.go | Login (61 lines) | oversized function | `checkLoginInput`, `verifyMember` (unknown-email dummy hash path), `finishPasswordLogin` (reset throttle, expired sessions, books, session). |
| internal/identity/app/setup.go | CompleteSetup (71 lines) | oversized function | `checkSetupToken`, `prepareFirstBooks` (base, name, zone), `consumeSetupToken`, `runSetupHooks`. |
| internal/identity/httpapi/server.go | server.go (422 lines) | oversized file | Split: `server.go` (Server, Register), `authorize.go`, `session.go`, `setup.go`, `me.go`, `cookie.go`, `problem.go`, `json.go`. |
| internal/identity/httpapi/server.go | Authorize, memberKey, isAPI | mixed responsibility | `httpapi/authorize.go`. |
| internal/identity/httpapi/server.go | completeSetup, createSession, deleteSession | mixed responsibility | `httpapi/session.go` (session) and `httpapi/setup.go` (setup). |
| internal/identity/httpapi/server.go | getCurrentUser, updateCurrentUser, toAPIUser | mixed responsibility | `httpapi/me.go`. |
| internal/identity/httpapi/server.go | cookie, loginCookie, CookieName, loginCookieName | mixed responsibility | `httpapi/cookie.go`. |
| internal/identity/httpapi/server.go | decodeBody, writeJSONCookie, optional, deref | mixed responsibility | `httpapi/json.go`. |
| internal/identity/httpapi/server.go | ToProblem (71 lines) | oversized function | Table `problemTable` of sentinel, status, code, detail, in `httpapi/problem.go`; the `FieldError` branch stays. Table of data: exempt. |
| internal/identity/httpapi/server.go | errInvalidRequest | misplaced type | `httpapi/problem.go`. |
| internal/identity/identity.go | Config, PasswordCost | config scattered | `identity/config.go`. |
| internal/identity/identity.go | RoleAdmin, RoleMember, Err*, AccessGrant, Member | misplaced type | `identity/types.go`. |
| internal/identity/identity.go | sealer opening in New | wiring in the wrong place | `identity/adapters.go`, `newSealer(cfg)`; `assistant/adapters.go` holds the same step. |
| internal/identity/identity.go | Authorize, VerifyAccessToken | mixed responsibility | `identity/access.go`. |
| internal/identity/identity.go | Profile, InBooks, Location | mixed responsibility | `identity/books.go`. |
| internal/identity/identity.go | IsAdmin, CreateMember, ResetSecondFactor, RotateSecrets | mixed responsibility | `identity/members.go`. |
| internal/identity/identity.go | StartSetup, UseUpdateCheck | mixed responsibility | `identity/setup.go`. |
| internal/identity/postgres/repository.go | repository.go (519 lines) | oversized file | `repository.go` (Repository, NewRepository, helpers), `member.go`, `books.go`, `membership.go`, `session.go`, `profile.go`. |
| internal/identity/postgres/repository.go | CreateMember, CreateFirstMember, AnyMember, insertMember, insertBooks, LoginBooks, MemberByID, MemberByEmail, toMember | mixed responsibility | `postgres/member.go`. |
| internal/identity/postgres/repository.go | CreateBooks, BooksZone, BooksName, UpdateBooksSettings, DeleteBooks, MemberBooks, booksCreated, booksCreatedEvent | mixed responsibility | `postgres/books.go`. |
| internal/identity/postgres/repository.go | TouchMembership, Members, ChangeRole, RemoveMembership, changeMembership | mixed responsibility | `postgres/membership.go`. |
| internal/identity/postgres/repository.go | CreateSession, SwitchSession, MemberBySession, DeleteSession, DeleteExpiredSessions | mixed responsibility | `postgres/session.go`. |
| internal/identity/postgres/repository.go | UpdateProfile, Locale, Appearance, SetAppearance, SetDisplayName | mixed responsibility | `postgres/profile.go`. |
