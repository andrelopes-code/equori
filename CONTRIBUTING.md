# Contributing to equori

equori is a self-hosted personal finance manager: a Go backend on PostgreSQL, shipped as one binary that embeds the web interface (`web/`, ADR 028).

Decisions live in `docs/adr/`. Read the ADR that covers an area before changing it.

## Setup

Requirements: Go (version in `go.mod`), Docker with Compose, Node.js (version in `web/.node-version`) with Corepack enabled.

```sh
make hooks     # install the git hooks of lefthook.yml (ADR 015)
make run-dev   # PostgreSQL, the API on :8080 and the Vite dev server
```

Tools are pinned in `tools/go.mod` and built into `bin/`; `web/` tools are pinned in `web/package.json`. pnpm runs from inside `web/`, so Corepack selects its version. Do not install tools globally and do not add custom lint scripts.

## Commands

| Command | Purpose |
|---|---|
| `make check` | Everything: format, tidy and generated-code checks, lint, `make web-check`, Go tests with `-race`. CI runs it on every pull request. |
| `make test` / `make test-race` | Go tests, without or with `-race`, on the test server `db-test` (`127.0.0.1:54339`, data in memory) |
| `make db-up` / `make dev` | Start local PostgreSQL on `127.0.0.1:54329`, run the app on `:8080`; reads `dev.env`, then `~/.config/equori/local.env` (`LOCAL_ENV`) when present, then `.env` |
| `make web-dev` | Vite dev server for `web/`, proxying `/api` to `make dev` |
| `make run-dev` | `make dev` and `make web-dev` together |
| `make run-prod` | Production build served by the binary on `:8091` (`PROD_ADDR`), beside `make run-dev` |
| `make web-check` | Build `web/`, then typecheck, ESLint and Prettier check |
| `make gen` | Regenerate sqlc and oapi-codegen output after editing `db/queries`, `db/migrations` or `api/openapi.yaml`; also compiles the theme |
| `make vuln` | govulncheck |
| `make dist` | Release archives and `SHA256SUMS` in `dist/` (ADR 022) |
| `make upgrade-test` | A database seeded by one image keeps every fact under another (ADR 022, R7) |
| `make test-cluster` | Managed-mode tests (build tag `cluster`) inside `postgres:18`; `make check` runs it |
| `make standalone-smoke` | Builds and checks the standalone image |
| `make demo` / `make demo-reset` | Create or delete the demo user of the local instance (`make dev` running) |

A commit runs format, lint and the generated-code check on its staged files. A push runs lint, typecheck and the Go and web tests related to the files it sends.

## Layout

```
cmd/equori/            composition root only: config, wiring, start
cmd/demoseed/          demo data for a local instance
internal/platform/     infrastructure without business rules
internal/<module>/     one business module (ADR 002)
internal/server/       composition of every module: HTTP handler and outbox dispatcher
internal/apitest/      HTTP test harness over internal/server
db/migrations/         goose SQL migrations, embedded
db/queries/<module>/   sqlc queries, one directory per owner module
api/openapi.yaml       HTTP contract, source of truth for server and frontend types
web/                   single-page application (Vite, React, TypeScript), embedded by web/embed.go
packaging/, scripts/   release packaging (Homebrew, Windows) and release scripts
docs/adr/              decision records
docs/domain/           vision, language, flows, model, scenarios, roadmap
docs/specs/            design specifications cited by ADRs and code
docs/plans/            implementation plans whose rule IDs other documents cite
docs/operations/       runbooks for operators
docs/contributing/     contributor guides: regions, forms, phone screens, web rules
```

Module internals: `<module>.go` (public API) → `internal/domain` → `internal/app` → `internal/adapter/{postgres,httpapi,toolapi}`. ADR 002 sets the dependency rules; `depguard` and the compiler enforce them.

## Language

Everything is in English: identifiers, files, packages, comments, log messages, errors, tests, docs, commit messages.

## Naming

- Packages: short, lowercase, singular, no underscores (`ledger`, `httpapi`). Forbidden: `util`, `utils`, `common`, `helpers`, `misc`, `base`, `types`.
- No stutter: `ledger.Service`, not `ledger.LedgerService`.
- Initialisms keep one case: `ID`, `URL`, `HTTP`, `userID`, `ParseURL`.
- Files: lowercase snake_case, named after the concept they hold (`account.go`, `account_test.go`). One concept per file. Files under `web/src` are kebab-case (`docs/contributing/web.md`, O1).
- Domain names follow finance vocabulary: `Account`, `Transaction`, `Posting`, `Category`, `Budget`, `Money`. One term per concept across code, SQL and API.
- Tables are prefixed by owner module: `ledger_account`, `budget_envelope`.
- Interfaces are declared by the consumer (`app` declares its ports) and named by behavior (`AccountRepository`, `Clock`).
- Errors wrap with `fmt.Errorf("verb object: %w", err)`; sentinels are named `ErrXxx` in the package that returns them.

