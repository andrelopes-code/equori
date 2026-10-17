# Web Foundation and Ledger Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the web application foundation (theme, shell, routing, data, errors, i18n) and the Ledger screens (login, home, transactions, accounts, settings), usable on a phone, a tablet and a desktop.

**Architecture:** Two backend adjustments come first: B1 adds text search to `GET /transactions`, B2 adds `GET /balances`. The SPA then grows in layers: dependencies and gates, theme, i18n and money formatting, problem parsing and the query client, router and shell, session, and one task per screen. Features under `web/src/features/*` own their API calls (`api.ts`) and expose a public surface (`index.ts`); `web/src/app/` composes them.

**Tech Stack:** Go 1.27, sqlc, oapi-codegen; React 19.3.1, TypeScript 5.9.3, Vite 8.3.4, Vitest 5.0.5; `@slotted/react`, `@slotted/core`, `@slotted/theme`, `@slotted/themes` `0.1.0-beta.2`; `echarts` 6.1.0 (peer of `@slotted/core` for the `chart` family); `@tanstack/react-router` 1.170.41; `@tanstack/react-query` 5.104.1; `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/user-event` 14.6.7, `@testing-library/jest-dom` 7.0.1, `jsdom` 30.1.1; `eslint-plugin-react` 7.37.5, `eslint-plugin-react-hooks` 7.1.1.

**Spec:** `docs/superpowers/specs/2026-10-17-web-foundation-ledger-design.md` (R1–R5, K1–K7, O1–O8, sections 1–5).

## Global Constraints

- Every npm dependency is pinned exactly (no `^`, no `~`); `web/pnpm-lock.yaml` is committed. Versions are the ones in Tech Stack: each was published at least 14 days before 2026-10-17.
- Slotted packages are pinned to `0.1.0-beta.2` (K1). The `beta` dist-tag points at `beta.0`; never install by tag.
- Before writing a screen, the implementer reads `web/node_modules/@slotted/react/dist/docs/index.md`, the package skill `compose-screen`, the skill `waiting-states`, and the page `dist/docs/<family>.md` of every family used. The family pages are the API reference; this plan names families and import paths only.
- Every Slotted component is imported from `@slotted/react` (the Import section of each family page uses the root entry). `SlottedProvider` comes from `@slotted/react/i18n`, `ThemeScope` from `@slotted/react/theme`, `PT_BR` from `@slotted/core/i18n/pt-BR`, `extendTheme` and `flattenTheme` from `@slotted/theme`, the default theme from `@slotted/themes/default`, `themeConformance` from `@slotted/theme/conformance`.
- O1: one component per file, file named after the component in kebab-case (`bottom-bar.tsx` holds `BottomBar`). This is the `web/src` exception to the snake_case file rule of `CLAUDE.md`; Task 3 records it.
- O5: app CSS lives in co-located `*.module.css` files inside `@layer app`, reads only `var(--slotted-*)`, and never selects `[data-ui]` or `[data-part]`.
- O6: JSX contains no user-visible literal; every string comes from `useT()` and a key of `web/src/i18n/catalog.en.ts`.
- O7: money is `{ amount: number; currency: string }` as the API returns it (integer units of the instrument scale). Integer↔text conversion is string manipulation in `web/src/i18n/format.ts`; no division by a power of ten anywhere.
- Imports inside `web/src` use the `@/` alias (ADR 008, W13).
- API calls in tests go through the `fetchImpl` parameter of `newClient` (K5). No MSW, no `vi.mock` of internal modules.
- Every request path is relative to `/api/v1` and typed by `web/src/api/schema.gen.ts`.
- Storage access (`localStorage`, `sessionStorage`) is wrapped in `try`/`catch`; a throwing storage falls back to defaults.
- Commits follow `CLAUDE.md`, Commits; scope `ledger` for B1 and B2, `web` otherwise. No AI attribution.
- Run `make check` before each commit. The pre-commit hook runs it; redirect its output: `git commit ... >/dev/null 2>&1; echo $?`, and on failure run `make check 2>&1 | tail -40`.
- Execution runs in slices of at most three tasks; each slice ends by writing `.claude/progress/current.md` (user `CLAUDE.md`, Execution slice protocol).

## Review Focus

1. A search text containing `%` or `_` matches those characters literally, not as wildcards. Test: Task 1, row `percent is literal`.
2. Amount text typed with the locale's separators (`1.234,56` in pt-BR, `1,234.56` in en) converts to `123456`; text with more fraction digits than the scale is rejected, not rounded. Test: Task 6, `parseAmount` rows `grouped pt-BR`, `grouped en`, `excess digits`.
3. A URL with an invalid filter value (`?account_id=x&from=2026-13-40`) opens the list with that filter dropped, not an error page. Test: Task 11, `drops invalid search params`.
4. A balance in an instrument other than the base currency is listed but excluded from its group's base-currency total. Test: Task 10, `excludes foreign balances from totals`.
5. A browser whose `sessionStorage` throws (private mode, blocked site data) still opens and saves the new-transaction form. Test: Task 12, `works when sessionStorage throws`.

## Spec ambiguities resolved

| Topic | Resolution |
|---|---|
| B2 balance scope | Each item is the balance of the account's own postings, in the account's instrument. Sub-account sums are left to the client: a tree may mix instruments (`ErrMixedInstruments`). |
| Base-currency totals on Home | A group total sums items whose currency equals `settings.base_currency`; other items are listed with their own amount and counted in a "not in total" note. Valuation of foreign balances belongs to sub-project 5. |
| Home groups | available = `checking, savings, cash, wallet, benefit`; reserves = `reserve, brokerage, receivable`; cards = `credit_card`; loans = `loan, payable`. |
| "N uncategorized" | No count endpoint exists. Home reads `GET /transactions?uncategorized=true&limit=200` and shows the item count, or "200+" when `next_cursor` is present. |
| Theme compile output | `slotted-build-theme` writes `<name>.css`, `<name>.js`, `<name>.d.ts` to a directory. `make gen` builds into a temporary directory and copies `equori.css` to `web/src/theme/equori.gen.css`. |
| Theme conformance runner | `themeConformance` registers cases with `node:test`, so `equori.theme.test.ts` runs under `node --test` (Node 24 strips types), not Vitest. `pnpm test` runs both. |
| Instrument scale | `GET /instruments` returns `scale` per code; the client caches it with `staleTime: Infinity`. |
| `currency-field` value | The family's `value` is major units (`number`). The form stores the integer from `onValueChange`'s `request.minorUnits`; the displayed `value` is `Number(formatPlain(minor, scale))`, a parse of a decimal string. |
| Manifest file name | `manifest.json`, not `.webmanifest`: Go's `mime` table has no `.webmanifest` entry, `.json` is served as `application/json`. |
| `eslint-plugin-react` peer range | 7.37.5 declares `eslint ^9.7`; the repo runs ESLint 10.12.0. pnpm `peerDependencyRules.allowedVersions` admits it. A runtime crash of `react/jsx-no-literals` stops Task 4 as a blocker (no custom lint scripts). |

## File Structure

```
internal/ledger/internal/adapter/httpapi/server.go     ListTransactions (q), ListBalances
internal/ledger/internal/app/{ports.go,service.go,balances.go}
internal/ledger/internal/adapter/postgres/repository.go
db/queries/ledger/{transaction.sql,balance.sql}
internal/ledger/{transaction_search_test.go,balances_test.go}
api/openapi.yaml
web/
  index.html, public/{manifest.json,icon.svg}
  vite.config.ts, eslint.config.js, package.json, .prettierignore, pnpm-workspace.yaml
  src/main.tsx
  src/app/{router.tsx,providers.tsx,app.css}
  src/app/shell/{app-frame.tsx,side-nav.tsx,more-sheet.tsx,app-frame.test.tsx}
  src/api/{client.ts,schema.gen.ts,problem.ts,problem.test.ts,query-client.ts,query-client.test.ts,api-context.tsx}
  src/theme/{equori.theme.ts,equori.gen.css,equori.theme.test.ts,scheme.ts}
  src/i18n/{catalog.en.ts,catalog.pt-BR.ts,format.ts,format.test.ts,i18n-provider.tsx,locale.ts}
  src/ui/{bottom-bar.tsx,bottom-bar.module.css,money-text.tsx,use-viewport.ts}
  src/testing/{setup.ts,viewport.ts,fake-api.ts,render-app.tsx}
  src/features/session/   login-page, use-logout, api.ts, index.ts
  src/features/setup/     settings-page, instruments (useScale), api.ts, index.ts
  src/features/accounts/  home-page, accounts-page, account-page, balance-chart, api.ts, index.ts
  src/features/transactions/ transaction-list, transactions-page, filter-drawer, new-transaction-page,
                          transaction-form-reducer, split-editor, postings-editor, transaction-page,
                          correct-transaction-page, void-dialog, categorize-dialog, version-history,
                          row-amount, search.ts, api.ts, index.ts
```

