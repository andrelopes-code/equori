# Account Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw each credit card of `/cards` as an `AccountCard` fed by a new daily-flows read.

**Architecture:** `reporting_account_day` gains booked inflow and outflow per day. `GET /reports/flows` reads them. `AccountCard` is an own element in `features/accounts`, previewed on a development-only route and composed by `features/cards/card-tile.tsx`.

**Tech Stack:** Go, PostgreSQL, sqlc, oapi-codegen, React, TypeScript, CSS modules, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-21-account-card-design.md`

## Global Constraints

- Work in the main worktree. Nothing is committed: the working tree holds unrelated uncommitted changes in the same files.
- `web/CLAUDE.md` O1–O8. Every text through `useT()`, with keys in `catalog-accounts.pt-BR.ts` and `catalog-accounts.en.ts`.
- No new dependency.
- Range problems reuse the existing 400 `invalid_request`; an unknown account returns 404 `not_found`.

## Review Focus

- A day whose inflow equals its outflow keeps its row. Its balance stays correct: test `TestFlowsListsZeroDeltaDay`.
- A card without a current statement, a limit or flows draws no value, meter or chip, and the card keeps its 1.586 ratio. Component test "omits every element without data".
- `total = 0` or a negative limit hides the meter: helper test.
- A negative value shows "−" before "R$": money split test.
- Hidden mode leaves no amount in the accessible label: component test.

---

### Task 1: Daily flows read (backend)

**Files:**
- Create: `db/migrations/00037_reporting_account_day_flows.sql`, `internal/reporting/schema_test.go`, `internal/reporting/flows_test.go`
- Modify: `db/queries/reporting/account_day.sql`, `internal/reporting/internal/app/series.go`, `internal/reporting/internal/adapter/postgres/repository.go`, `internal/reporting/internal/adapter/httpapi/server.go`, `api/openapi.yaml`, `internal/server/tool_exposure_test.go`, `docs/domain/06-scenarios.md`

**Interfaces:**
- Produces: `GET /api/v1/reports/flows?account_id&from&to` → `AccountFlows {items: [{date, inflow: Money, outflow: Money}]}`, operation `getAccountFlows`. Rows only, in date order. Range from 1 to 366 days, otherwise 400 `invalid_request`.

- [ ] Migration:
  - add `inflow_booked` and `outflow_booked`, both `bigint NOT NULL DEFAULT 0`;
  - add `CHECK (inflow_booked >= 0 AND outflow_booked >= 0)` and `CHECK (inflow_booked - outflow_booked = delta_booked)`;
  - fill both columns from `ledger_posting`. For each row, inflow is the sum of the positive amounts of the account's non-voided postings booked on the date, and outflow is the sum of the absolute values of the negative amounts.
- [ ] `internal/reporting/schema_test.go`: `TestAccountDayFlowChecks` inserts a row that violates each check and expects `23514`.
- [ ] `flows_test.go`, scenarios S115–S118, written first and run red:
  - `TestFlowsSplitInflowAndOutflow` (S115): checking with income 100000, a purchase −2500 and a transfer −10000 on one day, which gives inflow 100000 and outflow 12500;
  - `TestFlowsOfCreditCard` (S116): purchases −3000 and −2000, a refund +1000 and a payment +4000, which gives outflow 5000 and inflow 5000;
  - `TestFlowsListsZeroDeltaDay` (S117): the series balance stays exact;
  - `TestFlowsProblems` (S118): voided transaction absent, another user's account 404, `to < from` 400, 367 days 400.
- [ ] `InsertAccountDaysFrom` also sums `inflow_booked` and `outflow_booked`. Its `HAVING` keeps a day where any of the four sums is non-zero. New query `AccountFlows(user_id, account_id, from, to)`; new query `AccountInstrument(user_id, account_id)`.
- [ ] App: `Service.Flows(ctx, userID, accountID, from, to) ([]Flow, string, error)` with `Flow{Date time.Time; Inflow, Outflow int64}`. `ErrInvalidFlowRange` maps to 400. The existing `ErrNotFound` maps to 404.
- [ ] OpenAPI operation and schemas.
- [ ] `make gen`.
- [ ] Handler `GetAccountFlows`.
- [ ] Exposure entry `"getAccountFlows": "-pending"`.
- [ ] Scenario lines S115–S118 under a new section of `06-scenarios.md`.
- [ ] Verify: `go test ./internal/reporting/... ./internal/server/...` PASS.

### Task 2: AccountCard component

**Files:**
- Create in `web/src/features/accounts/`:
  - `account-card.tsx`, `account-card.module.css`;
  - `account-card-meter.ts` and its `.test.ts`;
  - `account-card-money.ts` and its `.test.ts`;
  - `account-card-kind.ts`;
  - `account-card-art.tsx`;
  - `account-card.test.tsx`.
- Modify: `features/accounts/index.ts`, both `catalog-accounts.*.ts`

**Interfaces:**
- Produces:
  - `type AccountCardKind = "checking" | "credit" | "savings"`;
  - `accountCardKind(kind: string | undefined): AccountCardKind`;
  - `accountCardColor(slot: number | undefined): string`, which returns `var(--slotted-data-n)` or the neutral fallback;
  - `AccountCard` with the props listed below.

`AccountCard` props:
- `kind: AccountCardKind`
- `color: string`
- `title: ReactNode`
- `titleText: string`
- `institutionName?: string`
- `logo?: string`
- `monogram?: string`
- `value?: Money`
- `scale: number`
- `context?: string`
- `meter?: {used: number; total: number}`
- `signal?: number[]`
- `label?: string`
- `hidden?: boolean`
- `loading?: boolean`
- `children?: ReactNode`

`children` is rendered after the card, inside the same `article`.

- [ ] Meter helper:
  - `accountCardMeter(kind, used, total)` returns `{pct, filled, state: "normal" | "alert" | "over" | "reached", left: {key, amount}, right: {key, pct}}`, or `undefined` when `total <= 0`;
  - thresholds: credit alert at 80 and over at 100; checking alert at 90 and over at 100; savings reaches at 100;
  - `filled = min(20, round(pct/5))`; `alertFrom` is the first segment of the risk zone;
  - table test at 0/79/80/89/99/100/104 (credit) and 89/90/100/120 (checking, where `rest < 0` gives "além do que entrou").
- [ ] Money helper:
  - `splitMoney(m: Money, scale, locale)` returns `{sign, symbol, integer, fraction}` through `Intl.NumberFormat(...).formatToParts`, with NBSP replaced by a space;
  - `wholeMoney(m, scale, locale)` returns the amount without cents;
  - both convert by string with the scale (O7);
  - tests: 184277 → `R$`, `1.842`, `,77`; −1050 → sign "−"; 1000000 with no cents.
- [ ] Component test written first:
  - omits each element without data;
  - hidden mode gives "••••", no cents, "R$ ••••" in meter and chip, and the percent stays visible;
  - alert and over show a warning icon plus text;
  - `role="meter"` with `aria-valuenow` equal to pct;
  - the card's `aria-label` is `"<title>, <kind word>, <label>[ · context]: <amount | valor oculto>"`;
  - loading renders placeholders and no amount.
- [ ] Implementation follows the brief's layout, material and art:
  - CSS reads `--account-card-color`;
  - art masks use `useId()`;
  - the warning glyph is an inline SVG sized `1cap` with fallback `0.7em`.
- [ ] Verify: `pnpm vitest run src/features/accounts/account-card` PASS.

### Task 3: Preview route

**Files:**
- Create: `web/src/features/accounts/account-card-preview.tsx`
- Modify: `web/src/app/router.tsx`, `features/accounts/index.ts`, catalogs

- [ ] Route `/preview/account-card`, added to the route tree only when `import.meta.env.DEV`.
- [ ] The page renders the seven brief cases with fixed data. The colours are the slots 1, 4 and 7, `#f5c400` and `#ff4fa0`.
- [ ] Verify with `pnpm build`: the `dist/` output has no `account-card-preview` chunk.