## Code

- Standard library first. A new dependency needs an ADR.
- Cross-cutting conventions (transactions, money, dates, pagination) are in ADR 005: `platform/money`, `platform/clock`, `platform/page`. Never `float64` for amounts.
- `context.Context` is the first parameter of any function doing I/O.
- No global mutable state. Dependencies are passed through constructors.
- HTTP errors are RFC 9457 problems written with `internal/platform/problem` (ADR 004).
- Language model calls go through `internal/platform/llm` (ADR 009); each module declares its chain in code.
- Tools for language models are declared in `adapter/toolapi` and composed in `internal/server` (ADR 012).
- Handlers get the user with `auth.MustUserID(ctx)` (`internal/platform/auth`) and pass it to `app` explicitly. `identity.RequireSession` authenticates every `/api/` route except login.
- `*.gen.go` and `*.gen.ts` files are generated; never edit them. A new module adds an entry to `sqlc.yaml`, `db/queries/<module>/`, a tag in `api/openapi.yaml` and `adapter/httpapi/oapi-codegen.yaml`.
- Every business table has `user_id`; every query on it filters by `user_id` (ADR 003).
- Web code follows `docs/contributing/web.md`.

## Regions

equori serves users of any country. `docs/contributing/regions.md` lists the extension points.

- No regional value (currency, calendar, exchange, aggregator, identifier scheme, tax rule, word, number or date format) is a literal or a default outside the implementation of its region.
- Behavior that differs by country or language is an extension point under ADR 016. A value chosen by region is a case of a `switch` in `<module>/region_defaults.go`; a region without a case gets the neutral value.
- A value set that grows with regions is `^[a-z0-9_]{2,40}$` in SQL and a `pattern` in `api/openapi.yaml`, never a closed `IN` or `enum`.
- A new extension point adds its row to `docs/contributing/regions.md` in the same change.
- A spec or plan names each region-dependent value it introduces and the extension point that serves it.

## Tests

- A behavior change starts with a test that fails without it. A bug fix starts with a test that reproduces the bug.
- A test is never deleted, skipped or loosened to make a change pass. A test changes only when the specified behavior changes; the commit body names the spec section or amendment.
- Each acceptance scenario of `docs/domain/06-scenarios.md` in a delivered phase has a test through the HTTP API (`internal/apitest`) whose name or comment carries the scenario ID (`S24`).
- Each database invariant has a schema test that violates it with direct SQL and expects the rejection.
- Each `Problem.code` returned by a module has a test that triggers it through the HTTP API.
- Tests sit next to the code and are table-driven. Postgres adapters are tested against a real database from `pgtest.New(t)`, not mocks.
- Assert exact values. Check the status before decoding a body.
- Tests are deterministic: a fixed date through `apitest.Today`, no sleeps, no wall clock, no dependence on map order.
- Assert observable outcomes (HTTP responses, rows, published events), not internal calls.
- Tests with the build tag `eval` or `live` call a paid or quota-limited provider API and need the owner's key. CI does not run them.

## Comments

A comment carries information the code cannot: a non-obvious reason, an invariant, an external constraint, a `nolint` justification. Package comments are one line.

## Pull requests

1. The hooks of `lefthook.yml` pass on commit and on push; `make check` passes before a merge.
2. A test covers each acceptance criterion of the change.
3. A schema change comes as a new goose migration; applied migrations are never edited.
4. One vertical slice per commit.
5. A new operation in `api/openapi.yaml` has an entry in `internal/server/tool_exposure_test.go`.

## Commits

Conventional Commits 1.0: `<type>(<scope>): <summary>`, imperative, lowercase, no trailing period, summary at most 72 characters. Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`. Scope is the module, `platform`, `api`, `web` or `deps`. A breaking change uses `!` after the scope and a `BREAKING CHANGE:` footer. The body explains what changed and why, wrapped at 72 columns.

## Security

Report vulnerabilities privately as described in `SECURITY.md`, never in a public issue.