---

### Task 1: B1, text search on `GET /transactions`

**Files:**
- Modify: `api/openapi.yaml` (`/transactions` `get` parameters)
- Modify: `db/queries/ledger/transaction.sql` (`ListTransactions`)
- Modify: `internal/ledger/internal/app/ports.go` (`TransactionQuery`)
- Modify: `internal/ledger/internal/adapter/postgres/repository.go` (`ListTransactions`, line 581)
- Modify: `internal/ledger/internal/adapter/httpapi/server.go` (`ListTransactions`, line 223)
- Test: `internal/ledger/transaction_search_test.go`

**Interfaces:**
- Produces: query parameter `q` (string, `minLength: 1`, `maxLength: 100`); generated `ListTransactionsParams.Q *string` and TS `paths["/transactions"]["get"]["parameters"]["query"]["q"]`; `app.TransactionQuery.Q string` (empty = no filter).

- [ ] **Step 1: Write the failing test `TestListTransactionsSearch`** (package `ledger_test`, `apitest.New(t)`)

Setup: account `checking` (asset/checking), `food` (expense); payee `Padaria Real` via `POST /api/v1/payees`; four transactions through `POST /api/v1/transactions`:
`A` description `Mercado Central`; `B` description `x`, `payee_id` of Padaria Real; `C` description `y`, posting memo `pão de queijo` on the `food` posting; `D` description `50% off`.

| Row | Query | Expected IDs (date desc) |
|---|---|---|
| description, case-insensitive | `q=mercado` | `A` |
| payee name | `q=PADARIA` | `B` |
| posting memo | `q=queijo` | `C` |
| percent is literal | `q=%25` | `D` |
| underscore is literal | `q=_` | none |
| combined with account filter | `q=mercado&account_id=<food>` | `A` |
| other user | second user logs in, `q=mercado` | none |
| empty q | `q=` | 400, `h.ExpectProblem(r, 400, "invalid_request", "q")` |

Assert the status before decoding.

- [ ] **Step 2: Run it**

Run: `make db-up && go test ./internal/ledger/ -run TestListTransactionsSearch -count=1`
Expected: FAIL (unknown parameter `q` is ignored, rows return every transaction).

- [ ] **Step 3: Contract and query**

Add parameter `q` under `/transactions` `get` with description `Case-insensitive substring of description, payee name or posting memo.`. In `ListTransactions` SQL add, before the cursor condition:

```sql
  AND (sqlc.narg(q)::text IS NULL OR
       strpos(lower(t.description), lower(sqlc.narg(q)::text)) > 0 OR
       EXISTS (SELECT 1 FROM ledger_payee y WHERE y.user_id = @user_id AND y.id = t.payee_id
               AND strpos(lower(y.name), lower(sqlc.narg(q)::text)) > 0) OR
       EXISTS (SELECT 1 FROM ledger_posting p WHERE p.transaction_id = t.id
               AND strpos(lower(coalesce(p.memo, '')), lower(sqlc.narg(q)::text)) > 0))
```

`strpos` keeps `%` and `_` literal. Run `make gen`.

- [ ] **Step 4: Wire `Q`** through `TransactionQuery`, the repository params (`pgtype.Text`, valid when `Q != ""`) and the handler (`optString(req.Params.Q)`).

- [ ] **Step 5: Run the test, then `make check`**

Run: `go test ./internal/ledger/ -run TestListTransactionsSearch -count=1` → PASS; `make check` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add api/openapi.yaml db/queries/ledger/transaction.sql internal/ledger web/src/api/schema.gen.ts
git commit -m "feat(ledger): search transactions by description, payee and memo"
```

### Task 2: B2, `GET /balances`

**Files:**
- Modify: `api/openapi.yaml` (new path `/balances`, schema `BalanceList`)
- Modify: `db/queries/ledger/balance.sql` (new `AccountBalancesBookedAt`, `AccountBalancesSettledAt`)
- Modify: `internal/ledger/internal/app/ports.go`, `internal/ledger/internal/app/balances.go`
- Modify: `internal/ledger/internal/adapter/postgres/repository.go` (beside `BalanceAt`, line 651)
- Modify: `internal/ledger/internal/adapter/httpapi/server.go`
- Test: `internal/ledger/balances_test.go`

**Interfaces:**
- Produces: `GET /balances?date=YYYY-MM-DD&basis=booked|settled` (`date` required, `basis` optional, default `booked`), tag `ledger`, `operationId: listBalances`, 200 body `BalanceList { items: Balance[] }` ordered by account name then id; 400 and 401 problems.
- Produces: `app.AccountTotal{AccountID uuid.UUID; Instrument money.Currency; Total int64}`; repository port `BalancesAt(ctx context.Context, userID int64, date time.Time, basis Basis) ([]AccountTotal, error)`; `func (s *Service) BalancesAt(ctx context.Context, userID int64, date time.Time, basis Basis) ([]Balance, error)`.

- [ ] **Step 1: Write the failing test `TestListBalances`**

Setup: `checking` (asset/checking), `savings` (asset/savings), `card` via `h.Card("Visa", 5, 12, <assignment>)` with the assignment value used in `internal/ledger/card_scenarios_test.go`, `food` (expense). Record `2026-10-10`: checking −12000 / food +12000. Record `2026-10-11`: savings +50000 with `settled_on: "2026-10-20"` / checking −50000.

| Row | Request | Expected items (account → amount BRL) |
|---|---|---|
| booked | `GET /api/v1/balances?date=2026-10-15` | checking −62000, savings 50000, card 0, each `basis: "booked"`, `date: "2026-10-15"` |
| settled | `...&basis=settled` | savings 0 (settles 2026-10-20), checking −62000 |
| before any posting | `?date=2026-10-01` | every balance-sheet account with 0 |
| expense excluded | any | no item for `food` |
| other user | second user | `items` empty |
| missing date | `GET /api/v1/balances` | `h.ExpectProblem(r, 400, "invalid_request", "date")` |

- [ ] **Step 2: Run it**

Run: `go test ./internal/ledger/ -run TestListBalances -count=1`
Expected: FAIL with status 404 `not_found`.

- [ ] **Step 3: Queries**

`AccountBalancesBookedAt :many` selects `a.id, a.instrument, coalesce(sum(p.amount), 0)::bigint AS total` from `ledger_account a LEFT JOIN ledger_posting p ON p.account_id = a.id AND NOT p.voided AND p.booked_on <= @on_date`, `WHERE a.user_id = @user_id AND a.account_class IN ('asset', 'liability')`, `GROUP BY a.id ORDER BY a.name, a.id`. The settled variant uses `coalesce(p.settled_on, p.booked_on) <= @on_date`. Add the path and schema to `api/openapi.yaml`, then `make gen`.

- [ ] **Step 4: App, adapter, handler**

`Service.BalancesAt` validates `basis` exactly as `BalanceAt` does (422 `validation_failed`, field `basis`), then converts each total with `s.AmountOf(ctx, total, instrument)`. Handler `ListBalances` mirrors `GetAccountBalance` without `value_in`.

- [ ] **Step 5: Run the test, then `make check`** → PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add api/openapi.yaml db/queries/ledger/balance.sql internal/ledger web/src/api/schema.gen.ts
git commit -m "feat(ledger): list balances of every balance-sheet account"
```

