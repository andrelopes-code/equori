# Contribution plan

- Status: proposed
- Date: 2026-11-12
- Module: `portfolio`; rules CN1 to CN16; scenarios S398 to S407

## Intent

An investor sets aside an amount each month (for example 1,500.00) and splits it among asset classes: fixed income, domestic stocks, foreign stocks, real estate funds. The target split comes from several sources: the investor's own notes, a broker's recommended portfolio, memory. equori holds no target split. The portfolio page shows the current split by instrument type, currency or institution (`internal/portfolio/app/allocation.go`). An instrument type does not separate a domestic stock from a foreign stock, and no screen answers the question of a contribution: how much of this amount goes to each class to bring the portfolio closer to the target.

The contribution plan stores a target split by class, optionally by asset inside a class, and computes the split of one contribution without any sale.

Expense planning is outside this spec: the budget plan (`docs/specs/2026-10-27-budget-plan-design.md`), schedules and the savings target (`docs/specs/2026-11-01-savings-target-design.md`) cover it.

## Goals, non-goals, anti-goals

Goals:

- G1. The investor names classes and gives each a target share; the shares add up to 100%.
- G2. Each investment of the book belongs to at most one class. An asset not yet held can be a member of a class.
- G3. For an amount, the screen returns the amount per class and, when the class has member targets, per member.
- G4. A change of a target share recomputes the split on screen before the save.
- G5. The screen shows, per class, the target share, the current share and the difference in percentage points.

Non-goals:

- Recording the purchases from this screen. The trade form records them.
- A history of contributions or of past targets.
- More than one plan per book.
- Importing a recommended portfolio from a provider.
- Taxes and trading costs in the split.
- A phone layout. The portfolio screens are desktop-only (ADR 027).

Anti-goals:

- A split that sells. The contribution only directs new money (CN7).
- A member without a price or a rate counted as zero (CN10).
- Target shares not derived from the investor's own data (CN12).
- Any amount in the DOM while privacy mode is on (ADR 018).

## Rules

**CN1 Plan.** A book has zero or one plan. The plan holds an ordered list of classes and an optional contribution amount with its currency. A save replaces the whole plan in one transaction.

**CN2 Class.** A class has a name of 1 to 60 characters, unique in the book ignoring case, and a target share in basis points between 0 and 10000. The plan holds at most 20 classes. The targets of the classes add up to exactly 10000; otherwise the save returns `contribution_target_sum`. A duplicate name returns `contribution_class_name_duplicate`.

**CN3 Member.** A member belongs to one class and names exactly one of:

- `account_id`: an asset account of kind `savings`, `reserve` or `brokerage`, without children, whose instrument is of type `currency` (a CDB, a savings deposit, a treasury bond recorded as a balance, the cash account of a brokerage);
- `instrument`: a security of the catalog, held or not.

Any other account or instrument returns `contribution_member_invalid`. An account or an instrument appears in at most one member of the plan; a repetition returns `contribution_member_duplicate`.

**CN4 Member targets.** Inside a class, either no member has a target, or every member has one and the targets add up to 10000. Any other case returns `contribution_member_target_sum`. A class with member targets splits its amount among members (CN8); a class without them returns one amount for the class.

**CN5 Values.** The current value of a member is valued at today (`platform/clock`, book time zone) in the base currency with the conversion of `Allocation` (`MarketData.Convert`), one account at a time, so a missing price affects only its member (CN10):

- an `account_id` member: the balance of that account;
- an `instrument` member: the sum of the holding accounts of that instrument in every brokerage of the book; zero when none is held.

The value of a class is the sum of its members. The current share of a class is its value over the sum of all classes, in basis points, by `domain.Allocate`.

**CN6 Outside the plan.** A holding account (an account that holds a security) with a non-zero balance whose instrument matches no member, and an account eligible under CN3 with a non-zero balance that matches no member, is listed as outside the plan with its value. A holding is listed by instrument, with the sum of its holding accounts. Its value enters no class and no share.