### Task 4: Cards destination

**Files:**
- Modify: `web/src/features/cards/card-tile.tsx`, `card-tile.module.css`, `cards-page.tsx`, `cards-page.test.tsx`, `features/cards/api.ts`
- Modify (only when tests need it): `src/testing` fixtures

- [ ] `flowsQuery(api, accountId, from, to)` in `features/cards/api.ts`.
- [ ] `CardTile` draws `AccountCard`:
  - kind `credit` and colour `accountCardColor(account.color)`;
  - title: the account-name link;
  - logo from `logoIndexQuery` and `logoURL`, with the monogram from the institution name;
  - value `current.amount_due`, context from `current.due_date`;
  - meter from the limit and the available limit;
  - signal: outflow from Monday through today, one entry per day.
- [ ] The statement strip (tag, dates, unpaid amount and "Pagar") is the card's `children`. The `ProgressBar` is removed.
- [ ] Grid tracks `minmax(min(100%, 280px), 1fr)`.
- [ ] `cards-page.test.tsx` asserts the card's accessible label and the meter. The existing assertions on the strip still pass.
- [ ] Verify: `pnpm vitest run src/features/cards` PASS.

### Task 5: Contrast and gate

- [ ] Playwright script in the scratchpad, against the dev server's preview route, with `launch()` and close in `finally`. It reads `getComputedStyle(card).backgroundColor` per case and per scheme and computes the contrast with white. Expected: every value ≥ 4.5.
- [ ] `make check-commit` PASS.
