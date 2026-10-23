# Privacy mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One switch hides every monetary amount of the web application, on every screen, and a lint rule keeps new code from bypassing it.

**Architecture:** Masking happens in a single choke point: a `useMoneyFormat()` hook that wraps the pure formatters of `@/i18n/format` and returns masked output while privacy is on. The real amount never reaches the DOM, so hiding is not a CSS blur and survives copy, screenshots, accessibility tree and DevTools. A `PrivacyProvider` holds the preference (per browser, `localStorage`). ESLint rule O9 forbids importing the unmasked formatters outside `src/i18n` and `src/privacy`, so a new screen cannot show an amount without passing through the hook.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, ESLint flat config, `@slotted/react`.

**Spec:** Design section of this plan (the owner delegated the design in conversation, 2026-10-22).

## Design decisions

- **Where masking lives.** `formatMoney`, `formatMoneyParts` and `formatSigned` stay pure (explicit parameters, no global state, `format.test.ts` untouched). `useMoneyFormat()` is the only caller of them in application code.
- **What the mask shows.** Currency symbol kept, sign dropped, digits replaced by the fixed string `••••` (`MASK`). The mask has the same length for every amount, so the digit count and the direction of a movement do not leak.
- **Fail-closed default.** The context default is `hidden: true`. A component rendered without `PrivacyProvider` shows masks, never amounts; a missing provider shows up in the first test.
- **Persistence.** `localStorage` key `equori.privacy`, value `hidden`; any other value or a storage error means visible. The provider reads it synchronously in the `useState` initializer, so the first paint after a reload is already masked. A `storage` event keeps other tabs in step. No boot script: amounts exist only after React renders.
- **Money input stays readable.** `ui/money-input` shows what the person types; it uses only the symbol and gap of the parts.
- **Charts.** Axis labels, tooltips, legends and accessible names go through the hook and are masked. The bar and line shapes stay (relative magnitude remains visible); blurring shapes is out of scope.
- **Toggle.** An eye / eye-off `IconButton` (`aria-pressed`) in the phone `TopAppBar` end slot and an item in the desktop `AccountMenu`; one entry in the command palette. No keyboard shortcut.
- **Not masked.** Percentages, counts, dates, account names, `formatPlain` (API payload text), `parseAmount`, `symbolGap`.

## Global Constraints

- O6: no literal text in JSX; every label comes from `useT()` with keys in both `catalog.en.ts` and `catalog.pt-BR.ts`.
- O5: CSS in co-located `*.module.css` inside `@layer app`, `var(--slotted-*)` only.
- O1: one component per file, kebab-case file names.
- O7: money stays integer plus instrument code; masking never touches the number type.
- Grid props keep their identity (`web/CLAUDE.md`, Screens): `useMoneyFormat()` returns a memoised object whose identity changes only with `locale` or `hidden`.
- A behaviour change starts with a test that fails first. No test is deleted or loosened.
- Commits: `feat(web): ...` / `refactor(web): ...`, one vertical slice each, no mention of tools.
- `web/src/features/admin/{draft,operations,use-admin-context}.ts`, `admin-page.test.tsx`, `web/package.json` and `web/pnpm-lock.yaml` carry uncommitted changes of the owner. Task 8 touches the admin feature only after those changes are committed.

## Review Focus

1. A masked page must not contain an amount in attributes (`aria-label`, `title`, `data-*`), not only in text: tests assert on `innerHTML`.
2. Toggling while a memoised grid is mounted must re-render the cells (`transactions-grid`).
3. A reload with `equori.privacy=hidden` must never render an amount, not even for one frame.
4. `localStorage` that throws on read or write must leave the app usable, visible by default, and the toggle working for the session.
5. Negative, zero and non-ISO-currency (security ticker) amounts mask to the same string as any other amount of that currency.

## Slices

A slice is at most three tasks and ends with a checkpoint in `.claude/progress/current.md`.

- Slice 1: Tasks 1, 2, 3.
- Slice 2: Tasks 4, 5, 6.
- Slice 3: Tasks 7, 8, 9.

---

### Task 1: Privacy store, mask and money-format hook

