# equori

Self-hosted personal finance manager. Go backend, PostgreSQL, single binary, single container. The web interface (`web/`) is a single-page application embedded in the binary (ADR 008).

Decisions: `docs/adr/`. Read the relevant ADR before changing what it covers.

## Commands

| Command | Purpose |
|---|---|
| `make check` | Everything: format, tidy and generated-code checks, lint, `make web-check`, Go tests with `-race`. CI runs it on every pull request. |
| `make check-commit` | The pre-commit gate: the static checks, then at once the Go tests without `-race` (cached for unchanged packages) and, when the commit touches `web/` or `api/openapi.yaml`, the web checks. Must pass before every commit. |
| `make test` / `make test-race` | Go tests, without or with `-race`, on the test server `db-test` (`127.0.0.1:54339`, data in memory) |
| `make db-up` / `make dev` | Start local Postgres on `127.0.0.1:54329`, run the app on `:8080` |
| `make web-dev` | Vite dev server for `web/`, proxying `/api` to `make dev` |
| `make web-check` | Build `web/`, then typecheck, ESLint and Prettier check |
| `make gen` | Regenerate sqlc and oapi-codegen output after editing `db/queries`, `db/migrations` or `api/openapi.yaml`; also compiles the theme |
| `make vuln` | govulncheck |
| `make hooks` | Enable the pre-commit hook (`make check-commit`) |

Tools are pinned in `tools/go.mod` and built into `bin/`; `web/` tools are pinned in `web/package.json`, and pnpm runs from inside `web/` so Corepack selects its version. Do not install tools globally. Do not add custom lint scripts.

## Layout

```
cmd/equori/            composition root only: config, wiring, start
internal/platform/     infrastructure without business rules
internal/<module>/     one business module (see ADR 002): identity, ledger, marketdata, reporting, ingestion, classification
internal/server/       composition of every module: HTTP handler and outbox dispatcher
internal/apitest/      HTTP test harness over internal/server
db/migrations/         goose SQL migrations, embedded
db/queries/<module>/   sqlc queries, one directory per owner module
api/openapi.yaml       HTTP contract (source of truth for server and frontend types)
docs/adr/              decision records
web/                   single-page application (Vite, React, TypeScript), embedded by web/embed.go
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
- Language model calls go through `internal/platform/llm` (ADR 009); each module declares its chain in code.
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

1. `make check-commit` passes; `make check` passes before a merge.
2. A test covers each acceptance criterion of the task.
3. Schema changes come as a new goose migration; applied migrations are never edited.
4. One vertical slice per commit.

## Commits

Conventional Commits 1.0: `<type>(<scope>): <summary>`, imperative, lowercase, no trailing period, summary at most 72 characters. Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`. Scope is the module, `platform`, `api`, `web` or `deps`. A breaking change uses `!` after the scope and a `BREAKING CHANGE:` footer. The body explains what changed and why, wrapped at 72 columns.

Commits, pull requests, tags and release notes never mention AI tools or assistants: no `Co-Authored-By` trailers, no "generated with" footers, no tool names. `.claude/settings.json` sets empty attribution.

## Slotted UI (@slotted/react)

Before writing or changing UI, read `web/node_modules/@slotted/react/dist/docs/index.md`, then the file of each family you use. These files match the installed version: prefer them over prior knowledge of the library.

- Import components from `@slotted/react` or the family subpath that each file's Import section shows.
- Load `@slotted/react/styles.css` and `@slotted/themes/default.css` once, at the application entry.
- Set `data-slotted-theme="default"` on `<html>`. `data-slotted-scheme` (`light`, `dark`, `high-contrast`) and `data-slotted-density` (`comfortable`, `compact`, `dense`) apply to any element and its descendants.
- Change a family's appearance through its props (`size`, `variant`, `tone` where it has them), not with CSS that targets its parts.
- Application CSS uses `var(--slotted-*)` tokens for color, spacing and radius, inside a layer declared after the library's: `@layer slotted, app;`.
- To render a family as another element, such as a router link or a trigger, pass `render`.
- In CSS and tests, select a family by `[data-ui="<family>"]` and its parts by `[data-part="<part>"]`.

#### Tasks

Read the skill before the task:

- Compose or change a screen — a list, a record, a form, an overview: `web/node_modules/@slotted/react/dist/docs/skills/compose-screen/SKILL.md`
- Show what a screen draws while it waits, and its empty and error states: `web/node_modules/@slotted/react/dist/docs/skills/waiting-states/SKILL.md`
- Review a screen against the guidelines, or fix what a review found: `web/node_modules/@slotted/react/dist/docs/skills/review-screen/SKILL.md`
- Write a component or element that no family draws: `web/node_modules/@slotted/react/dist/docs/skills/build-own-element/SKILL.md`
- Change the brand colour, the scheme, the density or a control's shape: `web/node_modules/@slotted/react/dist/docs/skills/theme-app/SKILL.md`