**CN7 Split without sale.** For classes with targets `t_i` (basis points), values `v_i` and a contribution `C`, all in minor units of the base currency, the split is `a_i = max(0, λ·t_i/10000 − v_i)`, where `λ` is the single level for which `Σ a_i = C`. Classes are funded in increasing order of `v_i/t_i`; a class with `t_i = 0` gets nothing. `λ` is computed with `math/big` rationals. With every value zero, the split follows the targets.

**CN8 Member split.** The amount of a class with member targets is split among its members by the rule of CN7, with the member targets and values.

**CN9 Rounding.** Each `a_i` is rounded down to a minor unit. The remaining units, fewer than the number of funded entries, go one each to the funded entries in decreasing order of the discarded fraction, ties by position in the plan. The split always adds up to `C`.

**CN10 Missing valuation.** When a member has a holding without a price at today, or a value that needs a rate absent at today, the response carries `status: incomplete` and the list of those members with the missing item (price or rate, with the instrument or the currency pair). It carries no current share, no drift and no amount: a class value without one of its members is not its value. The screen states which members lack a price or a rate and links to the instrument page.

**CN11 Contribution amount.** The stored amount is positive and in the base currency. When the base currency changes, the stored amount is not returned and the field starts empty. A preview with an amount that is not positive returns `contribution_amount_invalid`.

**CN12 Start from the portfolio.** With no plan, the screen offers to start from the current portfolio: one class per instrument type held (named by the existing catalog label of the type), each position a member of its type's class, and each class target equal to its current share. No other default exists.

**CN13 Preview.** The preview computes CN5 to CN10 for a plan sent in the request and an amount, without storing either. The screen uses it for the saved plan and for a draft under edit.

**CN14 Hand-computed cases.** Targets: fixed income 4000, domestic stocks 2000, foreign stocks 2000, real estate funds 2000. Values: 10,000.00, 3,000.00, 1,000.00, 4,000.00. Ratios `v_i/t_i` (per 10000): 25,000, 15,000, 5,000, 20,000.

- `C` = 1,500.00: foreign stocks alone reach the level 12,500 < 15,000. Split: 0, 0, 1,500.00, 0.
- `C` = 4,000.00: foreign stocks rise to 15,000 for 2,000.00; foreign and domestic stocks then rise to 20,000 for 2,000.00 more. Split: 0, 1,000.00, 3,000.00, 0.

**CN15 Drift.** The drift of a set of class values is `Σ |share_i − t_i| / 2` in basis points, with `share_i` from `domain.Allocate`. A total of zero has no drift. GET returns the current drift. The preview returns the drift before and after the contribution, the latter over `v_i + a_i`. In the case of CN14 with `C` = 4,000.00: `Allocate` gives the shares before 5555, 1666, 557, 2222 (the smallest group takes the remainder), so the drift is (1555 + 334 + 1443 + 222) / 2 = 1777. Over 22,000.00 after (10,000.00, 4,000.00, 4,000.00, 4,000.00) the shares are 4545, 1818, 1818, 1819 (real estate funds, last of the three equal values by key order, take the remainder; the key of a class is its zero-based position written with two digits), so the drift is (545 + 182 + 182 + 181) / 2 = 545.

**CN16 Unit value.** An `instrument` member with a price at today carries its unit value in the base currency. The screen writes the approximate quantity `floor(amount / unit value)` with integer division of minor units, prefixed by "≈". A member without a unit value shows no quantity.

## API

All operations are in `internal/portfolio/openapi.yaml`, tag `portfolio`.

| Operation | `x-book-role` | Body or query | Response |
|---|---|---|---|
| `GET /contribution-plan` | `read` | none | The plan, each class and member with value and current share, unit values, the positions outside the plan, the current drift, `status`, missing valuations |
| `PUT /contribution-plan` | `write` | classes, members, amount | The stored plan as returned by GET |
| `POST /contribution-plan/preview` | `read` | classes, members, `amount` | The GET fields for the draft, plus the amount and after share per class and per member and the drift after |

GET of a book without a plan returns 200 with no class, the positions outside the plan and no drift.

Amounts travel as `Money` (integer of minor units and an instrument code). Shares travel as basis points.

## Storage

Migration `db/migrations/<next>_contribution_plan.sql`:

