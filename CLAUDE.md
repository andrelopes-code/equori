# equori

Self-hosted personal finance manager. Go backend, PostgreSQL, single binary, single container. The web interface (`web/`) is a single-page application embedded in the binary (ADR 008).

Decisions: `docs/adr/`. Read the relevant ADR before changing what it covers.

## Commands

| Command | Purpose |
|---|---|
| `make check` | Everything: format, tidy and generated-code checks, lint, `make web-check`, Go tests with `-race`. CI runs it on every pull request. |
| `make test` / `make test-race` | Go tests, without or with `-race`, on the test server `db-test` (`127.0.0.1:54339`, data in memory) |
| `make db-up` / `make dev` | Start local Postgres on `127.0.0.1:54329`, run the app on `:8080`; reads `dev.env`, then `~/.config/equori/local.env` (`LOCAL_ENV`) when present, then `.env` |
| `make web-dev` | Vite dev server for `web/`, proxying `/api` to `make dev` |
| `make run-dev` | `make dev` and `make web-dev` together |
| `make run-prod` | Production build served by the binary on `:8091` (`PROD_ADDR`), beside `make run-dev` |
| `make web-check` | Build `web/`, then typecheck, ESLint and Prettier check |
| `make gen` | Regenerate sqlc and oapi-codegen output after editing `db/queries`, `db/migrations` or `api/openapi.yaml`; also compiles the theme |
| `make vuln` | govulncheck |
| `make dist` | Release archives and `SHA256SUMS` in `dist/` (ADR 022) |
| `make upgrade-test` | A database seeded by one image keeps every fact under another (ADR 022, R7); defaults to the current tree as both |
| `make test-cluster` | Managed-mode tests (build tag `cluster`) inside `postgres:18`; `make check` runs it |
| `make standalone-smoke` | Builds and checks the standalone image |
| `make hooks` | Install the git hooks of `lefthook.yml` (ADR 015): a commit formats and lints its staged files and checks generated code when its sources change; a push lints, typechecks and runs the Go tests and the web tests related to the files it sends |

Tools are pinned in `tools/go.mod` and built into `bin/`; `web/` tools are pinned in `web/package.json`, and pnpm runs from inside `web/` so Corepack selects its version. Do not install tools globally. Do not add custom lint scripts.

## Layout

```
cmd/equori/            composition root only: config, wiring, start
internal/platform/     infrastructure without business rules
internal/<module>/     one business module (see ADR 002): identity, ledger, marketdata, reporting, ingestion, classification, assistant
internal/server/       composition of every module: HTTP handler and outbox dispatcher
internal/apitest/      HTTP test harness over internal/server
db/migrations/         goose SQL migrations, embedded
db/queries/<module>/   sqlc queries, one directory per owner module
api/openapi.yaml       HTTP contract (source of truth for server and frontend types)
docs/adr/              decision records
web/                   single-page application (Vite, React, TypeScript), embedded by web/embed.go
```

Module internals: `<module>.go` (public API) → `internal/domain` → `internal/app` → `internal/adapter/{postgres,httpapi,toolapi}`. Dependency rules are in ADR 002 and enforced by `depguard` and the compiler.

## Language

Everything is in English: identifiers, files, packages, comments, log messages, errors, tests, docs, commit messages. Use plain, precise English.

## Naming

- Packages: short, lowercase, singular, no underscores (`ledger`, `httpapi`). Forbidden: `util`, `utils`, `common`, `helpers`, `misc`, `base`, `types`.
- No stutter: `ledger.Service`, not `ledger.LedgerService`.
- Initialisms keep one case: `ID`, `URL`, `HTTP`, `userID`, `ParseURL`.
- Files: lowercase snake_case, named after the concept they hold (`account.go`, `account_test.go`). One concept per file.
- Domain names follow finance vocabulary: `Account`, `Transaction`, `Posting`, `Category`, `Budget`, `Money`. One term per concept across code, SQL and API.
- Tables are prefixed by owner module: `ledger_account`, `budget_envelope`.
- Interfaces are declared by the consumer (`app` declares its ports), named by behavior (`AccountRepository`, `Clock`).
- Errors: wrap with `fmt.Errorf("verb object: %w", err)`; sentinels named `ErrXxx` in the package that returns them.

## Code

