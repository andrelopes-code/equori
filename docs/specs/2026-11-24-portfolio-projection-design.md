# Portfolio area: the Projection tab

Issue #71. Approved mock: `docs/superpowers/mocks/2026-11-24-portfolio-projection-design/` (local, outside Git), approved by the owner on 2026-11-24. The tab joins the area of `docs/specs/2026-11-24-portfolio-results-design.md` (tabs PT1 to PT5, the return series PS1 to PS8).

## Intent

The owner wants to plan the building of wealth with the real portfolio as the starting point: say when withdrawals start and how much income is wanted, say how much is meant to be contributed, and read where that leads by age and how what happened walks against it. The compound calculator (`/calculators/compound`) already holds the mathematics, detached from the portfolio and from the person.

## Goals

- One saved plan of a member in a book, edited in place.
- The contribution intention is a list of dated changes that holds from today on; the past is what the ledger recorded (owner, 2026-11-24).
- The age comes from the birth date of the user (owner, 2026-11-24).
- Results in today's money by default.

## Non-goals

- More than one plan per member, the assistant reading the plan. Scenarios and the tax on withdrawals, excluded on 2026-11-24, entered by Amendment 1.
- A phone form (ADR 027).

## Anti-goals

- A projection that reads as a promise: every projected figure is labelled as the plan's, and the expected return is typed by the member, never suggested as a default.
- A past rewritten by a change of intention.

## Approaches

| Approach | Trade-off | Choice |
|---|---|---|
| The plan as one row of fields above its results | The results take the full width; a change shows at once | Chosen (mock) |
| A form at the side, results beside it | The form holds a third of the page for values that rarely change | Rejected |
| The projection computed on the server | One more operation and a contract for a simulation; the client already holds the compound mathematics and every input | Rejected: the server stores the plan, the client projects |

## Rules

### The plan (PJ)

| ID | Rule |
|---|---|
| PJ1 | A plan belongs to one member in one book. It holds: the age withdrawals start (18 to 100), the last age projected (above the first, at most 120), the expected real return and the expected inflation, both per year in basis points (real −1000 to 3000, inflation 0 to 5000), the withdrawal as a monthly income in today's money or as a rate per year (1 to 2000 bp), the contribution changes, the currency, the day it was first saved and the value of the portfolio on that day. |
| PJ2 | A contribution change holds the first day of a month and a monthly amount of zero or more. A plan holds 1 to 40 changes with distinct months. The change in force in a month is the latest one dated on or before it. |
| PJ3 | The currency is the base currency of the book when the plan is first saved. The baseline (first save day and the value of every brokerage tree on that day, in that currency) is set once and kept by later saves. |
| PJ4 | A save keeps every change dated before the current month as it is stored: a body that alters or drops one is `422 projection_past_change`. Changes of the current month and later are replaced by the body's. |
| PJ5 | `GET /portfolio-projection` returns the plan, or `404 not_found` when the member has none. `PUT` creates or replaces it under PJ3 and PJ4. `DELETE` removes it with its changes. Each needs the role `read`: the plan is the member's own and writes no fact of the book. |
| PJ6 | The birth date belongs to the user: `birth_date` on `getCurrentUser`, set through `updateCurrentUser`, a date from 1900-01-01 to today, absent until set. |

### The tab (PX)