- `portfolio_contribution_plan (books_id PK, amount bigint NULL, currency text NULL)`; amount and currency are both null or both set, amount > 0.
- `portfolio_contribution_class (id uuid PK, books_id, position int, name text, target_bp int)`; unique `(books_id, lower(name))`; `target_bp` between 0 and 10000.
- `portfolio_contribution_member (id uuid PK, books_id, class_id, position int, account_id uuid NULL, instrument text NULL, target_bp int NULL)`; exactly one of `account_id` and `instrument`; unique `(books_id, account_id)` and `(books_id, instrument)` where not null; `class_id` references the class with `ON DELETE CASCADE`.

The sum rules of CN2 and CN4 are checked in `domain`, not in SQL.

The foreign keys of `account_id` (to `ledger_account (books_id, id)`) and of `instrument` (to `marketdata_instrument (code)`) cascade on delete: an account or an instrument that leaves the book leaves the plan with it.

## Screen

Route `/portfolio/contribution-plan`, page width `full`, desktop-only, opened from a link in the portfolio page header. The screen answers three questions in this order: where this month's money goes, how far the portfolio is from the target, how the target changes.

### Header

Title "Contribution plan", a subheading that states the purpose, and the primary action "Edit targets". In edit mode the action is replaced by the save bar.

### Contribution strip

One row at the top of the body:

- the amount field, the app's own `ui/money/money-input`, prefilled by CN11;
- the portfolio total and the total after the contribution, end-aligned;
- one sentence with the drift before and after (CN15): "This contribution moves the portfolio from 17.8 pp to 5.5 pp away from the target." With no contribution amount the sentence states the current drift only.

A change of the amount calls the preview, debounced at 250 ms; the figures under it keep the previous values with the pending state of the family until the response arrives.

### Drift chart and class table

One table, one row per class, columns in this order: name, drift track, target, current, after, amount to contribute. The drift track is an own element (`build-own-element`):

- a horizontal track from 0 to the largest of the target, current and after shares of all classes, plus 5 percentage points;
- the current share as a solid bar in the class colour;
- the contribution as a segment appended to the bar, in the same colour at the lighter step of the palette, ending at the after share;
- the target as a vertical tick across the track;
- `aria-label` stating the three shares in words.

Class colours come from the categorical palette of the theme, in plan order. The amount column is the heaviest text of the row. A class whose amount is zero writes "—" in the muted tone.

Expanding a class shows its members as indented rows with the same columns. A member row adds the approximate quantity (CN16) under no separate column: it follows the amount on the same line, in the muted tone.

### Shopping list

A side panel beside the table, from 1280 px; below that width it sits under the table. It lists every member, or class without member targets, whose amount is positive, sorted by amount, largest first: name, amount, approximate quantity. An action "Copy list" writes the list as plain text to the clipboard, one line per entry; it is disabled in privacy mode.

### Edit mode

- The target cell of each class becomes a percent input with one decimal place and a slider of the Slotted family. A change of one class redistributes the difference among the other unlocked classes in proportion to their targets, in basis points, by largest remainder, so the sum stays 10000. A lock toggle per row keeps its target fixed. With every other class locked, the input is disabled.
- The pure function `redistribute-targets.ts` holds the rule; its test covers proportional spread, largest remainder, locked rows, a class driven to 0 and a class driven to 100%.
- A class is added with a name and a target of 0, renamed in place and removed. Removing a class moves its members to the outside-the-plan section.
- Expanding a class in edit mode shows a switch "Split among assets". With the switch on, each member has a target input with the same redistribution among members. With the switch off, member targets are cleared.
- "Add asset" opens a picker with two lists: investment accounts (CN3 `account_id`) and instruments of the catalog (CN3 `instrument`). Entries already in the plan are disabled with the class name beside them.
- Each change calls the preview with the draft (CN13), debounced at 250 ms; the drift track, the after column, the amounts and the shopping list update together.
- The save bar sits in the Page footer, as in the budget plan (`planning/budget-plan/plan-save-bar.tsx`): "Discard" and "Save". Leaving the page with a draft asks for confirmation, as in the budget plan (`plan-discard-dialog.tsx`).

