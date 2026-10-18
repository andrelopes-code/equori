# Ledger sheet foundation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the ledger sheet presentation (theme, typeface, top navigation shell, money and date formats, tables with double-ruled totals) to every existing screen.

**Architecture:** Theme seeds and one theme rule carry colour and totals; `ui/money-figure`, `ui/figure-strip` and the `i18n/format` helpers carry figures and dates; `app/shell` swaps the side navigation for `TopNavigation` in the shell banner and a four-control bottom bar. Screens recompose from Slotted families on top of these.

**Tech Stack:** React 19, TanStack Router and Query, Slotted 0.1.0-beta.2, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-18-web-ledger-sheet-design.md` (decisions L1–L18).

## Global Constraints

- Rules O1–O8 of `CLAUDE.md` (`web/`) hold for every file.
- No `Card` or `StatCard` on R1 screens (L12); no decorative glyph in rows or navigation (L13).
- Accent colour only on forecast values; none in R1 (L10).
- Money: integer plus instrument scale, string conversion, never floating-point division (O7); negative sign U+2212 (L9).
- New dependencies: only `@fontsource-variable/geist@5.3.0` and `@fontsource-variable/geist-mono@5.3.0` (L2, ADR 011).
- Before each screen task, read `web/node_modules/@slotted/react/dist/docs/skills/compose-screen/SKILL.md` and the page of each family used.
- Commits: Conventional Commits, scope `web`; a commit that changes an existing test's expectation names the decision ID in its body.
- Gate per task: `pnpm -C web test`, `make web-check`; `make check` before each commit (pre-commit hook).

## Review Focus

- A currency with scale 0 (JPY) or a security ticker that `Intl` rejects in `formatMoneyParts`: the figure renders without a decimal part and without throwing. Test in Task 2.
- The N key typed inside a `contenteditable`, a `select`, or with a dialog open: no navigation. Test in Task 6.
- An amount of exactly zero: no minus sign, "0,00". Test in Task 2.
- A transactions page whose next page starts mid-day: the date cell does not repeat on the first row of the new page. Test in Task 8.
- A connection list where every `last_synced_at` is absent: the sync status renders nothing. Test in Task 4.

---

### Task 0: Branch

- [ ] Fast-forward `main` to the rebased `feat/web-cards` after its Go and web tests pass: `git merge --ff-only feat/web-cards`.
- [ ] `git switch -c feat/web-ledger-sheet`; commit the spec and this plan: `docs(web): specify the ledger sheet foundation`.

### Task 1: Theme seeds, totals rule and typeface (L1, L2, L11)

**Files:** Modify `web/src/theme/equori.theme.ts`, `web/src/theme/equori.theme.test.ts`, `web/src/main.tsx`, `web/package.json`, `web/pnpm-lock.yaml`; regenerate `web/src/theme/equori.gen.css`; create `docs/adr/011-web-typeface.md`.

- [ ] Test in `equori.theme.test.ts`: the compiled stylesheet contains a rule on `[data-ui="table"] [data-part="summary"]` with `double`; the seeds of the flattened theme equal L1.
- [ ] Run `pnpm -C web test`; expect FAIL on the new assertions.
- [ ] `equori.theme.ts`: `seeds: { accent: "#2dd4bf", neutral: "#71717a", warning: "#facc15", danger: "#f87171" }`; a theme rule for the summary cells: `border-block-start: calc(var(--slotted-border-width-thin) * 3) double var(--slotted-border-strong); font-weight: var(--slotted-font-weight-medium)`. Run `make gen`.
- [ ] `pnpm -C web add -E @fontsource-variable/geist@5.3.0 @fontsource-variable/geist-mono@5.3.0`; import both in `main.tsx` before `@/theme/equori.gen.css`.
- [ ] ADR 011: context (the default theme names Geist; no file ships it), decision (the two Fontsource packages, latin subset bundled, CSP `self`), consequences (≈ 70 kB of `woff2` in the binary).
- [ ] Run tests; expect PASS. Commit `feat(web): derive the theme from teal and zinc seeds with Geist`.

### Task 2: Money and date formats, MoneyText, MoneyFigure (L9, L10, L14)

**Files:** Modify `web/src/i18n/format.ts`, `web/src/i18n/format.test.ts`, `web/src/ui/money-text.tsx`, `web/src/ui/money-text.module.css`; create `web/src/ui/money-figure.tsx`, `web/src/ui/money-figure.module.css`, `web/src/ui/money-figure.test.tsx`.

**Interfaces (produced):**
- `formatMoney(m, scale, locale, options?: { symbol?: boolean }): string` — U+2212 for negatives; `symbol: false` drops the currency part.
- `formatMoneyParts(m, scale, locale): { sign: string; symbol: string; integer: string; fraction: string }` — `fraction` includes the decimal separator, empty at scale 0; `symbol` is the ticker for a code `Intl` rejects.
- `formatWeekdayDay(iso, locale)`: "sex 16" / "Fri 16". `formatDayMonth(iso, locale)`: "16 out" / "Oct 16". `formatDayHeader(iso, today, locale, t)`: `t("date.today")`, `t("date.yesterday")`, else "qua, 14 out" / "Wed, Oct 14".
- `MoneyText({ money, scale, symbol?: boolean })` — the `tone` prop is removed.
- `MoneyFigure({ money, scale, size?: "md" | "lg" | "xl", tone?: "accent" })`.

- [ ] Tests: `formatMoneyParts` for `{-5300,"BRL"}` pt-BR → `{sign:"−",symbol:"R$",integer:"53",fraction:",00"}`; en `{123456,"USD"}` → `{sign:"",symbol:"$",integer:"1,234",fraction:".56"}`; JPY scale 0 → `fraction:""`; zero → no sign; ticker `"PETR4"` → symbol `"PETR4"`. `formatMoney` negative pt-BR → `"−R$ 640,00"`; `symbol:false` → `"−640,00"`. Date helpers with `today="2026-10-16"`: `"2026-10-16"` → "Hoje", `"2026-10-15"` → "Ontem", `"2026-10-14"` → "qua, 14 out". `money-figure.test.tsx`: three parts in order for pt-BR and en.
- [ ] Run; expect FAIL.
- [ ] Implement with `Intl.NumberFormat(...).formatToParts(plain)`: `minusSign` → U+2212; `currency` → symbol; `integer` and `group` → integer; `decimal` and `fraction` → fraction; `literal` spaces dropped. Catalog keys `date.today`, `date.yesterday` in both catalogs.
- [ ] Remove `tone` from every `MoneyText` caller (L9); update the tests that asserted tones or hyphen-minus strings.
- [ ] Run; expect PASS. Commit `feat(web): format money with recessed cents and short dates`.

### Task 3: FigureStrip (L12)

**Files:** Create `web/src/ui/figure-strip.tsx`, `web/src/ui/figure-strip.module.css`, `web/src/ui/figure-strip.test.tsx`.

**Interfaces (produced):** `FigureStrip({ label: string, children })` renders a `dl` with `data-own="figure-strip"`; `FigureStripItem({ label: ReactNode, caption?: ReactNode, children })` renders `dt` label, `dd` figure and caption. CSS: equal columns (`grid-auto-flow: column; grid-auto-columns: minmax(0,1fr)`), a thin rule between items and under the strip; below 37.5rem of container width two columns.

- [ ] Test: three items render three `dt` and their figures; the `dl` carries the accessible label.
- [ ] Run (FAIL), implement following `skills/build-own-element/SKILL.md`, run (PASS). Commit with Task 4.

### Task 4: Connections query and sync status (L6)

**Files:** Create `web/src/features/connections/api.ts`, `index.ts`, `sync-status.tsx`, `sync-status.test.tsx`; modify `web/src/testing/fake-api.ts` when it lacks `/connections`; catalog key `sync.updated` ("Open Finance updated at {time}" / "Open Finance atualizado às {time}").

**Interfaces (produced):** `connectionsQuery(api)`; `SyncStatus()` renders `Text` `tone="muted"` `size="sm"` or `null`.

- [ ] Tests: two connections, the later `last_synced_at` renders `HH:mm` on the fixed day; an earlier day renders `formatDayMonth`; all `last_synced_at` absent renders nothing; a failed query renders nothing.
- [ ] Run (FAIL), implement, run (PASS). Commit `feat(web): show the latest Open Finance sync time` (with Task 3).

### Task 5: Shell (L4, L5, L7 button, L8)

**Files:** Create `web/src/app/shell/top-bar.tsx`, `web/src/app/shell/user-menu.tsx`; modify `app-frame.tsx`, `destinations.tsx`, `app-frame.test.tsx`, `web/src/ui/bottom-bar.tsx`, `bar-control.tsx`, `bottom-bar.module.css`; delete `side-nav.tsx`; catalog key `nav.overview`.

**Interfaces:** `BottomBarItem` loses `icon`, `shortLabel`, `emphasized`; gains `badge?: string`. `BottomBar({ items: readonly [BottomBarItem, BottomBarItem, BottomBarItem, BottomBarItem] })`. `useOpenAccountID(): string | undefined` in `app/shell/use-open-account-id.ts` holds the current route-account lookup of `app-frame.tsx`; `TopBar` and `useNewShortcut` (Task 6) read it. A page header button links to `/transactions/new` with the account the page already holds (O4: pages import nothing from `@/app`).

- [ ] Tests (`app-frame.test.tsx`, through `renderApp` at 1280, 768, 360): banner lists Overview, Transactions, Accounts, current one `aria-current="page"`; no `[data-ui="side-navigation"]`; at 360 four bottom-bar controls, no `svg` inside them; uncategorized badge text from the fake count, absent at zero, `5+` when `more`; account menu items Settings, Colour scheme, Language, Log out; "New" link `href` `/transactions/new`, with `account_id` on `/accounts/$id`.
- [ ] Run (FAIL).
- [ ] `TopBar`: `TopNavigation` with `value` from `bestMatch`, `TopNavigationBrand` → `TopNavigationHome` `render` router link → `TopNavigationName` "equori"; items with `render` router links and a `Badge` after the label; `TopNavigationActions`: `SyncStatus` (desktop only), `ButtonLink` "New" with `Kbd`, `UserMenu`.
- [ ] `UserMenu`: `TopNavigationAccount` as `Menu` trigger; items reuse the actions of `more-sheet.tsx` (navigate to settings, scheme radio group, language radio group, logout).
- [ ] `AppFrame`: `AppShell canvas="flush"`; at ≥ 600 `AppShellBanner` with `TopBar`; below 600 `AppShellFooter` with the four-control `BottomBar`; no `AppShellNav`.
- [ ] Page headers of Home, Transactions and Account page: on a phone, `ButtonLink tone="secondary" variant="solid"` "New"; at ≥ 600 no header button (the banner holds it).
- [ ] Update the existing navigation tests (side navigation, five controls, centre control); commit body cites L4, L5.
- [ ] Run (PASS). Commit `feat(web): move navigation into a top bar and a text bottom bar`.

### Task 6: N shortcut (L7)

**Files:** Create `web/src/app/shell/use-new-shortcut.ts`, `use-new-shortcut.test.tsx`; modify `app-frame.tsx`.

- [ ] Tests: `n` on the body navigates to `/transactions/new`; on `/accounts/$id` the search carries `account_id`; `n` inside `input`, `textarea`, `select`, `[contenteditable]`, with Ctrl, Meta or Alt, or with `[role="dialog"]` open does not navigate; `N` with Shift navigates.
- [ ] Run (FAIL); implement a `keydown` listener on `document` checking `event.key.toLowerCase() === "n"`, `event.isComposing`, the modifiers, `closest('input,textarea,select,[contenteditable=""],[contenteditable="true"]')` and `document.querySelector('[role="dialog"],[role="alertdialog"]')`; run (PASS).
- [ ] Commit `feat(web): open the new transaction form with the N key`.

### Task 7: Overview (L12, L17, L8)

**Files:** Modify `features/accounts/home-page.tsx`, `home-page.module.css`, `balances.tsx`, `balances-placeholder.tsx`, `account-groups.tsx`, `account-groups-placeholder.tsx`, their tests; delete `uncategorized-shortcut.tsx`; catalog `nav.overview` for the title.

- [ ] Tests: heading "Overview"; a `[data-own="figure-strip"]` with four labels from the fake groups; no `[data-ui="alert"]`; one `[data-ui="table"]` per group with its caption; recent transactions table with columns Date, Description, Amount.
- [ ] Run (FAIL); implement: `Balances` → `FigureStrip` of `MoneyFigure size="md"` (phone `md`, two columns); `AccountGroups` → `Table variant="plain"` per group with `TableCaption`, name cell as `Link`, balance cell end-aligned `MoneyText symbol` per L9; layout `minmax(0,1fr) minmax(0,1.3fr)` gap `--slotted-space-8` from 64rem container width.
- [ ] Run (PASS). Commit `feat(web): recompose the overview as a ledger sheet`.

### Task 8: Transactions list (L13–L16)

**Files:** Modify `features/transactions/transaction-list.tsx`, `transaction-list.module.css`, `placeholder-rows.tsx`, `transactions-page.tsx`, `transaction-list.test.tsx`; catalog keys `transactions.column.{date,description,category,amount}`, `transactions.review`, `transactions.transfer`.

- [ ] Tests at 1280: table headers Date, Description, Category, Amount; two rows on one day → the date text once; an uncategorized expense → "review" in the Category cell; a transfer → "Transfer" and the counter account in the description; base-currency amount without "R$", a USD amount with "US$"; rows of a second page starting on the last day of page one carry no date; no `svg` in rows. At 360: day headers "Hoje" and "Ontem" against the fixed today; second line "category · account".
- [ ] Run (FAIL).
- [ ] Desktop: `Table variant="plain" stickyHeader stickyTo="page"`; description cell holds the router `Link` to `/transactions/$id`; day boundary rule through `data-day-start` on the first row of a day, styled in the module CSS on the app's own attribute (O5 holds: it targets no `data-ui`/`data-part`) — if `TableRow` does not forward the attribute, use the `ruled` variant instead and drop the rule-less in-day rows.
- [ ] Phone and tablet: keep `List`/`ListSection` with `formatDayHeader` labels; remove `ListItemStart` glyphs; `ListItemDescription` "category · account" with `Text tone="warning"` "review".
- [ ] Base currency from `settingsQuery` of `features/setup` (export it from `index.ts` if absent).
- [ ] Run (PASS). Commit `feat(web): render the transactions list as a ledger table`.

### Task 9: Accounts, account, transaction pages and login (L18)

**Files:** Modify `features/accounts/accounts-page.tsx`, `account-page.tsx`, `account-balances.tsx`, `account-history.tsx`, `features/transactions/transaction-details.tsx`, `transaction-page.tsx`, `features/session/login-page.tsx`, their tests.

- [ ] Tests: accounts page group tables each close with a `tfoot` row holding the group total; account page header figure parts; transaction page amount as `MoneyFigure`, details as `[data-ui="description-list"]`; login shows "equori".
- [ ] Run (FAIL), implement, run (PASS). Commit `feat(web): apply the ledger sheet to accounts and transaction pages`.

### Task 10: Visual verification

- [ ] `make web-build`; restart the review server (`/tmp/claude-1000/transactions/run.sh build`); screenshot `/`, `/transactions`, `/accounts`, `/accounts/$id`, `/transactions/$id`, `/settings`, the card overview, `/login` at 360, 768, 1280 in pt-BR and en.
- [ ] Check: no horizontal scroll (`scrollWidth === innerWidth`), L4–L18 against the prototype screenshots. Fix defects with a failing test first when the defect is behavioural.
- [ ] `make check`; write `.claude/progress/current.md`.
