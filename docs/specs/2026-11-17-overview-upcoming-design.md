# Upcoming widget

The Upcoming widget of the overview lists the overdue occurrences and the open ones of the next 7 days. Today each row holds a description, a date and an amount: an income reads as an expense, an overdue occurrence differs from the others by one word, the reader counts the days and adds the amounts.

The approved mock is the contract of the form: `docs/specs/assets/2026-11-17-overview-upcoming-mock/` (owner, 2026-11-17, concept A, no change). `design.css` moves to the widget's stylesheet without edits and the markup follows `design.html` element by element.

## 1. Scope

- The widget keeps its reads (`GET /occurrences`, `GET /schedules`), its window (`upcomingWindow`), its link to Planning and the actions of each occurrence (`OccurrenceActions`). No operation is added.
- The list keeps every row. The widget body scrolls when the rows exceed its height; the totals sit in the widget's footer and stay in sight.
- Out of scope: a change of the window length, a filter by account, a balance check against the totals, the Cards widget.

## 2. Decisions

| ID | Decision |
|---|---|
| UP1 | Order of the blocks, confirmed by the owner on 2026-11-17: the overdue occurrences, the next 7 days by date, the totals of the window. |
| UP2 | Two groups. "Overdue" holds the occurrences of state `overdue`; its head writes the count and the sum of their amounts in the base currency, in the danger tone. "Next 7 days" holds the occurrences of state `expected` up to today plus `upcomingDays`; its head writes the last day of the window as day and month. A group without rows is not drawn. |
| UP3 | A row is: the day (day of the month over the short weekday), the name over the deadline, the amount, the actions. A row whose day equals the day of the row above it in the same group draws an empty day cell. The day number of today takes the accent text colour. |
| UP4 | The deadline is written by `formatRelativeDays` over the calendar-day difference between today and `expected_on`. An overdue occurrence reads "overdue {relative}" in the danger tone, medium weight. An occurrence of state `expected` with a past date reads "expected {relative}" in the warning tone, medium weight: the API keeps it `expected` during the grace days of its schedule. Every other row reads the relative words alone, muted. |
| UP5 | The direction comes from the kind of the schedule. `income` enters: the amount takes a plus sign and the success tone, and the deadline line ends with the word of the direction. `transfer` and `savings` end the deadline line with their word and keep the default amount. `bill` and `subscription` leave: no word, default amount. The sign and the word carry the direction; the colour repeats it. |
| UP6 | The totals. "Leaving" adds the amounts of the listed rows of kind `bill` and `subscription`; "Entering" adds those of kind `income`. `transfer` and `savings` are listed and added to neither: the money stays with the owner. Each total holds one amount per currency, the base currency first and the others by code, joined by a plus sign. A total without rows is not drawn; the footer is not drawn when both are absent. |
| UP7 | A row whose schedule has no description, or whose schedule is absent from the read, is named by `ledger.untitled` and takes the kind `bill`. |
| UP8 | The empty sentence becomes one line: "Nothing expected in the next 7 days". The loading and failure states are the widget's own, unchanged. |
| UP9 | Own element: the agenda row. Families read: `list-item` (its start slot centres one icon or control and its row height follows the content; the mock fixes a 31.5 px day column of two lines and a 42 px row), `timeline` (draws a rail and a marker per event, which the mock does not hold), `data-list` (label and value pairs). The element is built under `build-own-element`; the need is this widget's form, not a Slotted finding. |
| UP10 | The block keeps its placement: 4 columns and 5 rows, removable. |

## 3. Derivation

- `upcoming.ts` keeps `upcomingWindow` and gains the pure view model: the groups, the rows with their day, deadline kind, relative days, direction and repeated-day flag, the overdue sum and the totals per currency. It holds no text.
- `use-upcoming.ts` holds the two queries and returns `{ view, loading, error, retry }`.
- One component per file draws the group, the row and the totals. The row calls `useMoneyFormat`, `useT` and the date formatters itself.

## 4. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: the widget adds no regional value; the weekday, the relative words and the date take the active tag through `Intl`. |
| R2 | Does not apply: no regional behavior is added. |
| R3 | Does not apply: no value set is added; the schedule kinds are the closed set of the API. |
| R4 | Does not apply: no extension point is added. |
| R5 | New keys with pt-BR and en text: `overview.upcoming.late`, `.lateCount`, `.next`, `.until`, `.overdueSince`, `.expectedSince`, `.income`, `.transfer`, `.savings`, `.leaving`, `.entering`. `overview.upcoming.empty` changes its text (UP8). `overview.upcoming.overdue` is removed. |
| R6 | The day and the weekday through `Intl.DateTimeFormat` of the active tag in `src/i18n/format.ts`; the relative words through `formatRelativeDays`; the last day of the window through `formatDayMonthNumeric`; the count through `numberFormatter`. |
| C1 | The sums are integers of minor units, one per currency. |
| C2 | A sum holds one currency. The overdue sum holds the base currency; an overdue occurrence in another currency keeps its own amount on its row and is left out of the head. The totals hold one amount per currency and convert nothing, so no rate is read. |
| C3 | An amount in a currency other than the base shows its own currency on its row and its own term in the totals. |
| C4 | Every amount goes through `useMoneyFormat()` (`MoneyFigure`, `fmt.signed`), with the currency of the occurrence. Privacy mode masks the rows, the overdue sum and the totals. |
| T1 | "Today" comes from `useToday()`. `expected_on` is a calendar date; the day difference is a difference of calendar dates. |
| T2 | Does not apply: the widget counts calendar days; the business-day shift is applied by the API when it sets `expected_on`. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | Does not apply: no setting. |
| D1 | Does not apply: no table. |
| D2 | Does not apply: no schema change. |
| D3 | Does not apply: no recorded fact changes. |
| D4 | Does not apply: no data is written. |
| D5 | Does not apply: the diagnostic file is unchanged. |
| S1 | Does not apply: no operation is added. |
| S2 | The overview is a phone route (ADR 027). At 390 px the widget draws the same groups, rows and totals in one column, as the mock holds. |
| S3 | The widget offers the same actions. The article `schedules_and_occurrences` gains one sentence on what the overview lists: overdue first, the next 7 days, and the totals leaving and entering. |
| S4 | Does not apply: the assistant reads occurrences through its own tools. |
| X1 | Does not apply: no acceptance scenario is added. |
| X2 | A test of the view model holds an occurrence in a currency other than the base: its amount is absent from the overdue sum and is its own term of the total. The widget has no regional behavior. |
