# Planning tabs: agenda, schedules and subscriptions answer the owner's questions

Status: accepted (owner, 2026-11-15: concept 1 "panel" with the running balance of concept 2)

## 1. Intent

The three tabs draw the data in the shape the table family allows. Measured on the demo book on 2026-11-14:

1. Agenda. The month's close is not on screen: the owner subtracts R$ 7.200,30 from R$ 12.764,97. What is still to pay (R$ 549,80 in 5 occurrences) is spread over 17 rows, 11 of them tagged "Realizada". Each row writes its date twice: in the day group and in a date column. The calendar beside the table marks no day that has an occurrence.
2. Schedules. Eight columns overflow a 1440 px window: the column "Termina em" is cut. Value and yearly value repeat the same information for the 18 monthly schedules. Two term versions that start after today (Aluguel R$ 4.020,00, Netflix R$ 64,90 on 2026-12-01) are not on screen.
3. Subscriptions. Price and monthly cost are equal in all 8 rows. The gym charged R$ 129,90 in each of the last 12 months against R$ 119,90 expected; the screen does not say it. The total adds the monthly cost of every active subscription in any currency (`subscriptions-tab.tsx`, `total`), so a subscription in USD enters a total written in BRL.

## 2. Questions and order

| Tab | Question, in the order the owner asks it | Decision it supports |
|---|---|---|
| Agenda | How does the month close, and how much is still to pay? | Whether the month's cash suffices |
| Agenda | What is due now, and what is late? | Pay, confirm, skip or move an occurrence |
| Agenda | On which days does the money move, and how low does the balance go? | When to keep cash in the account |
| Schedules | How much of the fixed income do the fixed commitments take? | Whether to cut or add a commitment |
| Schedules | Which commitments weigh most, and which change value? | Which one to review |
| Subscriptions | How much do subscriptions cost a month and a year, and which weigh most? | Which one to cancel |
| Subscriptions | Did a price change, or will it? | Update the terms, or cancel before the increase |

## 3. Layout shared by the three tabs

- P1. Each tab opens with a summary band: one row of four `StatCard`s (family) in a grid whose first column is wider. The first card is the tab's conclusion at `size="md"`, one step above the others at `size="sm"`. Each figure appears once on the tab.
- P2. Under the band, two columns of sections: 7/5 for the agenda and the subscriptions, 1/1 for the schedules. A section whose content needs the whole width (the running balance) sits under the two columns. Below 1200 px the second column moves under the first. `/planning` is desktop-only (ADR 027, S3).
- P3. Every list is a `Table` (family, `variant="framed"`): values end on one vertical line, a group's subtotal sits in its `TableGroupRow` `end`. A cell holds one line per piece of information.
- P4. A list of what already happened, or of what ended, is a `Collapsible` (family) under the open list, closed by default.

## 4. Agenda

- A1. Band: "Close of <month>" (inflows minus outflows of the month), "Inflows" with the share received, "Outflows" with the share paid, "Still to pay" with the count of pending occurrences.
- A2. Month figures, derived on the client: a realized occurrence counts at its actual amount, a pending one (expected or overdue) at its expected amount, a skipped one not at all. Only occurrences in the base currency of the book are summed; each other currency is written in the close card's note as "<amount> left out: no exchange rate" (C2). An overdue occurrence of an earlier month belongs to the current month only: it is cash still owed today, so it counts as pending in the figures and the list of the current month, and stays out of any other month (before this change the overdue group showed under every month).
- A3. Left column: the existing four filters, then the table of pending occurrences ("To pay and to receive", its caption) in three groups, each with its subtotal per currency (`netOf`): "Overdue", "Until <today + 7 days>" (expected up to 7 days after today, including an expected date already past and still within its grace days), "Rest of the month". A group without rows is not drawn. Under it, the collapsible "Already happened" with the realized and skipped occurrences of the month in date order; it opens by default when nothing is pending.
- A4. A row: date (day number over weekday), description over "kind · account" (or "moved from <date>"), when (relative for pending: "today", "in 4 days", "17 days late"; "paid", "received" or "skipped" for the rest), amount signed by its effect, and the existing `OccurrenceActions`. A realized row keeps `OccurrenceReceived` under the amount.
- A5. Right column: the `Calendar` (family) with `marks`, its cell grown to fill the column: each day with occurrences gets a mark whose count is the number of occurrences and whose tone is `danger` when one is overdue, `accent` when one is expected, `success` when all are realized or skipped. Choosing a day scrolls to its first row, opening "Already happened" when the row is there. The month control moves the calendar, as today.
- A6. Under the two columns, full width: "Running balance of the month", a line `Chart` (family) of the cumulative signed amount of the month's base-currency occurrences per day, at the amounts of A2, with a sentence in the section description: the lowest point and its day, and the close. The cumulative series starts at zero: it is the month's planned flow, not an account balance.