| ID | Rule |
|---|---|
| PX1 | The tab "Projeção" is the sixth of the area, at `/portfolio/projection`, with the area header; it carries no currency control: the plan's currency rules. |
| PX2 | The plan section holds, in one row that wraps: the age (from the birth date, with the place it comes from), the age withdrawals start, the real return with the realized real return of the portfolio as a hint when the history holds 12 months, the inflation, the withdrawal mode, the income or the rate, and the last age. The income is net of any other income of the member (amended by the owner on 2026-11-25). Every result below follows the fields as they are typed; "Salvar plano" stores them. |
| PX3 | Without a birth date the tab draws the plan section with a birth date field in place of the age, and a message of what is missing; saving the field writes the user's birth date. Nothing below is drawn. |
| PX4 | The projection runs by month from today: `v = v × (1 + r) + contribution − withdrawal`, `r = (1 + real)^(1/12) − 1`, contributions until the month before withdrawals start, withdrawals from that month to the last age, a value that reaches zero stays zero. Amounts are today's money; the nominal view multiplies a month's amounts by the inflation compounded since today. |
| PX5 | The amount needed at the withdrawal age, in income mode, is the present value at that age of the income until the last age at the real return. In rate mode it is absent, and the income the plan sustains is the value at that age times the rate over 12. |
| PX6 | The journey block draws the recorded value and the money contributed (the return series, month step, whole history), then the projection to the last age, on one money axis by calendar with the age under each decade, with marks at today and at the withdrawal age. The money contributed and the area of the return end on the month before the withdrawals (amended by the owner on 2026-11-25: a withdrawal takes value out, so the area would no longer be the return; the return above the withdrawal stays in the value). Its side states: whether the plan sustains the income (income mode: the value never reaches zero before the last age), the value at the withdrawal age and its share of the amount needed, the share of the way (today's value over the amount needed), today against the plan, the money contributed and the return to the withdrawal age, and the income the plan sustains. |
| PX7 | The plan line of the past runs over the whole recorded history (amended by the owner on 2026-11-25: a plan saved today is read against the years before it). It starts on the first recorded month's value and grows by the nominal monthly rate, `(1 + real) × (1 + inflation)` to the power 1/12. A month up to the month of the baseline adds its recorded flows, since no intention existed then; a later month adds the contribution in force. "Plano contra realizado" draws it beside the recorded value, with a mark on the baseline day, the area between them in the success tone where the recorded value is above and in the danger tone where it is below, and four figures: the difference today and the months above the plan, both over the months after the first; the average recorded contribution of the months after the baseline month against the planned one, absent while there is none; the realized real return against the expected one. With a history under two months the block states what the comparison needs. |
| PX8 | "Aportes planejados" lists the changes, newest last, in a region five rows tall that scrolls, with the action that adds one fixed below; a change dated before the current month is read-only. Its plot draws the recorded monthly contributions of the last 60 months as bars and the intention as steps from today to the withdrawal age. |
| PX9 | A change is edited in a small dialog: the month, the monthly amount, the effect on the value at the withdrawal age against the plan without it, "Remover mudança" at the start side, "Cancelar" and "Salvar" at the end. A month from the withdrawal month on is refused in the dialog (amended by the owner on 2026-11-25); a stored change that a lower withdrawal age leaves there is kept, and adds nothing. |
| PX10 | "Ano a ano" lists, per calendar year from the current one to the last age: the age at the end of the year, the contributions, the return, the withdrawals, the money contributed so far and the value; twelve rows, and all of them in a region twelve rows tall that scrolls under a fixed header when opened. |
| PX11 | A result carries the success or danger tone with its sign or its word written. Loading keeps every static text. Empty (no plan) offers to build one with the fields at rest. Failure is the app's `ResultState`. |
| PX12 | When the base currency of the book is no longer the plan's, the tab states it and offers to delete the plan and start again in the new currency; it draws no projection. |

## Client derivations

Each is a pure function with a test of hand-computed values: the monthly projection (PX4), the amount needed (PX5), the share of the way, the age the income ends, the plan line of the past (PX7), the contribution in force in a month (PJ2), the yearly rows (PX10), the age at a date.

## Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | No value of the feature varies by country: the member types the return, the inflation and the ages; the currency is the book's. |
| R2 | The same behavior in every region. |
| R3 | The withdrawal mode is not regional: `income` or `rate`, an enum. |
| R4 | No new extension point. |
| R5 | Catalog keys `portfolio.projection.*` and `portfolio.tabs.projection`, pt-BR and en, listed in the plan. |
| R6 | Money, percents, ages, months and years through `src/i18n/format.ts` and `useMoneyFormat()`. |
| C1 | The income, each contribution and the baseline value: integers of minor units in the plan's currency. Rates in basis points. The projection runs in floating point on the client and leaves as rounded minor units. |
| C2 | One currency: the plan's. The baseline values the brokerage trees in it on the save day, as `getReturn` values a closing; a missing rate is the existing `422`. |
| C3 | PX12. |
| C4 | The currency comes from the plan. |
| T1 | The save day and "today" come from `platform/clock` in the book's time zone; the tab reads `useToday()`. |
| T2 | Does not apply: months, no business days. |
| B1 | `portfolio_projection_plan` and `portfolio_projection_change` hold `books_id`; every query filters by it; a schema test rejects a row without a book. |
| B2 | `read` on the three operations (PJ5); an HTTP test covers a member of the book, a member of another book (their own empty answer) and a request without a session. A member never reads another member's plan. |
| B3 | No setting. |
| D1 | Both tables are facts of the book in the export (`TestEveryTableIsClassified`); the birth date travels with the user. The archive version rises if the format requires it; the plan checks. |
| D2 | One goose migration: the two tables and `identity_member.birth_date`. |
| D3 | Does not apply: no recorded fact changes. |
| D4 | Does not apply. |
| D5 | Does not apply. |
| S1 | `getPortfolioProjection`, `savePortfolioProjection`, `deletePortfolioProjection`, excluded from the tools; `Problem.code` `projection_past_change` and `projection_invalid` (a field out of its range, changes out of PJ2), each with an HTTP test. |
| S2 | No (ADR 027). |
| S3 | The article of the topic `investments` gains the Projection tab; it is near its 16,000-byte ceiling, so the commit moves the paragraph of the tabs to what the test allows or trims another sentence, as the guide test requires. |
| S4 | No. |
| X1 | Scenarios for: a first save sets the baseline; a later save keeps it; a past change cannot be altered; the plan of one member is not another's. The plan takes the next free ids of `docs/domain/06-scenarios.md`. |
| X2 | A book with base currency USD saves and reads a plan in USD. |

## Left to the builder

File names under `web/src/features/portfolio/projection/`, the reuse of `features/calculators/compound-calculator/simulation.ts` where its contract fits PX4, the chart options.

## Amendment 1: premises and scenarios (owner, 2026-11-25)

The owner asked for a positive and a negative scenario and for a more realistic plan. One expected return hides that the return decides the result: the same plan covers 290% of the amount needed at 7% a year and 66% at 3%.

| Approach | Trade-off | Choice |
|---|---|---|
| Two typed returns beside the plan's, each projected like the plan | One reading of the range per typed premise; no probability | Chosen |
| One spread above and below the plan's return | One field; forces a symmetric range around a premise that can be optimistic | Rejected |
| Simulation of random paths | Asks for a volatility and a correlation per class; the mean return is the larger uncertainty | Rejected |

| ID | Rule |
|---|---|
| PJ7 | A plan also holds four optional values, in basis points: the real return during the withdrawals (−1000 to 3000), the cautious real return (−1000 to 3000, below the plan's real return), the favorable real return (−1000 to 3000, above it) and the tax on the gain (1 to 5000). A value left out of a save is absent from the plan. Out of range or order is `422 projection_invalid`. No value is suggested. |
| PX13 | In today's money the recorded past is corrected: a recorded value or flow is multiplied by the growth of the inflation index of the series (`period: month`) from its date to the last point of the index; a date after the last point is not corrected. It applies to the plot of the journey in "Dinheiro de hoje", to the money contributed and the return of its side, and to the money contributed of PX10. The nominal view keeps the recorded amounts. Without an inflation index in the plan's currency the past stays nominal and the description says so. |
| PX7 | Amended: after the baseline month the plan line adds the contribution in force times the inflation compounded since the month of its change, or since the baseline month when the change is older. A contribution is today's money, so the plan raises it with prices. |
| PX4 | Amended: from the withdrawal month on the projection grows at the real return during the withdrawals; absent, at the plan's real return. PX5 uses the same return. |
| PX14 | With a tax, a withdrawal takes out the gross amount whose net is the income. The taxed part is the gain share of the value, `1 − basis / value` and never below zero; the basis is the money contributed (nominal), it falls with inflation each month in today's money, rises with each contribution and falls in the proportion each withdrawal takes of the value. `gross = income / (1 − tax × gain share)`. The withdrawals of PX10 are gross. The amount needed is the smallest value at the withdrawal age, at the plan's gain share there, that sustains the income to the last age. In rate mode the rate gives the gross of the first withdrawal, and the net of that withdrawal is the income, constant in today's money. |
| PX15 | Each typed scenario projects the plan with its return in place of the plan's, and during the withdrawals with the same difference: plan's withdrawal return + scenario return − plan return. The journey plots it as a dashed line in its tone (danger the cautious, info the favorable, since success is the hue of the projection) from today, named in the key. |
| PX16 | The block "Cenários", below the journey and drawn only with a typed scenario, is a table of one line per case (cautious, plan, favorable): the return, the value at the withdrawal age, the share of the amount needed (income mode), the income sustained and the age it lasts to, in today's money. |
| PX17 | The plan section holds two rows: the goal (age, withdrawals at, until, withdrawal, income or rate) and the premises (real return, cautious, favorable, during the withdrawals, inflation, tax on the gain). Under the premises one line names what is stored and can be compared: the longest point of the first real curve in the plan's currency and the last point of the expectation of that curve's index. It fills no field; without a curve or a survey the part is absent. |

Cross-cutting answers of the amendment: R1 no regional value, the tax is typed, the references come from the curve sources and expectation sources of `docs/contributing/regions.md`; R2 without a source or an index the reference or the correction is absent, stated by PX13; R3 and R4 none; R5 catalog keys `portfolio.projection.*`; R6 through `src/i18n/format.ts`; C1 basis points and minor units, floating point on the client only; C2 the curve and the index are used only in the plan's currency; C3, C4, T1, T2 unchanged; B1 no table; B2 and B3 unchanged; D1 the archive exports the plan by column, no format change; D2 one migration with four nullable columns; D3 to D5 do not apply; S1 no operation; S2 no; S3 the guide article and the help article change with the screen; S4 no; X1 S719; X2 S717 covers a plan in USD, and PX13 without an index has a client test.

Left for a later amendment: other incomes with a start age, one-off events, a fall at the start of the withdrawals.
