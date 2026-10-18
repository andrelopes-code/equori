# Web redesign, sub-project 1: ledger sheet foundation

- Date: 2026-10-18
- Branch: `feat/web-ledger-sheet`, from `main` after `feat/web-cards` is merged
- Depends on: `docs/superpowers/specs/2026-10-17-web-foundation-ledger-design.md` (stack K1–K7, rules O1–O8, data, error and i18n policy). This spec replaces its section 2 navigation table and the money tones of its section 3; everything else stands.
- Source: the owner's prototype "Conceito B v3, livro-caixa" (`tmp/App de Gestão Financeira.zip`, untracked: an HTML reference and a handoff README). The prototype is a visual reference, not a feature list. A screen shows only what the HTTP API serves.

## Intent

The interface reads as a ledger sheet: sections separated by thin rules and space instead of cards, almost monochrome, figures in tabular numerals with recessed cents, totals closed by a double rule. The accent colour is reserved for forecast values. This sub-project changes the theme, the typeface, the application frame and the shared money and date presentation, and applies them to the screens that exist today. Later sub-projects add the prototype screens that need new client work.

## Redesign track

| ID | Sub-project | API it reads |
|---|---|---|
| R1 | Ledger sheet foundation (this spec) | existing reads only, plus `listConnections` |
| R2 | Overview: projected month-end balance, lowest balance, step chart of the daily balance, occurrences until month end, budget progress | `/accounts/{id}/projection`, `/occurrences`, `/budgets`, `/budgets/{id}/progress` |
| R3 | Statement: detail panel beside the list, category change with an undo toast, daily balance column for one account, occurrences above a "Today" divider | `/transactions`, `/transactions/{id}/categorize`, `/reports/balances`, `/occurrences` |
| R4 | Card bill: the card overview of `feat/web-cards` in sheet form, billing cycle chart, committed installments | `/accounts/{id}/statements`, `/statements/{id}`, `/accounts/{id}/commitments` |
| R5 | Goals: saved, target, monthly contribution, completion date | `/goals` |
| R6 | Quick entry: free-text entry dialog opened by the N key | `POST /transactions` |

Each of R2–R6 gets its own spec. The specs `2026-10-18-web-cards-design.md`, `2026-10-18-web-planning-design.md`, `2026-10-18-web-import-classification-design.md` and `2026-10-18-web-investments-reports-design.md` keep their scope; their screens follow the presentation rules L1–L14 of this spec.

## Decisions