## 5. Schedules

- B1. Band: "Free per month" (fixed income minus fixed commitments), "Fixed income per month", "Bills and subscriptions per month" with its share of the income (the rule of `recurringShares`, now on screen in this card), "Savings per month". A transfer moves money between the owner's accounts and stays out of every figure, as the yearly column left it out before. Monthly values follow `subscriptionCost` (`schedule-words.ts`). Base currency only; other currencies are named in the free card's note (C2). `RecurringShareNotice` leaves the tab: its figure is the share in the third card.
- B2. Under the band, a segmented bar of the fixed income: one segment for bills, one for subscriptions, one for savings and a hatched "Free" segment, with a legend of shares. When the commitments exceed the income the bar holds the kinds only and the legend says "commitments exceed the fixed income by <amount>".
- B3. One section per kind, in the order bill, subscription, savings, transfer, income, each with its monthly total in the header and a table of three columns: description over "account · recurrence" (or, when a later term version exists, "rises to <amount> on <date>" / "changes to"), next occurrence ("in 4 days · 18/11", a date beyond 45 days, "None"), amount (with "<monthly> per month" under it when the recurrence is not monthly). Rows sort by monthly cost, highest first. Sections fill the two columns in order, each into the column with fewer rows (`balanceColumns`).
- B4. Ended schedules: a collapsible "Ended" with their kind as a tag, sorted by the latest end first, rows muted.

## 6. Subscriptions

- C1. Band: "Subscriptions per month", "Per year", "Charged in the last 12 months" with the difference from the expected amounts when it is not zero, "Ended" with the monthly cost no longer paid.
- C2'. Totals hold the base currency; a subscription in another currency is listed with its own amounts and "left out of the total: no exchange rate". This fixes the cross-currency sum of section 1.
- C3. Left column: the ranking table, highest monthly cost first: rank, description over "account · recurrence", the last 12 months (one cell per month: paid at the expected amount, paid at another amount, skipped, expected, none), the share of the total (a `ProgressBar` and its percentage), the monthly cost over the yearly cost, and the existing `ScheduleActions`.
- C4. Right column: "Price changes": a term version that starts after today ("rises on <date>": old and new amount, yearly difference), the latest term version that started in the last 12 months ("changed on <date>"), and the last realized occurrence whose actual amount differs from the expected one ("charged differently"); each links to the schedule page, where the terms and the update of the expected amount live. Then "Next charges": the 5 next expected occurrences. Then the collapsible "Ended".
- C5. The 12-month cells read the occurrences of the last 365 days (`occurrencesQuery`, at most 366 days).

## 7. Own elements

- E1. The 12-month cells (C3) and the segmented bar (B2) are elements of the application: no family draws a row of month cells or a part-to-whole bar of one line (the chart family draws axes and legends). Both are images with an accessible name that lists their values; colour is never the only channel (the name and the legend carry the state).

## 8. Cross-cutting questions

- R1: Does not apply: no value varies by country; dates and weekdays come from `Intl` through the active tag.
- R2: Does not apply: no regional behavior.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: New catalog keys under `planning.summary.*`, `agenda.*`, `schedules.*`, `subscriptions.*`, each with pt-BR and en text (plan, Contract).
- R6: Amounts through `useMoneyFormat()`; dates through `formatDate`, `formatDayMonth` and `Intl` weekday names of the active tag; percentages through `formatBasisPoints`.
- C1: Amounts stay integers of minor units with their currency; shares are basis points computed in integers.
- C2: Every sum holds one currency: the base currency of the book. An amount in another currency is written with its currency and the words "no exchange rate"; it is never added and never dropped in silence.
- C3: An occurrence or schedule in a currency other than the base currency is listed with its own currency and left out of every figure (A2, B1, C2').
- C4: The base currency comes from settings; each amount's currency from its record.
- T1: "Today" is `useToday()` (book time zone); windows of 7, 45 and 365 days count calendar days from it.
- T2: Does not apply: business-day shifts are already applied by the server to `expected_on`.
- B1: Does not apply: no table.
- B2: Does not apply: no operation.
- B3: Does not apply: no setting.
- D1, D2, D3, D4, D5: Does not apply: no table, schema, recorded fact, import or diagnostic field.
- S1: Does not apply: no operation; the tab reads `listOccurrences`, `listSchedules`, `listAccounts` and `getSettings`.
- S2: Does not apply: `/planning` is desktop-only (ADR 027, S3).
- S3: The actions stay the same; the guide article `schedules_and_occurrences.md` gains one paragraph on what each tab summarizes.
- S4: Does not apply: the assistant reads schedules and occurrences through its existing tools.
- X1: Does not apply: no server scenario; the web tests that cite S29 keep the price change on the subscriptions tab (C4).
- X2: The agenda test with base currency EUR and an occurrence in USD (existing), and a subscriptions test with one subscription in USD left out of the total.