### Task 3: Dependencies, test environment, ADR 010, CLAUDE.md

**Files:**
- Modify: `web/package.json`, `web/pnpm-lock.yaml`, `web/vite.config.ts`, `web/src/main.tsx`
- Create: `web/pnpm-workspace.yaml` (only if pnpm 12.14.0 reads `peerDependencyRules` there; otherwise the `pnpm` key of `package.json`)
- Create: `web/src/testing/setup.ts`, `web/src/testing/viewport.ts`, `web/src/testing/viewport.test.ts`
- Create: `docs/adr/010-web-ui-stack.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces: `setViewport(width: number): void` in `@/testing/viewport` — sets `window.innerWidth`, installs `window.matchMedia` that evaluates `(min-width: Npx)` and `(max-width: Npx)` against `width`, and fires `change` on every listener whose result changed. `setup.ts` calls `setViewport(1280)` before each test and registers `@testing-library/jest-dom/vitest` and `cleanup`.

- [ ] **Step 1: Install** from `web/`: `pnpm add -E @slotted/react@0.1.0-beta.2 @slotted/core@0.1.0-beta.2 @slotted/theme@0.1.0-beta.2 @slotted/themes@0.1.0-beta.2 echarts@6.1.0 @tanstack/react-router@1.170.41 @tanstack/react-query@5.104.1` and `pnpm add -E -D @testing-library/react@16.3.3 @testing-library/dom@10.4.2 @testing-library/user-event@14.6.7 @testing-library/jest-dom@7.0.1 jsdom@30.1.1 eslint-plugin-react@7.37.5 eslint-plugin-react-hooks@7.1.1`. Add `peerDependencyRules.allowedVersions: { "eslint-plugin-react>eslint": "10" }`. Re-run `pnpm install`: no unmet-peer warning.

- [ ] **Step 2: Write the failing test `viewport.test.ts`**: after `setViewport(360)`, `matchMedia("(min-width: 600px)").matches === false`; after `setViewport(768)` the same query is `true` and a listener added before the call received one `change` event.

- [ ] **Step 3: Vitest config** in `vite.config.ts`: `test: { environment: "jsdom", setupFiles: ["src/testing/setup.ts"], exclude: [...configDefaults.exclude, "src/theme/equori.theme.test.ts"] }`. Implement `viewport.ts`. Run `cd web && pnpm test` → PASS.

- [ ] **Step 4: ADR 010** (`docs/adr/010-web-ui-stack.md`, format of ADR 008): Context (sub-project 1 needs components, routing, server state, tests). Decision table K1–K6 from the spec verbatim, plus a dependency table with every package and exact version of this task, and the `eslint-plugin-react` peer override with its reason. Consequences: Slotted is beta, its API changes between betas without deprecation; an upgrade is a decision recorded as an amendment.

- [ ] **Step 5: CLAUDE.md.** Append section `## Slotted UI` containing `web/node_modules/@slotted/react/dist/docs/AGENTS.snippet.md` verbatim except every `node_modules/@slotted/react/dist/docs` becomes `web/node_modules/@slotted/react/dist/docs` (the `{{docsDir}}` resolution of R3), its `###` headings demoted one level. Append section `## web/` listing O1–O8 from the spec as a table (rule, gate), and stating that file names under `web/src` are kebab-case (O1). Add `make gen` to the Commands row text: "also compiles the theme".

- [ ] **Step 6: Verify and commit**

Run: `make web-check` → exit 0; `make check` → exit 0.

```bash
git add web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml web/vite.config.ts web/src/testing docs/adr/010-web-ui-stack.md CLAUDE.md
git commit -m "build(web): pin the ui stack and record adr 010"
```

### Task 4: ESLint gates O2, O3, O4, O6 and hooks

**Files:**
- Modify: `web/eslint.config.js`
- Test: `web/src/testing/lint-rules.test.ts`

- [ ] **Step 1: Write the failing test `lint-rules.test.ts`.** It builds `new ESLint({ cwd: <web dir> })` and calls `lintText(code, { filePath })` for each row, asserting the rule id of the first message:

| Row | `filePath` | Code | Rule |
|---|---|---|---|
| O2 deep import | `src/features/accounts/x.ts` | `import { a } from "@/features/transactions/api";` | `no-restricted-imports` |
| O2 index import ok | `src/features/accounts/x.ts` | `import { a } from "@/features/transactions";` | none |
| O3 client in screen | `src/features/accounts/home-page.tsx` | `import { newClient } from "@/api/client";` | `no-restricted-imports` |
| O3 client in api.ts | `src/features/accounts/api.ts` | same import | none |
| O4 app from feature | `src/features/accounts/x.ts` | `import { router } from "@/app/router";` | `no-restricted-imports` |
| O6 literal | `src/ui/x.tsx` | `export const X = () => <p>Hello</p>;` | `react/jsx-no-literals` |
| hooks | `src/ui/y.tsx` | hook called inside `if` | `react-hooks/rules-of-hooks` |

Type-aware rules need files in the project: lint with `filePath` under `src/` and rely on `projectService.allowDefaultProject` only if `lintText` reports a project error; otherwise keep defaults.

- [ ] **Step 2: Run** `cd web && pnpm vitest run src/testing/lint-rules.test.ts` → FAIL on the O2–O6 rows.

- [ ] **Step 3: Configure.** `no-restricted-imports` keeps the relative-import pattern of W13 and adds: `group`-style regex `^@/features/[^/]+/.+` (O2), path `@/api/client` (O3), regex `^@/app/` for `src/features/**` (O4). Flat-config rule options replace, not merge: each override block for a glob restates the full option list for that glob. Allowed globs for `@/api/client`: `src/features/*/api.ts`, `src/features/session/**`, `src/app/providers.tsx`, `src/api/**`, `src/testing/**`. `react/jsx-no-literals` with `{ noStrings: true, ignoreProps: true }` on `src/**/*.tsx`, excluding `*.test.tsx`. `react-hooks` recommended config. Register `settings.react.version: "19.3"`. `src/theme/equori.theme.test.ts` may import `./equori.theme.ts` (Node runs it without the alias): one override disables the relative-import pattern for that file only, with a comment stating why.

- [ ] **Step 4: Run** the test → PASS; `make web-check` → exit 0.

- [ ] **Step 5: Commit** `git commit -m "build(web): enforce feature boundaries and translated text in lint"` (files: `web/eslint.config.js`, `web/src/testing/lint-rules.test.ts`).

### Task 5: equori theme, scheme and density

**Files:**
- Create: `web/src/theme/equori.theme.ts`, `web/src/theme/equori.gen.css` (generated), `web/src/theme/equori.theme.test.ts`, `web/src/theme/scheme.ts`, `web/src/theme/scheme.test.ts`, `web/src/app/app.css`
- Modify: `Makefile` (`gen`, `gen-check`), `web/.prettierignore`, `web/package.json` (`test` script), `web/tsconfig.json` (`allowImportingTsExtensions: true`), `web/index.html`, `web/src/main.tsx`

**Interfaces:**
- Produces: `type Scheme = "dark" | "light" | "system"`; `readScheme(): Scheme` (localStorage key `equori.scheme`, default `"dark"`); `applyScheme(s: Scheme): void` (writes storage, sets `data-slotted-scheme` on `document.documentElement`; `system` resolves through `matchMedia("(prefers-color-scheme: dark)")`); `useScheme(): [Scheme, (s: Scheme) => void]`.

- [ ] **Step 1: Read** `web/node_modules/@slotted/react/dist/docs/skills/theme-app/SKILL.md` and `dist/docs/tokens.md`.

- [ ] **Step 2: Write the failing tests.** `equori.theme.test.ts` (Node runner):

