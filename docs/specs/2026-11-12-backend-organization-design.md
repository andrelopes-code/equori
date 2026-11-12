# Backend organization design

Phase B of `docs/superpowers/plans/2026-11-12-backend-reorganization-brief.md`. Input: `docs/specs/2026-11-12-backend-organization-audit.md`. Record of the decision: `docs/adr/035-backend-file-organization.md`.

## Goal

Every Go package and file of the backend holds one responsibility, named by the concept it holds. A reader finds a type, a function, a configuration or a wiring step by its file name.

Non-goals: behavior change; changes to `api/`, `db/migrations/`, `web/`, request or response bodies, log texts, error texts or the order of side effects at startup.

## Decisions

| ID | Question | Choice | Source |
|---|---|---|---|
| BO1 | Where does a `Config` type live? | In `config.go` of its package. Defaults and validation sit in the same file. A separate `config_validate.go` is created only when `config.go` exceeds 400 lines. | Brief, B1 |
| BO2 | Where does `platform/config.Config` convert to module configurations? | Two hops, one file each. `cmd/equori/config.go` converts `config.Config` to `server.Config` (`serverConfig`). `internal/server/modules.go` converts `server.Config` to each module `Config`. No other file reads `config.Config`. | Brief, B1; audit, cmd group |
| BO3 | Shape of a module root | `<module>.go`: `Module`, `New`, exported methods that are few; `config.go`: `Config` types (only when the module has one); `types.go`: public DTOs, aliases and the interfaces of the root; `adapters.go`: adapters to other modules; `region_defaults.go`: unchanged; one file per group of exported methods, named by the group (`rebuild.go`, `sync.go`, `credentials.go`). A module without a `Config` has no `config.go`. A deviation is stated in the module README. | Brief, B2 |
| BO4 | Shape of `cmd/equori` | `main.go` (at most 80 lines: `main`, `run` with one call per case), `serve.go`, `config.go`, `logging.go`, `healthcheck.go`, `version.go`, `commands.go` (`withApp`, `errUsage`), one file per subcommand (`reporting.go`, `planning.go`, `portfolio.go`, `backup.go`, `restore.go`, `secrets.go`, `user.go`). `cmd/demoseed` follows the same rule: `main.go` calls `run`, one file per topic, data tables in `*_data.go`. | Brief, B3; audit, cmd group |
| BO5 | Shape of `internal/server` | `config.go` (`Config`), `app.go` (`App`, `New`, contract validator), `modules.go` (one constructor per module or group, in the construction order of the audit), `adapters.go` (the four adapter files merged: account notices, credential source, instance connections, recurring signals, `mcpPrompts`, `linkAdapters`), `outbox.go` (`newDispatcher`, `wireOutbox`), `routes.go` (`registerRoutes`, `mcpHandler`, `mcpGrant`, `newHandler`), `apidoc.go` (from `platform/apidoc`). Each function has at most 50 lines. | Brief, B4 |
| BO6 | Review of `internal/platform` | Moves accepted: `platform/apidoc` into `internal/server/apidoc.go` (sole importer); file splits inside `llm`, `tool`, `config`, `contract`, `httpserver`, `postgres`, `registry` as in the audit rows. Moves refused: `httpserver` handler helpers to a new package `httphandler` (71 importers change; the helpers are named in ADR 034; the package comment of `httpserver` is amended instead); `pgtest` identity fixtures to `identitytest` (a package of a module other than its root violates the `depguard` rule of ADR 033); deletion of `Tool.ValidateOutput` (changes an exported method; the method has a test caller in package `tool`). Each refusal has its reason in the ADR. | Brief, B5; audit, platform groups |
| BO7 | Rule for long functions | A function body above 50 lines is split into named steps in the same file, below its caller, with the same behavior. A table of data is exempt. A tool definition separates its schema, its argument decoding and its action. Step names state the action (`loadSecurity`, `decodePurchase`), never `part1`. | Brief, B6 |
| BO8 | New gates | `internal/platform/layout` lowers `maxFileLines` from 600 to 400. It adds `TestGoFunctionSize` (body above 50 lines fails). Both gates read an allow-list: `long_files.txt` (`path<TAB>reason`) and `long_functions.txt` (`path<TAB>function<TAB>reason`). An entry whose file or function no longer exceeds the limit fails the test, so the list only shrinks. The tables of data enter the list with the reason `table of data`. The lists start with every current offender; each task of the plan removes the entries its change resolves. | Brief, B7 |
| BO9 | Naming | A file is named by its concept in lower snake_case. No package named `util`, `helpers`, `misc`, `common`, `types` or `base`. A file `types.go` exists only in a module root and holds public DTOs. | Brief, B8 |
| BO10 | Function metric | Body lines are the lines between `{` and `}`, exclusive, over `internal/` and `cmd/` production files outside `*.gen.go` and `testdata`. The audit baseline uses this metric (197 functions). | Audit, Baseline |
| BO11 | Extraction of pure logic between layers | `planning/app/recurring.go` series detector (`DetectSeries`, `detectGroup`, `cadences`) moves to `planning/domain/series.go`. No other cross-layer move is made: the audit rows that propose one beyond this stay as file splits inside the layer. | Audit, planning group |
| BO12 | Rows that change an exported signature | Refused. Examples: `planning.New` with eight positional arguments, `WithFeeds` ordering in `marketdata`, removal of exported methods. The plan lists them under Out of scope. | Brief, Non-goals |
| BO13 | Parity proof | Each task proves, with `parity.py` in the scratchpad, that the multiset of non-blank lines of the touched packages is equal before and after, except `import` lines, signatures and calls of extracted step functions, and lines the layout rule requires. | Brief, Phase D |
| BO14 | One plan file against the four-slice limit of `docs/contributing/agents.md` | The plan file holds five parts of at most four slices each; the limit applies per part. | Brief, Phase C |
| BO15 | `app/ports.go` above 400 lines (ledger, 526 lines) against the rule that `app` declares its ports in `app/ports.go` | `ports.go` keeps the repository and clock ports; cohesive groups of ports move to `ports_<group>.go` in the same package. The directory limit of 40 files is not raised: small files of the same concept merge. | ADR 033, ADR 035 |

## Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: the change moves code and adds no value that varies by country. |
| R2 | Does not apply: no behavior is added. |
| R3 | Does not apply: no value set is added. |
| R4 | Does not apply: no extension point is added; `region_defaults.go` files keep their content. |
| R5 | Does not apply: no user text is added; log and error texts stay byte-equal. |
| R6 | Does not apply: no screen is changed. |
| C1 | Does not apply: no amount is stored or computed. |
| C2 | Does not apply: no amount is added or compared. |
| C3 | Does not apply: no screen reads a currency. |
| C4 | Does not apply: no displayed currency changes. |
| T1 | Does not apply: no date is used by new code. |
| T2 | Does not apply: no business-day or due-date logic is added. |
| B1 | Does not apply: no table is added. |
| B2 | Does not apply: no operation is added; routes and `x-book-role` stay unchanged. |
| B3 | Does not apply: no setting is added. |
| D1 | Does not apply: no table is added. |
| D2 | Does not apply: no schema change. |
| D3 | Does not apply: no recorded fact changes. |
| D4 | Does not apply: no data is written from a bank, a file or a model. |
| D5 | Does not apply: the diagnostic file is unchanged. |
| S1 | Does not apply: `api/openapi.yaml` and `tool_exposure_test.go` are unchanged. |
| S2 | Does not apply: no screen is changed. |
| S3 | Does not apply: no user action changes. |
| S4 | Does not apply: the assistant context and tools keep their schemas and texts. |
| X1 | Does not apply: no scenario is added. The pass count of each package is equal before and after, plus the tests of the new gates. |
| X2 | Does not apply: R1, R2, C2 and C3 do not apply. |

## Verification

- Per task: the package tests with the count script of the brief, equal before and after; `bin/golangci-lint fmt` and `bin/golangci-lint run` on the touched packages; the parity script.
- Phase E: `go test -count=1 -json ./...` once, `bin/golangci-lint run ./...`, `make gen-check`, `make tidy-check`, `make check`.

## Decisions made during execution

