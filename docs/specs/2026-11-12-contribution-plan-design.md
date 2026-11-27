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

**CN12 Start from the portfolio.** With no plan, the screen offers to start from the current portfolio: one class per instrument type held (named by the existing catalog label of the type), each position a member of its type's class, and each class target equal to its current share. A class whose value is below zero, such as brokerage cash of PC4, has a share of 0 and the others share 10000 (amended 2026-11-27: a negative share broke CN2). No other default exists.

**CN13 Preview.** The preview computes CN5 to CN10 for a plan sent in the request and an amount, without storing either. The screen uses it for the saved plan and for a draft under edit.

**CN14 Hand-computed cases.** Targets: fixed income 4000, domestic stocks 2000, foreign stocks 2000, real estate funds 2000. Values: 10,000.00, 3,000.00, 1,000.00, 4,000.00. Ratios `v_i/t_i` (per 10000): 25,000, 15,000, 5,000, 20,000.

- `C` = 1,500.00: foreign stocks alone reach the level 12,500 < 15,000. Split: 0, 0, 1,500.00, 0.
- `C` = 4,000.00: foreign stocks rise to 15,000 for 2,000.00; foreign and domestic stocks then rise to 20,000 for 2,000.00 more. Split: 0, 1,000.00, 3,000.00, 0.

**CN15 Drift.** The drift of a set of class values is `Σ |share_i − t_i| / 2` in basis points, with `share_i` from `domain.Allocate`. A total of zero has no drift. GET returns the current drift. The preview returns the drift before and after the contribution, the latter over `v_i + a_i`. In the case of CN14 with `C` = 4,000.00: `Allocate` gives the shares before 5555, 1666, 557, 2222 (the smallest group takes the remainder), so the drift is (1555 + 334 + 1443 + 222) / 2 = 1777. Over 22,000.00 after (10,000.00, 4,000.00, 4,000.00, 4,000.00) the shares are 4545, 1818, 1818, 1819 (real estate funds, last of the three equal values by key order, take the remainder; the key of a class is its zero-based position written with two digits), so the drift is (545 + 182 + 182 + 181) / 2 = 545.

**CN16 Unit value.** An `instrument` member with a price at today carries its unit value in the base currency. The screen writes the approximate quantity `floor(amount / unit value)` with integer division of minor units, prefixed by "≈". A member without a unit value shows no quantity.

**CN17 Executable order.** Owner request of 2026-11-13: a target split in currency is not an order. After CN7 to CN9, each `instrument` member with a unit value gets an order: the quantity in steps of its instrument scale (`marketdata_instrument.scale`: 0 for a share, 8 for a coin), `q = floor(planned × 10^scale / unit)`, and its cost `ceil(q × unit / 10^scale)` in minor units of the base currency, so the cost never exceeds the planned amount. An `account_id` member and a group without member ideals are cash-like: their order is the planned amount, with no quantity.

**CN18 Leftover.** The leftover is the contribution minus the sum of costs and cash-like amounts. It is reassigned one step at a time to the eligible entry whose value plus executed cost, over its ideal of the whole plan (group ideal × member ideal / 10000), is the lowest, ties by plan order. An eligible entry has a positive ideal and is cash-like or has one step costing more than zero and no more than the leftover (a step whose cost rounds to zero would never consume the leftover). A cash-like entry takes the whole leftover and ends the reassignment. What no entry can take stays as the leftover of the view. The reassignment uses only prices and rates of today; quantities and costs are estimates written with "≈".

**CN19 Hand-computed cases.** Ideals of the whole plan in basis points, values zero unless stated.
- One share entry, ideal 10000, planned 1,000.00, unit 150.00: 6 shares, cost 900.00, leftover 100.00.
- Share A ideal 5000 planned 1,000.00 unit 150.00; share B ideal 5000 planned 500.00 unit 40.00: floors give A 6 (900.00) and B 12 (480.00), leftover 120.00; B is the lowest ratio three times: B 15 (600.00), leftover 0.
- Share A ideal 5000 planned 1,000.00 unit 150.00; cash-like C ideal 5000 planned 500.00: A 6 (900.00), leftover 100.00 goes to C (600.00), leftover 0.
- Coin, scale 8, ideal 10000, planned 1,000.00, unit 300,000.00: 0.00333333, cost ceil(999.999) = 1,000.00, leftover 0.

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

Route `/portfolio/contribution-plan`, page width `full`, desktop-only, opened from a link in the portfolio page header. Owner review of 2026-11-13 replaced the first layout: the owner did not know what a class is or what each column meant, the legend read as noise and the bar sat against a bare dash.

### Vocabulary