```ts
import { readFileSync } from "node:fs";
import { flattenTheme } from "@slotted/theme";
import { themeConformance } from "@slotted/theme/conformance";
import contract from "@slotted/theme/contract.json" with { type: "json" };
import theme from "./equori.theme.ts";

themeConformance({
  contract,
  theme: flattenTheme(theme),
  css: readFileSync(new URL("./equori.gen.css", import.meta.url), "utf8"),
});
```

`scheme.test.ts` (Vitest): default `dark` when storage is empty; `applyScheme("light")` sets the attribute and storage; `readScheme()` returns `dark` when `localStorage.getItem` throws.

- [ ] **Step 3: Run** `cd web && node --test src/theme/equori.theme.test.ts` → FAIL (module missing).

- [ ] **Step 4: Theme.** `equori.theme.ts` default-exports `extendTheme(defaultTheme, { seeds: { accent: <teal> } , components: {...} }, { name: "equori" })` using only erasable TypeScript and package imports. Accent seed: a teal (hue 170–185). Intent seeds stay the default's unless conformance needs otherwise; red (`danger`) stays reserved for negative balances and errors. No colour of the `tone`, `surface`, `text`, `border` groups is declared by hand.

- [ ] **Step 5: Build wiring.** `Makefile` `gen` appends:

```make
	tmp=$$(mktemp -d) && (cd web && pnpm exec slotted-build-theme src/theme/equori.theme.ts --out $$tmp) \
		&& cp $$tmp/equori.css web/src/theme/equori.gen.css && rm -rf $$tmp
```

`gen-check` adds `'*.gen.css'` to both `git` commands. `.prettierignore` adds `**/*.gen.css`. `package.json` `test`: `vitest run && node --test src/theme/equori.theme.test.ts`. Run `make gen`.

- [ ] **Step 6: Entry.** `app/app.css` holds only `@layer slotted, app;`. `main.tsx` imports, in order: `@/app/app.css`, `@slotted/react/styles.css`, `@/theme/equori.gen.css`, then calls `applyScheme(readScheme())`. `index.html`: `<html lang="en" data-slotted-theme="equori" data-slotted-scheme="dark">`.

- [ ] **Step 7: Verify and commit.** `cd web && pnpm test` → both runners PASS; `make check` → exit 0.

```bash
git commit -m "feat(web): add the equori theme and colour scheme preference"
```

### Task 6: i18n catalogs, locale and money formatting

**Files:**
- Create: `web/src/i18n/catalog.en.ts`, `catalog.pt-BR.ts`, `locale.ts`, `i18n-provider.tsx`, `today.tsx`, `format.ts`, `format.test.ts`, `i18n-provider.test.tsx`