### Outside the plan

A section under the table lists the positions of CN6 with their value and a class selector. Choosing a class adds the position as a member in the draft and opens edit mode. The section is absent when every position is a member.

### Empty and incomplete states

- No plan: one panel with the purpose in one sentence and two actions: "Start from my portfolio" (CN12, primary) and "Start from scratch" (one class named by the investor, target 100%). Both open edit mode with the draft.
- No position and no plan: the panel adds a link to record the first purchase.
- Incomplete (CN10): one `FormNotice` above the table names the members without price or rate, each a link to its instrument page. The table keeps the target shares; the current, after and amount cells write "—".

### Layout rules

Every row has a fixed height per state, one line per value, values end-aligned on one vertical line. A class name longer than its column is shortened by an ellipsis after the column width is set at 16 rem. No warning icon: the incomplete state is written in words in the tone of the notice.

## Cross-cutting questions

- R1: No regional value. Class names are text of the investor. Instrument type labels come from the existing catalog keys.
- R2: Identical in every region.
- R3: Does not apply: no value set grows with regions.
- R4: Does not apply: no extension point.
- R5: New catalog keys under `portfolio.contributionPlan.*` with pt-BR and en text: screen title, column headers, sum indicator, outside-the-plan section, incomplete state, start-from-portfolio action, each problem code.
- R6: Shares and percentage points through `Intl.NumberFormat` of the active tag; amounts through `useMoneyFormat()`.
- C1: Contribution amount, member and class values, split amounts: `int64` minor units with currency. Shares: integer basis points.
- C2: Every value is converted to the base currency by the valuation of `Allocation` at today. A missing rate gives `status: incomplete` (CN10).
- C3: A holding in another currency is valued in the base currency at today's rate; the screen shows base currency figures only.
- C4: The currency is the book's base currency from settings; amounts through `useMoneyFormat()`.
- T1: Valuation date is today from `platform/clock` in the book time zone.
- T2: Does not apply: no business days or due dates.
- B1: Three tables with `books_id`; every query filters by it; a schema test per table rejects a row without a book.
- B2: GET and preview `read`; PUT `write`. An HTTP test per operation covers `read`, `write`, `owner` and an access without membership.
- B3: The contribution amount is a book value stored in the plan table.
- D1: The three tables are classified as facts in the export; the archive version rises by one.
- D2: One new goose migration.
- D3: Does not apply: the plan changes no transaction.
- D4: Does not apply: no data from a bank, a file or a model.
- D5: Does not apply: the diagnostic file gains no field.
- S1: Three operations. `GET /contribution-plan` and the preview are covered by `get_portfolio` with a new view `contribution` (saved plan and optional amount). `PUT /contribution-plan` is excluded from the tools in `tool_exposure_test.go`: the plan is edited on the screen. Each problem code of CN2, CN3, CN4 and CN11 has an HTTP test.
- S2: Does not appear on a phone (ADR 027).
- S3: `internal/assistant/guide/articles/investments.md` gains a section on the contribution plan in the same commit as the screen.
- S4: The assistant reads the plan and the split through `get_portfolio` view `contribution`.
- X1: S398 a saved plan returns classes, members, values and current shares. S399 the split of CN14 with 1,500.00. S400 the split of CN14 with 4,000.00. S401 a class with member targets splits its amount among members. S402 a member held without a price returns `status: incomplete` and no amount. S403 targets adding up to 9,900 return `contribution_target_sum`. S404 one instrument in two classes returns `contribution_member_duplicate`. S405 a role `read` receives 403 on PUT. S406 a book with base currency `USD` and a BRL holding values the holding at the rate of today. S407 the preview of CN14 with 4,000.00 returns drift 1777 before and 545 after.
- X2: Does not apply to regions. S406 runs with a base currency other than the account's.

## Left to the builder

- The file split inside `internal/portfolio` and `web/src/features/portfolio`, following ADR 033 and `web/CLAUDE.md`.
- The visual weight of the share bars and the expand control, inside the Slotted families.
- Whether the preview reuses the valuation of `Allocation` through a shared helper or a new port method.