**Files:**
- Create: `web/src/privacy/privacy-provider.tsx`, `web/src/privacy/mask.ts`, `web/src/privacy/use-money-format.ts`
- Test: `web/src/privacy/privacy-provider.test.tsx`, `web/src/privacy/mask.test.ts`, `web/src/privacy/use-money-format.test.tsx`
- Modify: `web/src/app/providers.tsx` (mount `PrivacyProvider` inside `I18nProvider`'s scope; any position above the router)

**Interfaces:**
- Produces:
  - `export const MASK = "••••"` in `mask.ts`
  - `export function maskParts(parts: MoneyParts): MoneyParts` (sign `""`, integer `MASK`, fraction `""`, symbol kept)
  - `export function maskText(parts: MoneyParts): string` (`` `${symbol} ${MASK}` ``)
  - `export function PrivacyProvider({ children }: { children: ReactNode }): JSX.Element`
  - `export function usePrivacy(): { hidden: boolean; setHidden: (hidden: boolean) => void; toggle: () => void }`
  - `export interface MoneyFormat { hidden: boolean; money(m: Money, scale: number, options?: { symbol?: boolean }): string; signed(m: Money, scale: number, options?: { symbol?: boolean }): string; parts(m: Money, scale: number): MoneyParts }` where `Money = { amount: number; currency: string }`
  - `export function useMoneyFormat(): MoneyFormat`

- [ ] **Step 1: Write the failing tests**
  - `mask.test.ts`: `maskText` of parts for `-1234.50 BRL`, `0 BRL` and `5 BRL` returns the same string `R$ ••••`; `maskParts` returns `sign: ""`, `fraction: ""`, `integer: "••••"`; a ticker (`symbol: "PETR4"`) keeps `PETR4`.
  - `privacy-provider.test.tsx`: (a) with no storage entry, `hidden` is `false`; (b) with `equori.privacy=hidden` the first render already has `hidden === true`; (c) `toggle()` writes `hidden`, a second `toggle()` removes the key; (d) a `storage` event for `equori.privacy` updates `hidden`; (e) with `localStorage.getItem` and `setItem` stubbed to throw, `hidden` is `false` and `toggle()` still flips it; (f) a consumer outside the provider reads `hidden === true`.
  - `use-money-format.test.tsx`: visible, `money({amount: 123456, currency: "BRL"}, 2)` in locale `pt-BR` equals `formatMoney` output (`R$ 1.234,56` with the locale's own gap); hidden, it equals `R$ ••••`; `signed` of `+500` hidden has no `+`; `parts().integer` hidden is `MASK`; the returned object keeps identity across re-renders with unchanged `locale` and `hidden`.
- [ ] **Step 2: Run `cd web && pnpm vitest run src/privacy`** — Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** the files above. The provider keeps `hidden` in `useState(read)`; `read` and the write are wrapped in `try/catch` like `theme/density.ts`; the `storage` listener is added in `useEffect`. `useMoneyFormat` reads `useAppLocale()` and `usePrivacy()` and builds its object in `useMemo` over `[locale, hidden]`, calling `formatMoney`, `formatSigned`, `formatMoneyParts` from `@/i18n/format` and the mask functions.
- [ ] **Step 4: Re-run the command of Step 2** — Expected: PASS. Then run `cd web && pnpm vitest run src/app` — Expected: PASS (providers still compose).
- [ ] **Step 5: Commit** `feat(web): add the privacy preference and the masked money format`

### Task 2: Privacy toggle in the shell

**Files:**
- Create: `web/src/ui/privacy-toggle.tsx`, `web/src/ui/privacy-toggle.test.tsx`
- Modify: `web/src/app/shell/top-app-bar.tsx`, `web/src/app/shell/account-menu.tsx`, `web/src/app/shell/command-menu.tsx`, `web/src/app/shell/shell-icon.tsx` (names `eye`, `eye-off`), `web/src/i18n/catalog.en.ts`, `web/src/i18n/catalog.pt-BR.ts`, `web/src/app/shell/app-frame.test.tsx`

**Interfaces:**
- Consumes: `usePrivacy()` from Task 1.
- Produces: `export function PrivacyToggle(): JSX.Element` — an `IconButton` with `aria-pressed={hidden}` and `aria-label` `t("privacy.show")` when hidden, `t("privacy.hide")` when visible. Catalog keys: `privacy.hide` ("Hide amounts" / "Ocultar valores"), `privacy.show` ("Show amounts" / "Mostrar valores"), `privacy.command` (palette entry, same two texts).

- [ ] **Step 1: Write the failing tests**
  - `privacy-toggle.test.tsx`: renders under `renderWithProviders`; the button is named "Hide amounts" with `aria-pressed="false"`; after a click it is named "Show amounts" with `aria-pressed="true"` and `localStorage.getItem("equori.privacy") === "hidden"`.
  - `app-frame.test.tsx`: at 390 px the top bar holds the toggle; at 1280 px the account menu holds an item that flips the state; the command palette lists the entry and running it flips the state.
- [ ] **Step 2: Run `cd web && pnpm vitest run src/ui/privacy-toggle.test.tsx src/app/shell/app-frame.test.tsx`** — Expected: FAIL.
- [ ] **Step 3: Implement** the component, icons and placements. Follow `account-menu.tsx` for the menu item and `command-menu.tsx` for the entry shape. Read the Slotted `menu` and `icon-button` family files before using them. A Slotted gap found here is a finding under the rules of `web/CLAUDE.md`.
- [ ] **Step 4: Re-run Step 2's command, then `make web-check`** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): add the privacy toggle to the shell`

### Task 3: Leak-test harness

**Files:**
- Create: `web/src/testing/privacy.ts`, `web/src/testing/privacy.test.ts`

**Interfaces:**
- Produces:
  - `export function hideAmounts(): void` — `localStorage.setItem("equori.privacy", "hidden")`; called before `renderApp`.
  - `export function expectNoAmounts(container: HTMLElement, known: readonly string[]): void` — fails when `container.innerHTML` (attributes included) contains any string of `known`, or matches `/\d[.,]\d{2}(?!\d)/` outside `datetime` attributes; the failure message lists the first 5 matches with 40 characters of context.

- [ ] **Step 1: Write the failing test** `privacy.test.ts`: a container with `<span>R$ 1.234,56</span>` fails; with `<span aria-label="R$ 1.234,56">` fails; with `R$ ••••` passes; with a date `21/10/2026` passes.
- [ ] **Step 2: Run `cd web && pnpm vitest run src/testing/privacy.test.ts`** — Expected: FAIL.
- [ ] **Step 3: Implement** both functions.
- [ ] **Step 4: Re-run** — Expected: PASS.
- [ ] **Step 5: Commit** `test(web): add the privacy leak-test helpers`

---

### Task 4: Migrate shared UI and the transactions feature

**Files:**
- Modify: `web/src/ui/money-figure.tsx`, `web/src/ui/money-input.tsx`, every non-test file of `web/src/features/transactions/` listed by `grep -lE "formatMoney|formatMoneyParts|formatSigned" web/src/features/transactions`
- Test: the existing `*.test.tsx` of those files plus `web/src/features/transactions/privacy.test.tsx` (new)

**Interfaces:**
- Consumes: `useMoneyFormat`, `hideAmounts`, `expectNoAmounts`.
- Migration rule (applies to Tasks 4 to 8): a component replaces `const [locale] = useAppLocale()` plus `formatMoney(m, scale, locale)` with `const { money } = useMoneyFormat()` plus `money(m, scale)`; `formatSigned` becomes `signed`, `formatMoneyParts` becomes `parts`. A plain function or a module-level helper that took `locale` for money takes a `MoneyFormat` instead. Imports left unused are removed. `useAppLocale` stays where dates or other formats need it.

- [ ] **Step 1: Write the failing test** `privacy.test.tsx`: with `hideAmounts()` and the fake API fixtures used by `transactions-page.test.tsx`, `renderApp("/transactions")`, then `expectNoAmounts(container, [<every amount string asserted by transactions-page.test.tsx>])`; open a transaction detail and the new-transaction form and repeat; toggle the button and assert the grid cells show the amounts again, then hide again and assert none remain (Review Focus 2).
- [ ] **Step 2: Run `cd web && pnpm vitest run src/features/transactions/privacy.test.tsx`** — Expected: FAIL with leaked amounts.
- [ ] **Step 3: Migrate** the files. `money-input.tsx` keeps the typed value visible and takes only `symbol` and gap from `parts()`.
- [ ] **Step 4: Run `cd web && pnpm vitest run src/features/transactions src/ui`** — Expected: PASS, including the unchanged existing tests.
- [ ] **Step 5: Commit** `feat(web): mask amounts in transactions and shared figures`

### Task 5: Migrate the accounts feature

**Files:**
- Modify: every non-test file of `web/src/features/accounts/` listed by the grep of Task 4 (includes `balance-chart.tsx`, `balance-series.ts`, `account-card-money.ts`)
- Test: `web/src/features/accounts/privacy.test.tsx` (new)

- [ ] **Step 1: Write the failing test**: hidden, `renderApp` on the accounts page, an account page (ledger, positions, reconciliation, scheduled, imports tabs) and the batch page; `expectNoAmounts` on each, including chart axis labels and tooltips (hover the chart through the helper existing tests use). A positions row with a security ticker must show `PETR4 ••••`-style masks, not digits.
- [ ] **Step 2: Run `cd web && pnpm vitest run src/features/accounts/privacy.test.tsx`** — Expected: FAIL.
- [ ] **Step 3: Migrate** following the rule of Task 4.
- [ ] **Step 4: Run `cd web && pnpm vitest run src/features/accounts`** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): mask amounts in accounts`

### Task 6: Migrate the cards feature

**Files:**
- Modify: every non-test file of `web/src/features/cards/` listed by the grep of Task 4
- Test: `web/src/features/cards/privacy.test.tsx` (new)

- [ ] **Step 1: Write the failing test**: hidden, the cards page, statements tab (chart included), plans tab, settings tab, and the pay, refund, finance, installment and reconcile dialogs; `expectNoAmounts` on each.
- [ ] **Step 2: Run `cd web && pnpm vitest run src/features/cards/privacy.test.tsx`** — Expected: FAIL.
- [ ] **Step 3: Migrate** following the rule of Task 4.
- [ ] **Step 4: Run `cd web && pnpm vitest run src/features/cards`** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): mask amounts in cards`

---

### Task 7: Migrate the categories feature

**Files:**
- Modify: `web/src/features/categories/{category-charts.tsx,category-tree.tsx,figures-row.tsx,pending-card.tsx,use-rule-words.ts}` and any other file the grep of Task 4 lists
- Test: `web/src/features/categories/privacy.test.tsx` (new)

- [ ] **Step 1: Write the failing test**: hidden, the categories page with charts and tree, the pending card, and the rule editor sentence built by `use-rule-words`; `expectNoAmounts` on each.
- [ ] **Step 2: Run `cd web && pnpm vitest run src/features/categories/privacy.test.tsx`** — Expected: FAIL.
- [ ] **Step 3: Migrate** following the rule of Task 4. `Intl.NumberFormat` uses for percentages and counts stay.
- [ ] **Step 4: Run `cd web && pnpm vitest run src/features/categories`** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): mask amounts in categories`

### Task 8: Migrate the admin feature

**Precondition:** `git status` shows no uncommitted change under `web/src/features/admin/`. If it does, stop the slice and report it.

**Files:**
- Modify: `web/src/features/admin/{use-display.ts,draft.ts,cell-text.ts,rule-text.ts}` and any other file the grep of Task 4 lists
- Test: `web/src/features/admin/privacy.test.tsx` (new)

- [ ] **Step 1: Write the failing test**: hidden, the admin page tables and headline figures; `expectNoAmounts`.
- [ ] **Step 2: Run `cd web && pnpm vitest run src/features/admin/privacy.test.tsx`** — Expected: FAIL.
- [ ] **Step 3: Migrate**: `useDisplay().money` delegates to `useMoneyFormat()`.
- [ ] **Step 4: Run `cd web && pnpm vitest run src/features/admin`** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): mask amounts in admin`