**Interfaces:**
- Produces: `type Locale = "en" | "pt-BR"`; `detectLocale(language: string): Locale` (`pt*` → `pt-BR`, else `en`); `readLocale(): Locale` (localStorage `equori.locale`, else `detectLocale(navigator.language)`); `writeLocale(l: Locale): void` (also sets `<html lang>`).
- Produces: `export const catalogEn = {...} as const; export type Catalog = { [K in keyof typeof catalogEn]: string }; export type MessageKey = keyof Catalog`. `catalogPtBR: Catalog`. Keys are dotted (`nav.home`, `problem.version_conflict`). Placeholders use `{name}`.
- Produces: `I18nProvider({ locale, children })`; `useT(): (key: MessageKey, vars?: Record<string, string | number>) => string`; `useAppLocale(): [Locale, (l: Locale) => void]` (the name avoids Slotted's `useLocale`).
- Produces in `today.tsx`: `TodayProvider({ today?: string; children })`, `useToday(): string` (the provided ISO date, else `todayISO()`). Screens read the date only through `useToday()`, so tests fix it.
- Produces in `format.ts`: `formatPlain(minor: number, scale: number): string` (`"-1234.56"`), `formatMoney(m: { amount: number; currency: string }, scale: number, locale: Locale): string`, `parseAmount(text: string, scale: number, locale: Locale): number | null`, `formatDate(iso: string, locale: Locale): string`, `todayISO(now?: Date): string`.

- [ ] **Step 1: Write the failing test `format.test.ts`**

| Function | Input | Expected |
|---|---|---|
| `formatPlain` | `(123456, 2)` | `"1234.56"` |
| `formatPlain` | `(-5, 2)` | `"-0.05"` |
| `formatPlain` | `(7, 0)` | `"7"` |
| `formatPlain` | `(123456789, 8)` | `"1.23456789"` |
| `formatMoney` | `({amount:123456,currency:"BRL"}, 2, "pt-BR")` | `"R$ 1.234,56"` (NBSP after `R$`, as `Intl` emits) |
| `formatMoney` | same, `"en"` | `"R$1,234.56"` |
| `formatMoney` | `({amount:-5,currency:"USD"}, 2, "en")` | `"-$0.05"` |
| `parseAmount` grouped pt-BR | `("1.234,56", 2, "pt-BR")` | `123456` |
| `parseAmount` grouped en | `("1,234.56", 2, "en")` | `123456` |
| `parseAmount` short fraction | `("0,1", 2, "pt-BR")` | `10` |
| `parseAmount` integer | `("12", 2, "en")` | `1200` |
| `parseAmount` negative | `("-3.5", 2, "en")` | `-350` |
| `parseAmount` excess digits | `("1,234", 2, "pt-BR")` | `null` |
| `parseAmount` garbage | `("12a", 2, "en")` | `null` |
| `parseAmount` beyond safe integer | `("99999999999999999", 2, "en")` | `null` |
| `formatDate` | `("2026-10-17", "pt-BR")` | `"17/10/2026"` |
| `formatDate` | `("2026-10-17", "en")` | `"10/17/2026"` |

`i18n-provider.test.tsx`: `useT()("nav.home")` renders the pt-BR text under `locale="pt-BR"`; a `{count}` placeholder is replaced; `detectLocale("pt-PT") === "pt-BR"`, `detectLocale("fr") === "en"`.

- [ ] **Step 2: Run** `cd web && pnpm vitest run src/i18n` → FAIL.

- [ ] **Step 3: Implement.** The integer↔text core, which no signature determines:

```ts
export function formatPlain(minor: number, scale: number): string {
  const digits = Math.abs(minor).toString().padStart(scale + 1, "0");
  const sign = minor < 0 ? "-" : "";
  if (scale === 0) return sign + digits;
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

export function parseAmount(text: string, scale: number, locale: Locale): number | null {
  const [group, decimal] = locale === "pt-BR" ? [".", ","] : [",", "."];
  const t = text.trim().split(group).join("");
  const m = new RegExp(`^(-?)(\\d+)(?:\\${decimal}(\\d*))?$`).exec(t);
  if (m === null) return null;
  const frac = m[3] ?? "";
  if (frac.length > scale) return null;
  const n = Number(`${m[1]}${m[2]}${frac.padEnd(scale, "0")}`);
  return Number.isSafeInteger(n) ? n : null;
}
```

`formatMoney` passes `formatPlain(...)` as a string to `Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: scale, maximumFractionDigits: scale }).format(<string>)` (ES2023 accepts decimal strings exactly); for a code `Intl` rejects (a security), it formats the plain number with `style: "decimal"` and appends the code. `formatDate` builds a `Date` in UTC from the ISO parts and formats with `timeZone: "UTC"`.

- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0.

- [ ] **Step 5: Commit** `git commit -m "feat(web): add catalogs, locale detection and money formatting"`.

### Task 7: Problem parsing and the query client

**Files:**
- Create: `web/src/api/problem.ts`, `problem.test.ts`, `query-client.ts`, `query-client.test.ts`, `api-context.tsx`, `web/src/testing/fake-api.ts`

**Interfaces:**
- Produces in `problem.ts`: `type Problem = components["schemas"]["Problem"]`; `class ProblemError extends Error { readonly problem: Problem; readonly status: number }`; `parseProblem(status: number, body: unknown): Problem` (non-problem body → `{ type: "about:blank", title: "", status, code: status >= 500 ? "internal_error" : "invalid_request" }`); `problemMessage(p: Problem, t: TFunction): string` (catalog key `problem.<code>` when present, else `title`); `fieldErrors(p: Problem): Record<string, string>`; `unwrap<T>(r: { data?: T; error?: unknown; response: Response }): Promise<T>` throws `ProblemError` when `error` is set, and `NetworkError` is any `TypeError` thrown by fetch.
- Produces in `query-client.ts`: `newQueryClient(onUnauthenticated: () => void): QueryClient` — `retry: (count, err) => !(err instanceof ProblemError && err.status < 500) && count < 2`; a `QueryCache` and `MutationCache` `onError` that calls `onUnauthenticated` on `ProblemError` with status 401.
- Produces in `api-context.tsx`: `ApiProvider({ client, children })`, `useApi(): Client<paths>`.
- Produces in `testing/fake-api.ts`: `fakeApi(routes: Record<string, (req: Request) => Response | Promise<Response>>): typeof fetch` keyed by `"GET /api/v1/transactions"` (path without query); unknown routes return a 404 `not_found` problem and are recorded in `fakeApi.calls`; helpers `json(status, body)` and `problem(status, code, extra?)`.

- [ ] **Step 1: Write the failing tests.** `problem.test.ts`: parses the ADR 004 example body exactly; `problemMessage` returns the catalog text for `version_conflict` and the `title` for an unknown code `foo_bar`; `fieldErrors` maps `[{field:"amount",message:"must not be zero"}]` to `{ amount: "must not be zero" }`; a `text/html` 502 yields code `internal_error`. `query-client.test.ts`: a query failing with a 404 `ProblemError` is called once; a 503 is called three times; a `TypeError` is called three times; a 401 calls `onUnauthenticated` once.

- [ ] **Step 2: Run** `cd web && pnpm vitest run src/api` → FAIL.

- [ ] **Step 3: Implement.** Add `problem.<code>` keys to both catalogs for every code the Ledger screens surface: `invalid_credentials`, `too_many_attempts`, `unauthenticated`, `not_found`, `validation_failed`, `internal_error`, `server_busy`, `invalid_account`, `version_conflict`, `transaction_voided`, `posting_reconciled`, `account_not_empty`, `settings_locked`, `mixed_instruments`, `invalid_request`. Tests use `retryDelay: 0`.

- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0.

- [ ] **Step 5: Commit** `git commit -m "feat(web): parse problem responses and set the query retry policy"`.

### Task 8: Router, providers and the responsive shell

**Files:**
- Create: `web/src/app/router.tsx`, `web/src/app/providers.tsx`, `web/src/app/shell/app-frame.tsx`, `side-nav.tsx`, `more-sheet.tsx`, `app-frame.test.tsx`
- Create: `web/src/ui/use-viewport.ts`, `web/src/ui/bottom-bar.tsx`, `web/src/ui/bottom-bar.module.css`, `web/src/ui/bottom-bar.test.tsx`
- Create: `web/src/testing/render-app.tsx`
- Modify: `web/src/main.tsx`; delete `web/src/app.tsx`

**Interfaces:**
- Produces: `type Viewport = "phone" | "tablet" | "desktop"`; `useViewport(): Viewport` (`(min-width: 1024px)` → desktop, `(min-width: 600px)` → tablet, else phone). `AppFrame` sets `data-slotted-density` on `document.documentElement`: `compact` on desktop, `comfortable` otherwise.
- Produces: `BottomBar({ items }: { items: readonly [BottomBarItem, BottomBarItem, BottomBarItem, BottomBarItem, BottomBarItem] })`, `BottomBarItem = { key: string; label: string; icon: ReactNode; to?: string; onPress?: () => void; emphasized?: boolean }`; the tuple type enforces five controls (SC-05). Root element `<nav aria-label={t("nav.label")} data-own="bottom-bar">`.
- Produces: `AppProviders({ fetchImpl?, today?, children })` wrapping `TodayProvider` and creating one `newClient(location.origin, fetchImpl)`, one `newQueryClient`, `ApiProvider`, `I18nProvider`, `SlottedProvider locale={locale} catalogs={{ "pt-BR": PT_BR }}`.
- Produces: `router` with context `{ queryClient: QueryClient; api: Client<paths> }`, `declare module "@tanstack/react-router" { interface Register { router: typeof router } }`. Route ids: `/login`, `/_authed`, `/_authed/`, `/_authed/transactions`, `/_authed/transactions/new`, `/_authed/transactions/$id`, `/_authed/transactions/$id/correct`, `/_authed/accounts`, `/_authed/accounts/$id`, `/_authed/settings`. Features read params with `getRouteApi("<id>")`; they never import `@/app/*`.
- Produces: `renderApp(path: string, opts: { width?: number; today?: string; fetch: typeof fetch }): Promise<RenderResult & { router }>` (`today` defaults to `"2026-10-17"`) — calls `setViewport(width ?? 1280)`, builds a router with `createMemoryHistory({ initialEntries: [path] })`, renders `AppProviders` + `RouterProvider`, awaits `router.load()`.

- [ ] **Step 1: Read** `dist/docs/app-shell.md`, `side-navigation.md`, `action-sheet.md`, `page.md`, `page-header.md`, the skill `build-own-element`, and `guidelines/shell-composition.md`.

- [ ] **Step 2: Write the failing tests.** `app-frame.test.tsx` renders `/` with a fake `GET /me` 200 and empty Home data (placeholder page until Task 10):

| Width | Expected |
|---|---|
| 360 | `[data-own="bottom-bar"]` present with 5 buttons/links; `[data-ui="side-navigation"]` absent; `html[data-slotted-density="comfortable"]` |
| 768 | side-navigation present, rendered as the rail (`mode="compact"`); bottom-bar absent |
| 1280 | side-navigation present with `mode="expanded"`; bottom-bar absent; `html[data-slotted-density="compact"]` |
| 360 → 1280 | `setViewport(1280)` after render swaps bottom-bar for side-navigation without reload |

Pressing "More" at 360 opens the action-sheet with items Settings, Colour scheme, Language, Log out (catalog text). `bottom-bar.test.tsx`: the centre item carries `aria-current` only when its route is active and the emphasized item has `data-emphasized`.

- [ ] **Step 3: Run** `cd web && pnpm vitest run src/app src/ui` → FAIL.

- [ ] **Step 4: Implement.** Router skeleton:

```tsx
const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Outlet });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login",
  validateSearch: (s): { redirect?: string } =>
    typeof s.redirect === "string" && s.redirect.startsWith("/") ? { redirect: s.redirect } : {},
  component: LoginPage });
const authedRoute = createRoute({ getParentRoute: () => rootRoute, id: "_authed",
  beforeLoad: async ({ context, location }) => { /* Task 9: ensure GET /me, redirect on 401 */ },
  component: AppFrame });
export const routeTree = rootRoute.addChildren([loginRoute, authedRoute.addChildren([/* screens */])]);
export function newRouter(context: RouterContext, history?: RouterHistory) {
  return createRouter({ routeTree, context, history, defaultPreload: "intent" });
}
```

`AppFrame` composes `AppShell` with the nav region holding `SideNav` (tablet, desktop) and `BottomBar` below the content on phone; `Outlet` is the content. Navigation links pass TanStack `Link` through Slotted `render`. Bottom-bar CSS: `position: sticky; bottom: 0`, `padding-bottom: env(safe-area-inset-bottom)`, targets `min-block-size: var(--slotted-target-min)`, focus ring per OE-03; inside `@layer app`. `MoreSheet` uses `ActionSheet`; Colour scheme and Language open a second level with the three schemes and two locales. Log out is wired in Task 9. Screen routes point to a placeholder component returning `null` until their task.

- [ ] **Step 5: Run** → PASS; `make web-check` → exit 0. Manual note: `make dev` + `make web-dev`, browser devtools at 360, 768, 1280 px: no horizontal scroll.

- [ ] **Step 6: Commit** `git commit -m "feat(web): add the router, providers and responsive shell"`.

### Task 9: Session, login and logout

**Files:**
- Create: `web/src/features/session/api.ts`, `login-page.tsx`, `login-page.test.tsx`, `use-logout.ts`, `index.ts`
- Modify: `web/src/app/router.tsx` (`beforeLoad`), `web/src/app/providers.tsx` (`onUnauthenticated`), `web/src/app/shell/more-sheet.tsx`

**Interfaces:**
- Produces: `sessionKeys = { me: ["session", "me"] as const }`; `meQuery(api)` (`GET /me`); `useLogin()` (`POST /session` with `{ email, password }`); `useLogout()` (`DELETE /session`, then `queryClient.clear()`, then navigate `/login`); `LoginPage`. `index.ts` exports `LoginPage`, `meQuery`, `useLogout`.

- [ ] **Step 1: Write the failing test `login-page.test.tsx`** (flows with `renderApp`):
  1. `/transactions` with `GET /me` 401 lands on `/login?redirect=%2Ftransactions`.
  2. Login with `POST /session` 204 then `GET /me` 200 navigates to `/transactions`; the request body is `{"email":"a@b.c","password":"pw"}` exactly.
  3. `POST /session` 401 `invalid_credentials` shows the catalog text of `problem.invalid_credentials` in an `alert`, and the password field keeps focus.
  4. A query returning 401 after login clears the cache and lands on `/login?redirect=<current path>`.
  5. More → Log out sends `DELETE /session` and lands on `/login`.
  6. Responsive check: at 360 the login page renders without bottom-bar and side-navigation.

- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/session` → FAIL.

- [ ] **Step 3: Implement.** `beforeLoad` calls `context.queryClient.ensureQueryData(meQuery(context.api))`; a `ProblemError` 401 throws `redirect({ to: "/login", search: { redirect: location.href } })`. `onUnauthenticated` in providers clears the cache and calls `router.navigate` with the same redirect. Login form: `Form`, `Field`, `TextField` (`type="email"`, `autoComplete="username"`; password `autoComplete="current-password"`), `Button` with `loading` while pending, `InlineMessage` for the problem. Page width `content`.

- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0.

- [ ] **Step 5: Commit** `git commit -m "feat(web): add login, session guard and logout"`.

### Task 10: Home

**Files:**
- Create: `web/src/features/accounts/api.ts`, `home-page.tsx`, `home-page.test.tsx`, `balance-groups.ts`, `balance-groups.test.ts`, `index.ts`
- Create: `web/src/features/setup/api.ts`, `instruments.ts`, `index.ts`
- Create: `web/src/ui/money-text.tsx`, `web/src/ui/money-text.module.css`
- Create: `web/src/features/transactions/api.ts`, `transaction-list.tsx`, `row-amount.ts`, `row-amount.test.ts`, `index.ts`

**Interfaces:**
- Produces in `setup/api.ts`: `settingsQuery(api)` (`GET /settings`), `instrumentsQuery(api)` (`GET /instruments`, `staleTime: Infinity`); `useScale(): (code: string) => number` (exported from `setup/index.ts`; unknown code → 0 until loaded).
- Produces in `accounts/api.ts`: `accountKeys = { all, list, detail(id), balance(id, basis), series(id) }`, `balanceKeys = { all: ["balances"], at(date, basis) }`; `accountsQuery(api)` (`GET /accounts`, all pages), `balancesQuery(api, date, basis)` (`GET /balances`, B2).
- Produces in `balance-groups.ts`: `type Group = "available" | "reserves" | "cards" | "loans"`; `groupBalances(accounts: Account[], balances: Balance[], base: string): { group: Group; items: { account: Account; balance: Money }[]; total: Money; excluded: number }[]` (kind lists in "Spec ambiguities resolved"; closed accounts with zero balance omitted).
- Produces in `transactions/api.ts`: `transactionKeys = { all: ["transactions"], list(search), detail(id), versions(id) }`; `transactionsInfiniteQuery(api, search)` (`useInfiniteQuery` over `next_cursor`, `limit: 50`).
- Produces in `row-amount.ts`: `rowAmount(tx: Transaction, accountsById: Map<string, Account>, filterAccountId?: string): { money: Money; transfer: boolean }`.
- Produces: `TransactionList({ search, limit?, infinite })` (exported from `transactions/index.ts`), `MoneyText({ money, scale, tone? })` with `font-variant-numeric: tabular-nums`; tone: amount > 0 → positive tone, < 0 on a balance → danger tone, otherwise neutral text.

- [ ] **Step 1: Write the failing tests.**
  - `balance-groups.test.ts`: checking 1000 BRL + savings 500 BRL → available total 1500 BRL; card −300 BRL → cards total −300; **excludes foreign balances from totals**: a `checking` in USD 700 is listed in available, `total` stays 1500 BRL and `excluded === 1`.
  - `row-amount.test.ts`: expense (checking −120, food +120), no filter → −120, `transfer: false`; with filter `food` → +120; transfer (checking −500, savings +500), no filter → −500 and `transfer: true`; income (salary −1000, checking +1000) → +1000.
  - `home-page.test.tsx` with fake `GET /me`, `/settings`, `/instruments`, `/accounts`, `/balances`, `/transactions?limit=5`, `/transactions?uncategorized=true&limit=200`: group headings and totals render formatted in pt-BR; five recent rows render; the uncategorized shortcut reads the count `3` and links to `/transactions?uncategorized=true`; with `next_cursor` it reads `200+`. Pending state: before the fetch resolves, the balance region has `aria-busy="true"` and skeleton placeholders, the page header title is real text. Error state: `/balances` 500 renders `result-state` with a retry button that re-requests.
  - Responsive check in the same file: at 360 the "New transaction" control is the bottom-bar centre item and the page header has no primary action; at 768 and 1280 the page header holds the primary `Button` linking `/transactions/new`.

- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features` → FAIL.

- [ ] **Step 3: Implement.** Families: `Page` (width `wide`), `PageHeader`, `Section`, `StatCard` per group, `List`/`ListItem` for accounts, `TransactionList` for recent rows, `Skeleton`/`SkeletonRegion`, `ResultState`. `today` comes from `useToday()`.

- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0. Manual note at 360/768/1280 px.

- [ ] **Step 5: Commit** `git commit -m "feat(web): add the home screen with balances by group"`.

### Task 11: Transactions list and filters

**Files:**
- Create: `web/src/features/transactions/search.ts`, `search.test.ts`, `transactions-page.tsx`, `transactions-page.test.tsx`, `filter-drawer.tsx`
- Modify: `web/src/features/transactions/transaction-list.tsx`, `index.ts`; `web/src/app/router.tsx` (route `/_authed/transactions` with `validateSearch: validateTransactionSearch`)

**Interfaces:**
- Produces: `type TransactionSearch = { account_id?: string; payee_id?: string; tag?: string; from?: string; to?: string; uncategorized?: true; q?: string }`; `validateTransactionSearch(raw: Record<string, unknown>): TransactionSearch` (UUIDs by regex, dates `YYYY-MM-DD` that `Date.UTC` round-trips, `q` trimmed 1–100 chars, `uncategorized` only `true`; anything else dropped).

- [ ] **Step 1: Write the failing tests.**
  - `search.test.ts`: **drops invalid search params**: `{ account_id: "x", from: "2026-13-40", q: "  ", uncategorized: "yes" }` → `{}`; a valid object round-trips unchanged.
  - `transactions-page.test.tsx`: rows group under sticky day headers in date-desc order; scrolling to the sentinel (`IntersectionObserver` stubbed in the test) requests the page with `cursor=<next_cursor>`; typing `mercado` in search and submitting navigates to `?q=mercado` and the next request carries `q=mercado`; choosing an account in the filter drawer produces `?account_id=<id>` and a removable `Tag`; removing the tag returns to `/transactions`; loading `/transactions?tag=viagem&from=2026-10-01` sends exactly those query parameters; a filter change empties the rows and shows skeleton rows (LP-06); empty with filters → `result-state` "no results" with a clear-filters action; empty without filters → empty state with the new-transaction action.
  - Responsive check: at 360 filters open in a `Drawer` from the bottom and each row has two lines (payee or description, category, amount; account and tags); at 1280 the filter controls sit in the page header region and the drawer trigger is absent.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.** Page width `bleed` with `fill`; one scroller. `TransactionList` uses `List` with `ListItemLink` rows (target `/transactions/$id`), a transfer icon from `Icon` (glyph from `dist/docs/icon.md`), `MoneyText` with `rowAmount`. Category name = names of income/expense accounts in the postings. Voided rows are struck through via a `*.module.css` class.

- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0. Manual note at 360/768/1280 px.

- [ ] **Step 5: Commit** `git commit -m "feat(web): list transactions with url filters and infinite scroll"`.

### Task 12: New transaction, quick entry

**Files:**
- Create: `web/src/features/transactions/transaction-form-reducer.ts`, `transaction-form-reducer.test.ts`, `new-transaction-page.tsx`, `new-transaction-page.test.tsx`, `draft-storage.ts`, `amount-field.tsx`
- Modify: `web/src/features/transactions/api.ts` (`useCreateTransaction`), `index.ts`; `web/src/app/router.tsx` (`/_authed/transactions/new`, search `{ account_id?: string }`)

**Interfaces:**
- Produces: `type Mode = "expense" | "income" | "transfer"`; `type FormState = { mode: Mode; amount: number | null; accountId: string; counterId: string; date: string; payeeId?: string; payeeName?: string; description: string; tags: string[]; split: SplitLine[] | null; postings: PostingLine[] | null }`; `SplitLine = { key: string; categoryId: string; amount: number | null }`; `PostingLine = { key: string; accountId: string; amount: number | null; currency: string; memo: string }`.
- Produces: `formReducer(state: FormState, action: FormAction): FormState`; `initialForm(today: string, accountId?: string): FormState`; `toTransactionInput(state: FormState, currencyOf: (accountId: string) => string): TransactionInput` (throws on an incomplete state; the save button stays disabled until `canSave(state)`).
- Produces: `loadDraft(): FormState | null`, `saveDraft(s: FormState): void`, `clearDraft(): void`, key `equori.draft.transaction-new`.
- Produces: `transactionMutated(queryClient, accountIds: string[])` invalidating `transactionKeys.all`, `balanceKeys.all`, `accountKeys.detail(id)` and `accountKeys.balance(id, *)` for each id; every transaction mutation of Tasks 12–14 calls it.

- [ ] **Step 1: Write the failing tests.**
  - `transaction-form-reducer.test.ts`, `toTransactionInput` rows (account `checking` BRL, category `food`, amount `12000`): expense → postings `[{checking, −12000 BRL}, {food, +12000 BRL}]`; income → `[{checking, +12000}, {salary, −12000}]`; transfer → `[{checking, −12000}, {savings, +12000}]`; tags and `payee_id` copied; `description` omitted when empty.
  - `new-transaction-page.test.tsx`: **quick-entry payload**: choose Expense, type `120,00`, pick account and category, save → `POST /transactions` body equals the expected JSON exactly and a toast appears; "save and add another" keeps mode, account and date and clears amount, category, payee; a 422 with `errors: [{field: "postings", ...}]` shows the message next to the amount field; a payee typed that does not exist is created through `POST /payees` before the transaction; the draft survives an unmount/remount and is cleared after save; **works when sessionStorage throws**: with `Storage.prototype.getItem`/`setItem` throwing, the page renders and saves; `/transactions/new?account_id=<id>` preselects the account.
  - Responsive check: at 360 the submit button is inside the form footer carrying `data-pinned="true"` and the account picker renders full-screen (`EntityPicker` inside a `Dialog` at phone width); at 1280 the picker is inline.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.** Families: `SegmentedControl`/`Segment` for mode, `CurrencyField` (`inputMode="decimal"`, value per "Spec ambiguities resolved"), `EntityPicker` with `rememberRecent` for account, category and payee, `DatePicker` defaulting to `useToday()`, `TagsInput`, `Form`, `FormActions`. Page width `content`. Phone: `100dvh`, footer offset by `window.visualViewport` height difference (a `resize` listener setting a CSS custom property `--keyboard-inset`, a literal justified in a comment: no token covers the keyboard).

- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0. Manual note at 360/768/1280 px.

- [ ] **Step 5: Commit** `git commit -m "feat(web): add quick transaction entry with draft persistence"`.

### Task 13: Split and advanced postings

**Files:**
- Create: `web/src/features/transactions/split-editor.tsx`, `postings-editor.tsx`
- Modify: `transaction-form-reducer.ts`, `transaction-form-reducer.test.ts`, `new-transaction-page.tsx`, `new-transaction-page.test.tsx`

**Interfaces:**
- Produces: `splitRemainder(state: FormState): number` (`amount − Σ split.amount`, nulls as 0); `postingImbalance(lines: PostingLine[]): Record<string, number>` (sum per currency, only non-zero entries); `canSave` requires remainder 0 in split mode and an empty imbalance in advanced mode.

- [ ] **Step 1: Write the failing tests.**
  - Reducer: total 10000, lines 6000 + 2500 → remainder 1500; adding a third line of 1500 → 0; removing a line restores the remainder; `toTransactionInput` in split mode → one account posting −10000 and three category postings.
  - Postings: `[{a, −100, BRL}, {b, +100, BRL}]` → `{}`; `[{a, −100, BRL}, {b, +90, BRL}]` → `{ BRL: −10 }`; `[{a, −100, BRL}, {b, +100, BRL}, {c, −5, USD}, {d, +5, USD}]` → `{}`.
  - Page: "Split" adds two category lines and shows the remainder formatted; save is disabled while the remainder is not zero; "Advanced" replaces the form with the postings editor prefilled from the current quick entry, and save sends the free postings with `memo` when filled.

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (`List` of rows with `EntityPicker` + `CurrencyField` + `IconButton` remove; remainder in `MoneyText`). **Step 4: Run** → PASS; `make web-check` → exit 0; responsive manual note.

- [ ] **Step 5: Commit** `git commit -m "feat(web): add split and advanced postings to transaction entry"`.

### Task 14: Transaction detail, correction, void, categorize, history

**Files:**
- Create: `web/src/features/transactions/transaction-page.tsx`, `transaction-page.test.tsx`, `correct-transaction-page.tsx`, `correct-transaction-page.test.tsx`, `void-dialog.tsx`, `categorize-dialog.tsx`, `version-history.tsx`
- Modify: `api.ts` (`transactionQuery`, `versionsQuery`, `useCorrectTransaction`, `useVoidTransaction`, `useCategorizeTransaction`), `transaction-form-reducer.ts` (`fromTransaction(tx: Transaction): FormState`), `index.ts`; `web/src/app/router.tsx`

**Interfaces:**
- Consumes: `formReducer`, `toTransactionInput`, `transactionMutated` (Task 12).
- Produces: `PUT /transactions/{id}` body `CorrectionInput` = `toTransactionInput(...)` + `expected_version` + `reason`; `POST /transactions/{id}/void` `{ reason }`; `POST /transactions/{id}/categorize` `{ expected_version, parts: [{ account_id, amount }] }`; `GET /transactions/{id}/versions`.

- [ ] **Step 1: Write the failing tests.**
  - `transaction-page.test.tsx`: renders amount, date, description, payee name, tags, each posting with account, amount and status, origin and version; a voided transaction has its amount inside an `s` element and shows `void_reason`; **void**: the dialog requires a reason (confirm disabled when empty), sends `{"reason":"duplicate"}`, then the page shows the voided state and a toast; **categorize** sends `expected_version` of the loaded transaction and the chosen parts; history renders a `Timeline` item per version with `reason` and `replaced_at`.
  - `correct-transaction-page.test.tsx`: the form is prefilled from the transaction; save without reason shows the required-field error; save sends `expected_version: 3` and `reason`; **correction 409**: `PUT` returns 409 `version_conflict`, the page refetches the transaction, shows an `InlineMessage` with the current version `4`, the user's edited amount stays in the field, and "Reapply" sends `expected_version: 4` with the same edits.
  - Responsive check: at 360 the actions (correct, categorize, void, history) sit in the page header title line, overflowing into a `Menu`; at 1280 they render as buttons.

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** with `Page` (`wide`), `PageHeader`, `DescriptionList`, `List`, `Badge` for posting status, `Dialog`/`AlertDialog`, `Timeline`, `Menu`. **Step 4: Run** → PASS; `make web-check` → exit 0; responsive manual note.

- [ ] **Step 5: Commit** `git commit -m "feat(web): show a transaction and correct, void or recategorize it"`.

### Task 15: Accounts tree

**Files:**
- Create: `web/src/features/accounts/accounts-page.tsx`, `accounts-page.test.tsx`, `account-tree.ts`, `account-tree.test.ts`, `account-dialog.tsx`
- Modify: `web/src/features/accounts/api.ts` (`useCreateAccount`, `useUpdateAccount`, `useCloseAccount`), `index.ts`; `web/src/app/router.tsx`

**Interfaces:**
- Produces: `buildAccountTree(accounts: Account[]): { class: "asset" | "liability" | "equity" | "income" | "expense"; roots: TreeNode[] }[]`, `TreeNode = { account: Account; children: TreeNode[] }`, children sorted by name; an account whose parent is missing becomes a root.

- [ ] **Step 1: Write the failing tests.** `account-tree.test.ts`: three levels nest; orphan becomes root; classes in the order asset, liability, equity, income, expense. `accounts-page.test.tsx`: balance accounts show their B2 balance; categories show no balance; create sends `POST /accounts` with name, class, kind, parent; rename and move send `PATCH /accounts/{id}` with only the changed fields; close sends `POST /accounts/{id}/close`, and a 409 `account_not_empty` shows the catalog message; a card account shows its balance only (no statement link). Responsive check: at 360 the tree rows keep the balance on the row's first line and actions move to a row `Menu`; at 1280 the same.

- [ ] **Step 2–4:** Run → FAIL; implement with `Tree`, `Dialog`, `Field`, `Select`, `EntityPicker` (parent); run → PASS; `make web-check` → exit 0; responsive manual note.

- [ ] **Step 5: Commit** `git commit -m "feat(web): add the accounts tree with create, edit and close"`.

### Task 16: Account detail with balance chart

**Files:**
- Create: `web/src/features/accounts/account-page.tsx`, `account-page.test.tsx`, `balance-chart.tsx`, `balance-series.ts`, `balance-series.test.ts`
- Modify: `web/src/features/accounts/api.ts` (`balanceQuery(api, id, date, basis)`, `seriesQuery(api, id, from, to)`), `index.ts`; `web/src/app/router.tsx`

**Interfaces:**
- Consumes: `TransactionList` from `@/features/transactions`; `formatPlain` from `@/i18n/format`.
- Produces: `toChartPoints(series: BalanceSeries, scale: number): { date: string; value: number }[]` with `value = Number(formatPlain(amount, scale))`; `ninetyDayWindow(today: string): { from: string; to: string }` (`from` = today − 89 days).

- [ ] **Step 1: Write the failing tests.** `balance-series.test.ts`: `ninetyDayWindow("2026-10-17")` → `{ from: "2026-07-20", to: "2026-10-17" }`; `toChartPoints` maps `-12345` at scale 2 to `-123.45`. `account-page.test.tsx`: requests `/accounts/{id}/balance?date=<today>&basis=booked` and `...basis=settled` and shows both; requests `/reports/balances?account_id=<id>&from=2026-07-20&to=2026-10-17` (`renderApp` default `today`); lists transactions filtered by the account; the new-transaction action links `/transactions/new?account_id=<id>`; close behaves as in Task 15. Responsive check: at 360 the chart takes the full content width and the "new transaction" action is the bottom-bar centre item; at 1280 the action is in the page header.

- [ ] **Step 2–4:** Run → FAIL; implement with `Chart` (`kind="line"`, `curve="step"`), `preloadChartEngine(["line"])` in the route loader, `StatCard` for the two balances; jsdom renders the chart container only (assert `[data-ui="chart"]`); run → PASS; `make web-check` → exit 0. Manual note: in the browser console no CSP violation appears while the chart draws.

- [ ] **Step 5: Commit** `git commit -m "feat(web): add the account page with a 90-day balance chart"`.

### Task 17: Settings

**Files:**
- Create: `web/src/features/setup/settings-page.tsx`, `settings-page.test.tsx`
- Modify: `web/src/features/setup/api.ts` (`useUpdateSettings`, `institutionsQuery`, `useCreateInstitution`, `payeesQuery`, `useCreatePayee`), `index.ts`; `web/src/app/router.tsx`

- [ ] **Step 1: Write the failing test.** Base currency `Select` sends `PUT /settings` `{ base_currency: "USD" }`; a 409 `settings_locked` disables the select and shows the catalog reason; when any transaction exists (`GET /transactions?limit=1` returns an item) the select is disabled before any attempt and the reason shows; institutions and payees list and create (`POST /institutions`, `POST /payees` with `{ name }`); language select calls `writeLocale` and the page re-renders in the chosen language with `<html lang>` updated; scheme select calls `applyScheme`. Responsive check: at 360 and 1280 the `Page` carries width `measure`; absence of horizontal scroll is a manual note (jsdom computes no layout).

- [ ] **Step 2–4:** Run → FAIL; implement with `Page` (`measure`), `Section`, `Select`, `List`, `Dialog`; run → PASS; `make web-check` → exit 0.

- [ ] **Step 5: Commit** `git commit -m "feat(web): add settings for currency, institutions, payees and display"`.

### Task 18: Web app manifest and phone document setup

**Files:**
- Create: `web/public/manifest.json`, `web/public/icon.svg`, `web/src/testing/document.test.ts`
- Modify: `web/index.html`

- [ ] **Step 1: Write the failing test `document.test.ts`.** Reads `web/index.html` and `web/public/manifest.json` with `node:fs`: the viewport meta content equals `width=device-width, initial-scale=1, viewport-fit=cover`; a `<link rel="manifest" href="/manifest.json">` and `<meta name="theme-color">` exist; the manifest has `display: "standalone"`, `start_url: "/"`, `name: "equori"`, an icon `{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }`, and `theme_color` equal to the `theme-color` meta value.

- [ ] **Step 2–4:** Run → FAIL; implement (`theme_color` = the dark-scheme page surface colour read from `equori.gen.css`, a literal with a comment naming its token); run → PASS; `make web-build` then `go test ./internal/server/... -count=1` → PASS (the SPA handler serves `/manifest.json` from the embedded tree). No service worker.

- [ ] **Step 5: Commit** `git commit -m "feat(web): add the web app manifest and phone viewport"`.

### Task 19: Responsive verification of every route

**Files:**
- Create: `web/src/app/routes-responsive.test.tsx`

- [ ] **Step 1: Write the test.** One `describe.each([360, 768, 1280])` over the routes `/`, `/transactions`, `/transactions/new`, `/transactions/<id>`, `/accounts`, `/accounts/<id>`, `/settings`, `/login`, with one shared fake API holding one account, one category, one transaction. Assertions per width: phone → `[data-own="bottom-bar"]` present (absent on `/login`), side-navigation absent; tablet → side-navigation `mode="compact"`; desktop → side-navigation `mode="expanded"`; each page renders its `PageHeader` title text and no `result-state` error.

- [ ] **Step 2: Run** `cd web && pnpm vitest run src/app/routes-responsive.test.tsx` → PASS (this task adds coverage over finished screens; a failure is a defect of the owning screen task, fixed there with its own failing test).

- [ ] **Step 3: Manual pass.** `make db-up`, `make dev`, `make web-dev`; for each route at 360, 768 and 1280 px in browser devtools: no horizontal scroll, the navigation of section 2, the page header sticky on phone, the bottom-bar above the safe area. Record the result in the commit body.

- [ ] **Step 4: Gates.** `make check` → exit 0.

- [ ] **Step 5: Commit** `git commit -m "test(web): verify navigation of every route at three widths"`.