| Question | Decision | Task |
|---|---|---|
| Second `readEnvFile` call in `serve` | Removed; `setupWithFile` returns the file `setup` read. Nothing between the two reads writes `equori.env`. | T2 |
| `//nolint:gosec` (G704) on two HTTP requests of `cmd/demoseed` after the `run` split | Added with the existing justification. | T3 |
| Order of `UseNotices`, `OnImport`, `UseCredentials` in `server.New` | They run in `linkAdapters`, after `planning.New`. The three setters assign fields; no constructor reads them. | T4 |
| `ledgerPort` of ingestion | Own file `ledger_port.go` (377 lines); `adapters.go` would pass 400 lines. | T10 |
| Constants `StatusUpdating` and `recordDateLayout` of `pluggy/client/model.go` | Deleted: no reference in production or test code. | T11 |
| `pluggytest` location | `aggregator/pluggy/pluggytest` (depth rule of ADR 033). | T11 |
| `ports.go` of `ledger/app` above 400 lines | BO15: `ports.go` plus `ports_records.go`. | T16 |
| Directory limit of 40 files in `ledger/app` | Two pairs of small files merged (`installment.go`, `confirm_line.go`). | T16 |
| A function split enlarges a file above 400 lines | Whole declarations move to a file of the same concept in the same task. | T22, T23 |
| Error-to-problem mappers (`ToProblem`, `toProblem`) | Listed as tables of data in `long_functions.txt`. | T1 |
| Planning series detector | Moved to `planning/domain/series.go` (BO11). | T20 |

Structural deviations that remain: a moved line already above 100 columns keeps its wrapping (the parity rule outranks the column rule for verbatim moves); the audit rows for the subscribe loops of `ledger.New`, `classification.New` and `reporting.New`, the duplicate `Commitments` and `Valuations` aliases of `reporting`, the `Holiday` and `Adjustment` move of `marketdata`, the `life` and `stop` creation of `marketdata.New`, and the generic `scan` of `classification/toolapi` were not applied (behavior or exported-name risk). A commit of type `style` (`326a0935`) exists in the history; amending was not allowed.

## Measurements

Measured on `main` after T40 (metric BO10).

| Measure | Start | End |
|---|---|---|
| Production files above 400 lines | 17 | 0 (`long_files.txt` is empty; largest: `ingestion/app/review.go`, 399) |
| Function bodies above 50 lines | 197 | 9, all tables of data in `long_functions.txt` |
| Functions in the repository | 3708 | 4326 |
| `cmd/equori/main.go` | 474 lines | 52 lines |
| `internal/server/server.go` | 333 lines | removed; `config.go` 60, `app.go` 92, `modules.go` 329, `adapters.go` 255, `routes.go` 123, `outbox.go` 19, `apidoc.go` 24 |
| Go tests passing (`go test -count=1 -json ./...`) | 3409 at `eddcbeb5` | 3405, 0 failures |

The difference of 4 passes: the other session removed `TestDownsample` (9 passes) in `285a386c` and added 3 tests (`TestSeedKeepsExistingPrices`, `TestRestoredBackupMatchesTheOriginal`, `TestBuiltScriptsHaveNoCommonJSRequire`); this work added `TestGoFunctionSize` and `TestMainSize`. Tests moved between packages with the code (`TestNormalize` to `pluggy`, `TestDetectSeries` to `planning/domain`).

`Config` types and their files: `assistant/config.go`, `identity/config.go`, `ingestion/config.go`, `instance/config.go`, `instance/app/config.go`, `marketdata/config.go` (`FeedConfig`), `platform/config/config.go`, `platform/tool/mcp/config.go`, `server/config.go`.

Checks: `bin/golangci-lint run ./...` reports only the typecheck error of `internal/server/cluster_copy_test.go:193` (tag `cluster`), present before this work; `make gen-check` and `make tidy-check` pass. `make check` stops at its `lint` step on that same error, so the steps after it did not run through `make check`. `make test-race` passes (exit 0). `make web-check` and `make test-cluster` did not run: the web tree holds uncommitted changes of another session and the `cluster` test package does not compile because of the same typecheck error.