#### Slotted feedback (mandatory)

Slotted is the owner's own library, in beta, and equori is its only consumer: the app is the test bed that calibrates it. The owner fixes the library in its own repository. A defect worked around here and not reported is a defect that stays in Slotted.

A Slotted finding is a bug to fix, an improvement to something that exists, or a feature the library should offer, in any area the library covers:

| Area | Covers |
|---|---|
| `family` | a component family or one of its parts: rendering, behaviour, state, focus, keyboard, resize, performance (a slow test caused by the family counts), a missing prop, variant, slot or state |
| `token` | a theme value the app needed and the theme does not hold, or a token that resolves wrong in a scheme |
| `utility` | a hook or helper the package exports (`useField`, formatting, date, chart engine helpers) |
| `docs` | a family file under `dist/docs/` that is missing, wrong or misleading |
| `guideline` | a rule under `dist/docs/guidelines/` that is wrong, missing, contradictory or produces a poor result when followed |
| `agent` | the package's instructions for agents (`dist/docs/AGENTS.snippet.md`, `dist/docs/index.md`, `dist/docs/skills/*/SKILL.md`): a missing or unclear instruction that led an agent, here or in a subagent, to a wrong component, a wrong pattern or a wasted pass |

An own element built because no family answered is a finding: the build-own-element comment names what the family lacks.

The source does not matter: a problem found during the work and a problem the owner points out are both findings once the diagnosis places its cause, in whole or in part, in one of the areas above. Diagnose first; a problem whose cause is in equori's own implementation is fixed in `web/` and is not a finding. Every finding gets its own report and its own prompt; findings are never merged into one vague prompt.

Rules:

1. Every finding is reported to the owner in the reply of the task that met it, in a section titled `Slotted findings`, numbered from 1 within the reply. No finding is dropped because the app works around it.
2. Each finding follows the template below exactly: same fields, same order, no field omitted (write "none" when a field has nothing). The prose is written in the conversation's language; the prompt is always in English.
3. The prompt stands alone, for a session that knows nothing of equori. For a `bug` it states the observed behaviour, the expected behaviour and a minimal reproduction; for an `improvement` or a `feature` it states the need met in equori, the proposed API (props, parts, states, tokens, rule text or instruction text) and how it composes with what exists; for `guideline` and `agent` areas it quotes the current text (file and section) and gives the replacement or addition. Every prompt ends with an `Acceptance:` line and asks for a test or check that fails before the change.
4. A workaround in `web/` carries a comment naming the finding by its title, so it can be removed when the library ships the fix.
5. When a new Slotted version is installed, check the findings of earlier tasks against it and remove each workaround the version makes unnecessary.

Template (one block per finding):

````markdown
### N. <short title: what is wrong or missing>
- **Kind:** bug | improvement | feature
- **Area:** family | token | utility | docs | guideline | agent — <family and part, token name, export, or file and section>
- **Problem:** <one or two sentences: the observed behaviour or the gap>
- **Evidence:** <screen and width, browser measurement, test name and timing, file and line in web/, or the agent step that went wrong>
- **Impact on equori:** <what the user sees or what the work cost>
- **Workaround:** <file in web/ and what it does, or "none">

```
<Kind> — <area and subject>.
<Observed/expected/repro, or need/proposed API/composition, or current text/replacement.>
Acceptance: <the test or check that fails before the change and passes after>.
```
````

## web/

File names under `web/src` are kebab-case (O1). This is the only exception to the snake_case rule of Naming.

The application sets `data-slotted-theme="equori"` and loads `@/theme/equori.gen.css` in place of the `default` theme and `@slotted/themes/default.css` of the Slotted section.

| ID | Rule | Gate |
|---|---|---|
| O1 | One component per file; the file is named after the component in kebab-case. | ESLint `react/no-multi-comp` |
| O2 | A feature imports another feature only through its `index.ts`. | ESLint `no-restricted-imports` |
| O3 | `@/api/client` is imported only by `features/*/api.ts`, `features/session/**`, `app/providers.tsx`, `src/api/**` and `src/testing/**`. | ESLint override by glob |
| O4 | `features/*` never imports `@/app/*`. | ESLint |
| O5 | App CSS lives in co-located `*.module.css` inside `@layer app`, reads only `var(--slotted-*)` and never targets `[data-ui]` or `[data-part]`. | review, theme-app "Done" rule |
| O6 | JSX contains no user-visible literal text; text comes from `useT()`. | `react/jsx-no-literals` |
| O7 | Money travels as an integer plus an instrument code. Integer-text conversion is string manipulation with the instrument scale, never floating-point division. | Money type, tests of `format.ts` |
| O8 | `*.gen.*` files are never edited by hand. | existing convention |
