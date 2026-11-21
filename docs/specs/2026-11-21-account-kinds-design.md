# Property and loan accounts: their own figures, chart, actions and list line

The page and the list row of an account drew one template for every kind. A property and a loan
read as a checking account: an import action, a 30-day projection, a reconciliation against an
institution, and a chart scaled to the data, where a revaluation of 2.2% drew a vertical fall.

This spec gives the two kinds whose balance means something other than cash their own figures,
chart, header actions and list line. Every value is derived on the client from existing
endpoints; the API and the schema do not change.

## Rules

| ID | Rule |
|---|---|
| K1 | A property's acquisition is the first non-zero point of its balance series since `opened_on`: its date and its value. |
| K2 | A property's change since acquisition is the current booked balance minus the acquisition value, also written as a fraction of it. |
| K3 | A loan finances a property when one transaction of the property posts a positive amount to the property and a negative amount to that loan. |
| K4 | The own share of a property is its value minus the outstanding debt of the loans that finance it (K3). Without such a loan the figure is not drawn. |
| K5 | A loan's financed amount is the sum of its negative postings. Its outstanding debt is the opposite of its booked balance. Its principal repaid is the financed amount minus the outstanding debt. |
| K6 | The interest a loan paid is the sum of postings to the system account `interest` in the transactions that post a positive amount to the loan. |
| K7 | A loan's remaining installments come from the transfer schedule whose `counterpart_id` is the loan and that has `ends_on`: the occurrences of its last term after today and before `ends_on`, counted for a monthly recurrence. The last of them is the payoff date. Another frequency or a schedule without `ends_on` draws no count and no date. |
| K8 | The chart of a property or a loan covers `opened_on` (at most 3660 days back, the limit of `/reports/balances`) to today, as a step line on an axis that holds zero. A loan's line is its outstanding debt, a positive amount. No projection is drawn. |
| K9 | A property's header has one solid action, "Revalue", which opens the balance assertion; "New transaction" moves to the menu and "Import statement" is not offered. Its status mark reads "Valued on {date}", and the reconciliation tab reads "Valuations". |
| K10 | In the list, a property's amount carries the change since acquisition (K2) on the line under it, and its status reads "Valued on {date}". A loan's status reads its repaid share and its payoff month (K5, K7) instead of the reconciliation status. Neither draws the 90-day trend. |

## Cross-cutting questions

- R1: Does not apply: no regional value; the schedule's calendar already places its occurrences.
- R2: Does not apply: the derivations hold in every region.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: Keys `property.*`, `loan.*` and the status, tab and action keys of K9 and K10, in `catalog-accounts.en.ts` and `catalog-accounts.pt-BR.ts`.
- R6: Amounts through `useMoneyFormat()`, fractions through `numberFormatter`, dates through `formatDate` and a month-year through `Intl` of the active tag.
- C1: Integer minor units with the account's currency; the fraction of K2 and K5 is a number derived from two integers of one currency.
- C2: K4 subtracts the loan's debt only when the loan's currency equals the property's; a loan in another currency is left out of K4 and the note says no figure.
- C3: Every figure is in the account's currency; none converts to the base currency.
- C4: The currency comes from the account record.
- T1: "Today" is `useToday()`, the book's date.
- T2: Does not apply: the occurrence dates come from the schedule's own recurrence day.
- B1: Does not apply: no table.
- B2: Does not apply: no operation.
- B3: Does not apply: no setting.
- D1: Does not apply: no table.
- D2: Does not apply: no schema change.
- D3: Does not apply: no fact changes; "Revalue" records a balance assertion, as "Record balance" did.
- D4: Does not apply: no write from a bank, file or model.
- D5: Does not apply: no diagnostic field.
- S1: Does not apply: no operation.
- S2: `/accounts` and `/accounts/$id` are phone routes; the figures stack in one column and the chart keeps its width.
- S3: The guide article `accounts_and_categories` states the figures of a property and a loan.
- S4: Does not apply: the assistant reads balances and schedules through its existing tools.
- X1: Does not apply: no server behavior; the rules are tested on the client functions.
- X2: Does not apply: R1, R2, C2 and C3 add no conversion; the test of C2 uses a loan in USD beside a property in BRL.