The screen never shows the words "class", "target", "p.p." or a bare column header. pt-BR uses "grupo" for a class, "ideal" for its target share, "hoje" for the current share and "depois do aporte" for the after share; en uses "group", "target", "today" and "after this contribution". Shares are whole percents, with one decimal below 10%. The guide article and the problem texts use the same words. Code identifiers keep `class` and `target`.

### Header

Title "Plano de aporte", subheading "Para onde vai cada aporte para levar a carteira ao ideal", way back to the portfolio, primary action "Editar grupos e ideais". Below the header, one sentence explains the screen ("Você divide a carteira em grupos e diz quanto cada grupo deveria ter. Cada aporte vai para os grupos que estão abaixo do ideal, sem vender nada.") and a collapsed "Como funciona" holds three numbered steps: define the groups and the ideal of each; type the contribution; buy what the list shows.

### This month

The first section answers where this month's money goes:

- the amount field (`ui/money/money-input`, prefilled by CN11), the portfolio today and after the contribution;
- a verdict sentence built by a pure function: the groups and members that receive money with their amounts, in list order, and one clause for the rest ("Os demais grupos não recebem neste mês.": a group below the ideal can also receive nothing when the amount is small); without an amount, "Informe o valor do aporte para ver onde aplicar.";
- the purchase list: one row per receiving entry (a member of a group with member ideals, else the group), largest first, with the group colour dot, the name, the approximate quantity (CN16) and the amount end-aligned; "Copiar lista" at the section header, disabled in privacy mode.

### Portfolio against the ideal

The second section draws one row per group, then the members of an expanded group:

- the name with the group colour dot;
- the share bar, an own element: a track on one scale from 0 to 100% shared by every row, gridlines at 25, 50 and 75%, the scale written once above the first row; the share today as a solid fill in the group colour; for an entry that receives money, a hatched extension in the same colour from today to after this contribution; the ideal as a vertical marker labelled "ideal N%";
- the status in words, from a pure function: "abaixo do ideal (hoje 0%, ideal 40%)", "acima do ideal (hoje 74%, ideal 20%)" or "no ideal (40%)"; an entry is at the ideal when today differs from the ideal by less than half a percentage point;
- the outcome: "recebe R$ 3.636,36" in the heaviest weight, or "não recebe neste mês" in the muted tone; without an amount, nothing.

A key at the section header draws a solid sample, a hatched sample and the marker with the words "hoje", "com este aporte" and "ideal", in the same marks as the bars. Member bars use the shares inside their group and say "do grupo" after the percentages.

Owner review of 2026-11-13 (X3 capture): with a large contribution a group above the ideal today can fall below it after the contribution and receive money, so a status built on today alone ("acima do ideal") contradicts "recebe R$ …". With an amount, the status compares the share after the contribution with the ideal and writes both shares: "abaixo do ideal (hoje 74%, depois 16%, ideal 20%)"; without an amount it keeps today only. The verdict names at most two receivers; with more it reads "Aplique R$ 50.000,00 em 5 compras, listadas abaixo." so it never fills the line.

### Edit mode

Owner review of 2026-11-13: plain sentences that change while the owner drags a control are not an interface, and any content that changes height above the rows moves them under the pointer. Edit mode draws the composition and the effect of the contribution as pictures of fixed height.

"Editar grupos e ideais" replaces the content of the second section with the composition editor; the "Este mês" card keeps only its amount row while editing.

1. Composition editor, an own element, three bars of one width with a row label column on the left:
   - "Ideal" (40 px high): one segment per group in its colour, width = its ideal, the name and the percent written inside the segment when they fit, the percent only when the name does not fit, nothing when the percent does not fit either (the group list below names it). Between two adjacent segments a handle moves the boundary: it transfers basis points between those two groups only, in steps of 10 bp (0.1%), never below 0. A handle next to a locked group is disabled. Each handle is a `role="slider"` with arrow keys (±100 bp), Shift+arrow (±500 bp), Home and End, an `aria-valuetext` naming both groups and their percents, a visible focus ring, a 24 px hit area and `cursor: col-resize`.
   - "Hoje" (12 px): the same groups at their share today, same colours, for comparison.
   - "Este aporte" (12 px): the contribution split among the groups that receive money, segments in their colours, each amount written under its segment when it fits; while the preview is pending the bar keeps the previous split; without an amount, a muted track with "informe o valor do aporte" inside; with a blank name, the same track with "dê um nome a cada grupo".
2. Group list under the editor, one row per group of fixed height: colour swatch, name input, the ideal slider (Slotted Slider without value label, filling the remaining width), ideal percent input with − and + buttons (±1%), lock toggle, share today (muted), amount this group receives (fixed width, tabular numerals), and a row menu with "Dividir entre ativos", "Adicionar ativo" and "Remover grupo". Members of a split group follow as indented rows with the same columns. Changing a slider or a percent in the list redistributes among the unlocked groups as before (`redistribute-targets.ts`); dragging a handle in the editor transfers between the two neighbours only.
3. The section title carries a help button that opens a short popover with the rules (drag a boundary or type a percent; the total stays 100%; the lock keeps a group fixed); no explanation sentence is drawn in the section.
4. Nothing above the group list changes height while editing: the bars have fixed heights, the amounts have fixed widths, the blank-name error lives in the "Este aporte" track and as the invalid state of the input.

