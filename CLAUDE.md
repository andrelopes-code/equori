# equori

Self-hosted personal finance manager. Go backend, PostgreSQL, single binary, single container. Frontend (`web/`) comes later and is embedded in the binary.

Decisions: `docs/adr/`. Read the relevant ADR before changing what it covers.

## Commands

| Command | Purpose |
|---|---|
| `make check` | Format check, tidy check, lint, test with `-race` (starts Postgres). Must pass before every commit. |
| `make db-up` / `make dev` | Start local Postgres on `127.0.0.1:54329`, run the app on `:8080` |
| `make gen` | Regenerate sqlc and oapi-codegen output after editing `db/queries`, `db/migrations` or `api/openapi.yaml` |
| `make vuln` | govulncheck |
| `make hooks` | Enable the pre-commit hook (`make check`) |

Tools are pinned in `tools/go.mod` and built into `bin/`. Do not install tools globally. Do not add custom lint scripts.

## Layout

```
cmd/equori/            composition root only: config, wiring, start
internal/platform/     infrastructure without business rules
internal/<module>/     one business module (see ADR 002): identity, ledger, marketdata, reporting
internal/server/       composition of every module: HTTP handler and outbox dispatcher
internal/apitest/      HTTP test harness over internal/server
db/migrations/         goose SQL migrations, embedded
db/queries/<module>/   sqlc queries, one directory per owner module
api/openapi.yaml       HTTP contract (source of truth for server and frontend types)
docs/adr/              decision records
```

Module internals: `<module>.go` (public API) → `internal/domain` → `internal/app` → `internal/adapter/{postgres,httpapi}`. Dependency rules are in ADR 002 and enforced by `depguard` and the compiler.

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
- Handlers get the user with `auth.MustUserID(ctx)` (`internal/platform/auth`) and pass it to `app` explicitly. Every `/api/` route is authenticated by `identity.RequireSession`; only login is exempt.
- `*.gen.go` files are generated; never edit them. A new module adds an entry to `sqlc.yaml`, `db/queries/<module>/`, a tag in `api/openapi.yaml` and `adapter/httpapi/oapi-codegen.yaml`.
- Every business table has `user_id`; every query on it filters by `user_id` (ADR 003).

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

## Comments

Write a comment only when it carries information the code cannot: a non-obvious reason, an invariant, an external constraint, a `nolint` justification. Do not restate what the code does. Package comments: one line.

## Definition of done

1. `make check` passes.
2. A test covers each acceptance criterion of the task.
3. Schema changes come as a new goose migration; applied migrations are never edited.
4. One vertical slice per commit.

## Commits

Conventional Commits 1.0: `<type>(<scope>): <summary>`, imperative, lowercase, no trailing period, summary at most 72 characters. Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`. Scope is the module, `platform`, `api` or `deps`. A breaking change uses `!` after the scope and a `BREAKING CHANGE:` footer. The body explains what changed and why, wrapped at 72 columns.

Commits, pull requests, tags and release notes never mention AI tools or assistants: no `Co-Authored-By` trailers, no "generated with" footers, no tool names. `.claude/settings.json` sets empty attribution.