| ID | Decision |
|---|---|
| L1 | Theme seeds in `theme/equori.theme.ts`: accent `#2dd4bf`, neutral `#71717a`, warning `#facc15`, danger `#f87171`; the success seed stays the default one. Every colour derives from the seeds; `themeConformance` passes for each scheme. |
| L2 | Typeface: Geist Variable and Geist Mono Variable, the families the default theme already names in `--slotted-font-family-sans` and `--slotted-font-family-mono`. They ship from `@fontsource-variable/geist` and `@fontsource-variable/geist-mono` (OFL-1.1), imported once in `main.tsx`; Vite bundles their `woff2` files into the binary. ADR 011 records the dependency. |
| L3 | Scheme and density rules of the ledger spec stand: dark by default, light and system selectable; `compact` at ≥ 1024 px, `comfortable` below. |
| L4 | Shell at ≥ 600 px: `AppShell` with `canvas="flush"` and no navigation region. `AppShellBanner` holds `TopNavigation`: brand "equori" linking to `/`; destinations Overview (`/`), Transactions (`/transactions`) and Accounts (`/accounts`); actions: sync status (L6), the "New" button (L7) and an account menu. The account menu holds Settings, Colour scheme, Language and Log out, the entries of the current More sheet. `side-nav.tsx` is removed. |
| L5 | Shell below 600 px: no banner. `AppShellFooter` holds `ui/bottom-bar` with four text-only controls: Overview, Transactions, Accounts, More. The current control is marked by the full text colour and an edge on the bar's top rule. More opens the existing action sheet. The page header of Overview, Transactions and an account page carries the "New" button. |
| L6 | Sync status: muted text "Open Finance updated at 09:37" from the latest `last_synced_at` of `listConnections`. The time reads `HH:mm` on the current day and a short date otherwise. Without a connection that has `last_synced_at`, nothing renders. Shown in the banner actions at ≥ 1024 px. |
| L7 | "New" opens `/transactions/new`, with `account_id` preselected on an account page. At ≥ 600 px it is `Button` `tone="secondary"` `variant="outline"` with `Kbd` "N"; on a phone it is `Button` `tone="secondary"` `variant="solid"`. The N key opens the same route from every authenticated route, except when focus is in an editable element or an overlay is open, and except with a modifier key held. |
| L8 | Uncategorized count: the `uncategorized-count` query renders as `Badge` `tone="warning"` `size="sm"` beside the Transactions destination, in the banner and in the bottom bar. The count is hidden at zero and reads `N+` when the query reports more. The Home alert `UncategorizedShortcut` is removed. |
| L9 | Money in a column or a row: neutral text colour for every sign; the `flow` and `balance` tones of `MoneyText` are removed. A negative amount starts with U+2212 MINUS SIGN. An amount in the user's base currency omits the currency symbol inside a table column whose header names the value; an amount in another currency keeps its symbol. |
| L10 | Headline figure, own element `ui/money-figure`: the currency symbol at 0.5 em in the muted text colour, the integer part at the full size, the decimal separator and the minor digits at 0.6 em with 50 % opacity. The parts come from `Intl.NumberFormat.formatToParts` over the string conversion of O7. Sizes `md`, `lg`, `xl` map to the `2xl`, `3xl` and `4xl` steps of the font-size scale, at weight medium with letter spacing −0.03 em. `tone="accent"` exists for forecast figures of R2 and is unused in R1. |
| L11 | Totals: a theme rule in `equori.theme.ts` draws the `summary` part (`tfoot`) of `table` with a double top rule of three thin border widths in `--slotted-border-strong` and weight medium. Lists of R1 that close with a total use a `Table` with a summary row. |
| L12 | Surfaces: no `Card` and no `StatCard` on R1 screens. Figures of the Overview stand in an own element `ui/figure-strip`: equal columns separated by thin vertical rules, a rule under the strip; label in muted `sm` text, figure as `MoneyFigure`, caption in muted `xs` text. Sections are `Section` with a title and a thin rule. |
| L13 | Glyphs: rows, lists and navigation carry no decorative icon. The direction arrows of transaction rows are removed. `IconGlyph` remains only inside icon-only buttons. Categories are text. |
| L14 | Dates: the date column of a table and a day header on a phone read "Hoje", "Ontem" or weekday, day and month ("qua, 14 out"; "Today", "Yesterday", "Wed, Oct 14" in en). In a table the date appears only on the first row of its day. Captions read day and month ("16 out", "Oct 16"). The ISO date stays in the `dateTime` of a `time` element. |
| L15 | Transactions list at ≥ 1024 px: `Table` (ruled), columns Date (L14), Description, Category, Amount (end-aligned, L9). Description is the transaction description followed by " · account name" in muted text when no account filter is set. An uncategorized expense or income shows "review" in warning text in the Category column. A transfer shows "Transfer" in muted text and the counter account in the description suffix. A voided transaction keeps its strikethrough. Loading more keeps the current cursor pagination. |
| L16 | Transactions list below 1024 px: grouped by day with a day header (L14); each row is the description on the first line, "category · account" in muted `xs` text on the second, with "review" in warning text for an uncategorized one, and the amount at the row end. |
| L17 | Overview in R1: page header "Overview"; a figure strip of the four balance groups (Available, Reserves, Cards, Loans) with captions from the current balance-groups data; below, two columns from 64 rem of content width (`1.3fr 1fr`, gap `--slotted-space-11`) and one column below: Recent transactions as a table (Date, Description, Amount) and Accounts as one table per balance group, the group name as its caption, an account per row, no summary row. |
| L18 | Accounts page: one table per balance group with a summary row holding the group total (L11). Account page: the same table rules (L9, L13, L14); its header shows the balance as `MoneyFigure` `lg`. Transaction page: the amount as `MoneyFigure` `lg`, details as `DescriptionList` `variant="ruled"`. Settings and login keep their structure; login shows the "equori" wordmark. |