The save bar, the leave confirmation, the asset picker and member ideals keep the rules of the first layout.

### Executable orders and group assets

Owner review of 2026-11-13:
- The purchase list and each member row show the order of CN17: "12 cotas · R$ 1.234,56" (quantity with the instrument's decimals, cost); a cash-like entry shows its amount only; the list ends with "Sobra R$ 37,20" when CN18 leaves money, or nothing when it does not. A group without member ideals that holds instrument members shows, in place of a quantity, "divida entre ativos para ver as cotas" as a link that opens its assets.
- The actions of a group are visible, never behind a menu: the group row ends with a text button "Ativos (N)" that expands the group's assets panel, and a remove icon button with its tooltip. The panel lists the member rows and ends with the button "Adicionar ativo" and the switch "Dividir o ideal do grupo entre os ativos" with one muted line: "Ligado, cada ativo tem seu próprio ideal dentro do grupo." A group without assets opens with the line "Nenhum ativo neste grupo. Adicione os ativos que você compra para ele." beside "Adicionar ativo".

### Purchase list as one bar

Owner review of 2026-11-15 (concept B of the mock): the list read as names on the left and amounts on the right with the width of the page between them, a colour dot whose group was named only in the next section, no unit price, and no share of the contribution. It replaces the purchase list bullet of "This month" and the list half of the first bullet of "Executable orders and group assets".

- A bar, an own element, draws the contribution: one segment per purchase in the order of the rows, width proportional to its cost, in its group colour; the leftover of CN18 is the last segment, hatched in the muted text colour. Under it, "0" at the start and "aporte R$ 1.500,00" at the end. Its accessible name lists each segment with its share ("Divisão do aporte: HGLG11 88%, SBSP3 7,3%, …").
- The rows form one table under the bar, with column headers "Ordem", "Total" and "Do aporte" (the asset and group columns carry their names for assistive technology only). A row draws a square swatch in the group colour and the name; the group name in the muted tone when the row is a member (nothing when the row is the group); the order; the cost in the heaviest weight; the share of the contribution in the muted tone.
- The order of a row: "≈ 9 cotas × R$ 146,02" (one unit reads "≈ 1 cota × R$ 15,10"; a quantity with decimals names the instrument, "≈ 0,00098412 BTC × R$ 350.000,00"); "aplicação por valor" for an account member or a group with no instrument; "sem cotação · valor planejado" for an instrument member without a unit value; the link "divida entre ativos para ver as cotas" as before.
- The leftover is the last row: hatched swatch, "Sobra", "fica na conta", its amount and its share. It replaces the "Sobra R$ 37,20" line under the list.
- Pointing at a row dims every other segment of the bar to a quarter, with no motion under `prefers-reduced-motion`.
- The share of a row is its cost over the contribution, the costs plus the leftover (CN18 makes that sum the amount), written by `share-text.ts` (whole percent, one decimal below 10%). It is a client derivation with its own test.
- Privacy mode masks the amounts, the unit prices and the quantities; the bar and the shares stay, as the shares of the second section do.
- "Copiar lista" and its text are unchanged.

Feature-design answers: regions and currencies, every amount in the plan's base currency through `useMoneyFormat()`, the share and the quantity through `numberFormatter`; languages, pt-BR and en keys in `catalog-contribution-plan.*`; time, access and data lifecycle, unchanged (no new request, no stored state); surfaces, desktop only (S2, ADR 027); tests, the model functions and S409 in `contribution-plan-orders.test.tsx`.

### Outside the plan

A collapsed block under the second section: "N investimentos fora do plano · total", expanding to the list of CN6 with a group selector per entry; an entry without a value says "sem cotação".

### Empty and incomplete states

- No plan: the explanation sentence, "Como funciona" open, and the two actions "Partir da minha carteira" (CN12, primary) and "Começar do zero".
- Incomplete (CN10): the verdict sentence names the entries without price or rate ("Bitcoin (BTCBRL) está sem cotação; sem ela o aporte não é dividido.") with a link to each instrument page; the second section keeps today and the ideal and says "aguarda a cotação" in place of the outcome.

### Layout rules

Every row has a fixed height per state, one line per value, values end-aligned on one vertical line. A group name longer than its column ends in an ellipsis after the column width is set. No warning icon. No bare dash stands for an absent amount: the absence is written in words.

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