- Standard library first. A new dependency needs an ADR or explicit approval.
- Cross-cutting conventions (transactions, money, dates, pagination) are in ADR 005: `platform/money`, `platform/clock`, `platform/page`. Never `float64` for amounts.
- `context.Context` is the first parameter of any function doing I/O.
- No global mutable state. Dependencies are passed through constructors.
- Tests sit next to the code, table-driven. Postgres adapters are tested against a real database from `pgtest.New(t)`, not mocks.
- HTTP errors are RFC 9457 problems written with `internal/platform/problem` (ADR 004).
- Language model calls go through `internal/platform/llm` (ADR 009); each module declares its chain in code.
- Tools for language models are declared in `adapter/toolapi` and composed in `internal/server` (ADR 012).
- Handlers get the user with `auth.MustUserID(ctx)` (`internal/platform/auth`) and pass it to `app` explicitly. Every `/api/` route is authenticated by `identity.RequireSession`; only login is exempt.
- `*.gen.go` files are generated; never edit them. A new module adds an entry to `sqlc.yaml`, `db/queries/<module>/`, a tag in `api/openapi.yaml` and `adapter/httpapi/oapi-codegen.yaml`.
- Every business table has `user_id`; every query on it filters by `user_id` (ADR 003).

## Regions

equori serves users of any country. `docs/contributing/regions.md` lists the extension points.

- No regional value (currency, calendar, exchange, aggregator, identifier scheme, tax rule, word, number or date format) is a literal or a default outside the implementation of its region.
- Behavior that differs by country or language is an extension point under ADR 016. A value chosen by region is a case of a `switch` in `<module>/region_defaults.go`; a region without a case gets the neutral value.
- A value set that grows with regions is `^[a-z0-9_]{2,40}$` in SQL and a `pattern` in `api/openapi.yaml`, never a closed `IN` or `enum`.
- A new extension point adds its row to `docs/contributing/regions.md` in the same change.
- A spec or plan names each region-dependent value it introduces and the extension point that serves it.

## Tests

The suite is the safety net against regressions; agents change code only behind it.

- A behavior change starts with a test that fails without it. Run it and read the failure before writing the implementation; a test that passes on first run proves nothing until it is shown to fail.
- A bug fix starts with a test that reproduces the bug.
- Never delete a test, add `t.Skip`, loosen an assertion or change an expected value to make a failing test pass. A test changes only when the specified behavior changes; the commit body names the spec section or amendment.
- Each acceptance scenario of `docs/domain/06-*.md` in a delivered phase has a test through the HTTP API (`internal/apitest`) whose name or comment carries the scenario ID (`S24`).
- Each database invariant has a schema test that violates it with direct SQL and expects the rejection.
- Each `Problem.code` returned by a module has a test that triggers it through the HTTP API.
- Assert exact values. Check the status before decoding a body: a 404 decoded into a struct yields zero values that pass emptiness checks.
- Tests are deterministic: a fixed date through `apitest.Today`, no sleeps, no wall clock, no dependence on map order.
- Assert observable outcomes (HTTP responses, rows, published events), not internal calls. No mocks of the repository or of PostgreSQL.
- Tests with the build tag `eval` or `live` call a paid or quota-limited provider API with the owner's key. Agents never run them, never pass `-tags eval` or `-tags live`, and never export `EQUORI_GEMINI_API_KEY`, `EQUORI_EVAL_KEY` or any provider key to a test, unless the owner asks for that run in the same message and names the model and request budget.

## Comments

Write a comment only when it carries information the code cannot: a non-obvious reason, an invariant, an external constraint, a `nolint` justification. Do not restate what the code does. Package comments: one line.

## Definition of done

1. The hooks of `lefthook.yml` pass on commit and on push; `make check` passes before a merge.
2. A test covers each acceptance criterion of the task.
3. Schema changes come as a new goose migration; applied migrations are never edited.
4. One vertical slice per commit.
5. A new operation in `api/openapi.yaml` has an entry in `internal/server/tool_exposure_test.go`.

## Commits

Conventional Commits 1.0: `<type>(<scope>): <summary>`, imperative, lowercase, no trailing period, summary at most 72 characters. Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`. Scope is the module, `platform`, `api`, `web` or `deps`. A breaking change uses `!` after the scope and a `BREAKING CHANGE:` footer. The body explains what changed and why, wrapped at 72 columns.

Commit policy for agents:

- Work on `main` in the main checkout. Create a branch or a worktree only when the owner asks for one.
- Commit a vertical slice as soon as its tests and the pre-commit hook pass. The commit needs no confirmation from the owner.
- Stage only the files the slice changed, by path. Never use `git add -A` or `git add .`: another session can hold changes in the same checkout.
- Never amend, rebase or reset a commit. A correction is a new commit.
- Never push.

Commits, pull requests, tags and release notes never mention AI tools or assistants: no `Co-Authored-By` trailers, no "generated with" footers, no tool names. `.claude/settings.json` sets empty attribution.

## web/

UI rules, the Slotted library instructions, the Slotted feedback protocol and the O1 to O8 rules are in `web/CLAUDE.md`. Before writing or changing UI, read that file.