### Task 9: Enforce with O9 and document

**Files:**
- Modify: `web/eslint.config.js`, `web/src/testing/lint-rules.test.ts`, `web/CLAUDE.md` (rule O9 in the Rules table), `docs/adr/018-privacy-mode.md` (create)

**Interfaces:**
- Produces: ESLint rule O9 — `no-restricted-imports` path `{ name: "@/i18n/format", importNames: ["formatMoney", "formatMoneyParts", "formatSigned"], message: "Amounts are formatted through useMoneyFormat() (O9)." }`, appended to the `paths` of every block through the `restrict` helper, and omitted for `src/i18n/**`, `src/privacy/**` and `**/*.test.{ts,tsx}`.

- [ ] **Step 1: Write the failing test**: rows in `lint-rules.test.ts`: `src/ui/x.tsx` importing `formatMoney` from `@/i18n/format` reports `no-restricted-imports`; `src/features/accounts/x.ts` importing `formatSigned` reports it; `src/ui/y.tsx` importing `parseAmount` reports nothing; `src/ui/w.test.tsx` importing `formatMoney` reports nothing.
- [ ] **Step 2: Run `cd web && pnpm vitest run src/testing/lint-rules.test.ts`** — Expected: FAIL on the first two rows.
- [ ] **Step 3: Implement** the lint path and the exemption block. Add O9 to `web/CLAUDE.md` (Gate: `ESLint no-restricted-imports`) and write ADR 018 (context, decision, consequences: the choke point, fail-closed default, what is not masked, how to add a new formatter).
- [ ] **Step 4: Run `make check`** — Expected: PASS with no remaining direct import of the three formatters outside the exempt paths.
- [ ] **Step 5: Commit** `build(web): forbid unmasked money formatters outside i18n and privacy`