## Files

| Path | Change |
|---|---|
| `web/package.json` | add `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`, exact versions |
| `web/src/main.tsx` | import both font packages before the theme stylesheet |
| `web/src/theme/equori.theme.ts`, `equori.gen.css` | seeds (L1), summary rule (L11); regenerated by `make gen` |
| `web/src/app/shell/app-frame.tsx` | shell L4, L5 |
| `web/src/app/shell/top-bar.tsx` | new: `TopNavigation` composition |
| `web/src/app/shell/user-menu.tsx` | new: account menu of L4 |
| `web/src/app/shell/use-new-shortcut.ts` | new: N key of L7 |
| `web/src/app/shell/destinations.tsx` | icons removed; Overview label |
| `web/src/app/shell/side-nav.tsx` | removed |
| `web/src/ui/bottom-bar.tsx`, `bar-control.tsx`, `bottom-bar.module.css` | four text controls with an optional badge (L5, L8) |
| `web/src/ui/money-figure.tsx`, `money-figure.module.css` | new (L10) |
| `web/src/ui/figure-strip.tsx`, `figure-strip.module.css` | new (L12) |
| `web/src/ui/money-text.tsx` | tones removed, symbol option (L9) |
| `web/src/i18n/format.ts` | `formatMoneyParts`, `formatDayMonth`, `formatDayHeader`, U+2212 sign |
| `web/src/features/connections/{api.ts,index.ts,sync-status.tsx}` | new (L6) |
| `web/src/features/accounts/*` | Overview, accounts and account page (L12, L17, L18); `uncategorized-shortcut.tsx` removed |
| `web/src/features/transactions/*` | list (L15, L16), transaction page (L18) |
| `docs/adr/011-web-typeface.md` | new (L2) |

## Tests

- `format.test.ts`: `formatMoneyParts` for pt-BR and en, positive, negative (U+2212), zero, and a currency with scale 0; `formatDayMonth`, `formatDayHeader` (today, yesterday, other day) against a fixed date passed to `TodayProvider`.
- `money-figure.test.tsx`: the three parts render in order with the expected text for pt-BR and en.
- `app-frame.test.tsx`: at 1280 and 768 the banner lists Overview, Transactions, Accounts with `aria-current` on the current one and no side navigation; at 360 the bottom bar holds exactly four controls with no icon; the badge shows the uncategorized count and is absent at zero; the account menu lists Settings, Colour scheme, Language, Log out.
- `use-new-shortcut.test.tsx`: N navigates to `/transactions/new`; N inside a text field, with Ctrl or Meta held, or with a dialog open does not navigate; on an account page the route carries `account_id`.
- `sync-status.test.tsx`: latest `last_synced_at` of two connections renders; same day reads `HH:mm`; an earlier day reads the short date; no connection renders nothing.
- `transaction-list.test.tsx`: desktop table columns and order; the date appears once per day; "review" for an uncategorized row; transfer row; base-currency amounts without symbol and a foreign one with symbol; phone day headers "Hoje" and "Ontem".
- `home-page.test.tsx`: figure strip of four groups; no alert; one account table per group.
- `accounts-page.test.tsx`: each group table closes with a summary row holding the group total.
- `equori.theme.test.ts`: `themeConformance` passes with the new seeds; the compiled stylesheet contains the summary rule.
- Existing tests that assert the side navigation, the five-control bottom bar, the money tones, the arrows or the old date strings change with this spec; each such change cites the decision ID in the commit body.

## Verification

- `make check` passes.
- Each route of the ledger spec section 3, plus the card overview, renders at 360, 768 and 1280 px with no horizontal scroll, in pt-BR and en, against the review account of the dev server; the screenshots are compared with the prototype for L4–L18.

## Out of scope

The prototype elements that R2–R6 own: projected balance, balance chart, occurrences, budgets, goals, card bill, quick entry, detail panel, undo toast, daily balance column, month selector.
