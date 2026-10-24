# Web interface roadmap

Sequential guide for the screens of `web/`. Each item names the screens, their functions, the API operations they consume and their dependencies. It is not the source of truth: the implementer of an item reads `api/openapi.yaml`, the ADRs, the scenarios of `docs/domain/06-scenarios.md`, `web/CLAUDE.md` and the existing code before designing the screen. Field lists below are a map of the contract, not a form specification.

Status snapshot: 2026-10-24, commit `9ba32b8`.

`/admin` and `web/src/features/admin/` are temporary and leave the application. This roadmap ignores them: an operation reachable only through `/admin` counts as having no screen. Implementers neither reuse nor extend code from `features/admin/`.

## Status legend

| Status | Meaning |
|---|---|
| Delivered | A dedicated screen consumes the operations. |
| Partial | A dedicated screen exists; part of the operations has no screen. |
| Shell | The route exists; the page body is empty. |
| No screen | The operations exist in the API; no screen consumes them. |
| Needs backend | The screen requires an operation that `api/openapi.yaml` does not declare. |

## Summary

| # | Item | Status | Depends on |
|---|---|---|---|
| 1 | Transaction detail: attachments, investment and foreign currency facts | Partial | — |
| 2 | Foreign purchase and currency exchange entry | No screen | — |
| 3 | Aggregator integrations and connections | Partial | — |
| 4 | Institution identifiers | Partial | — |
| 5 | Schedules and occurrences | Delivered | — |
| 6 | Budgets | Delivered | 5 |
| 7 | Overview | Delivered | 5, 6, 10 |
| 8 | Instruments and prices | Delivered | — |
| 9 | Trades and investment income entry | Delivered | 8 |
| 10 | Portfolio | Delivered | 8, 9 |
| 11 | Tax year report of investments | No screen | 9 |
| 12 | Reports | Partial | 10 |
| 13 | Calendars and holidays | No screen | — |
| 14 | Language model settings: usage and privacy | Partial | — |
| 15 | Category suggestions outside capture | Needs ADR amendment | 14 |
| 16 | Assistant chat | Delivered | 14 |
| 17 | Data export | Needs backend | 12 |

## Delivered screens

Outside the sequence. Items 1, 3, 4, 8 and 14 extend some of them.

| Area | Routes | Functions |
|---|---|---|
| Session | `/login` | Sign in, sign out, session expiry. |
| Settings | `/settings` | Sections account, appearance, assistant, finances (base currency, currencies), language and region, privacy mode (ADR 018). |
| Accounts | `/accounts`, `/accounts/new`, `/accounts/$id`, `/accounts/$id/edit`, `/institutions`, `/links` | Balance sheet by group, account page with balance chart and projection, figures, ledger, positions, scheduled with occurrence actions, reconciliation and balance assertions, sync, imports; create, edit, close, reopen, merge, parent, appearance and logo. |
| Imports | `/accounts/$id/import`, `/accounts/$id/imports/$batchId` | OFX and CSV import, CSV profile, batch records, review queue of unconfirmed records. |
| Cards | `/cards`, `/cards/$accountId`, `/cards/$accountId/statements/$statementId` | Card list, card page with statements chart, plastic cards, installment plans, settings (billing cycle rules, credit limits); statement page with lines, payment, financing, refunds, anticipation, disputes, statement facts and reconciliation. |
| Transactions | `/transactions`, `/transactions/new`, `/transactions/$id`, `/transactions/$id/correct`, `/transactions/capture` | Ledger by day with filters (account, category, payee, tag, period, text, uncategorized); detail with postings, categorization, links, history, attachments upload; create, correct, void, transfer, reimburse, bulk categorize; text capture with category suggestions. |
| Categories | `/categories`, `/categories/rules`, `/categories/rules/new`, `/categories/rules/$id`, `/categories/payees` | Category tree with totals and coverage, merge; rules with conditions, preview, run, reorder; rule suggestions; payees with aliases, rename, merge; source categories mapping. |
| Goals | `/goals` | Goal cards with meter, what-if, create, edit, delete. |
| Planning | `/planning`, `/planning/schedules/new`, `/planning/schedules/$id` | Agenda of a month with overdue group, filters, month totals and calendar; occurrence actions (realize, unrealize, skip, move); schedules by kind; schedule creation with recurrence builder; schedule page with terms versions, change terms, pauses, end and occurrences; subscriptions with monthly and yearly cost and price history. |

---

## 1. Transaction detail: attachments, investment and foreign currency facts

Status: Partial.

Existing code: `features/transactions/transaction-detail.tsx`, `attachments-section.tsx`, `transaction-facts.tsx`, `postings-table.tsx`.

Operations: `getAttachmentContent` (no consumer). `getTransaction` already returns `trade`, `investment_income` and `postings[].original`; no screen renders them.

Functions:
- Attachment preview: image thumbnail and PDF first page in the attachment list; a viewer with zoom, page navigation and download. On phone width the viewer opens full screen with swipe between attachments.
- Attachment metadata: file name, media type, size, upload time.
- Trade facts: side, instrument, quantity, unit price, gross, fees, taxes, cost at average price (sell only), security account and cash account as links.
- Investment income facts: income type, gross, withheld, net, security account and cash account.
- Foreign currency facts: per posting, original amount and currency beside the booked amount; the implied rate.

## 2. Foreign purchase and currency exchange entry

Status: No screen.

Operations: `recordForeignPurchase`, `exchangeCurrency`; `listPrices` for a suggested rate.

Scenarios: S16, S17.

Existing code: `features/transactions/entry-kind-picker.tsx` offers expense, income, transfer and advanced. `new-transaction-page.tsx`, `transaction-form.tsx`.

Functions, foreign purchase:
- Fields: card account, date, payee, description, category, original amount and currency, rate, optional foreign charge rate in basis points with its category, optional statement.
- Live result: converted amount, foreign charge amount and total charged, recomputed on every change of amount, rate or charge rate.
- Rate suggestion from the stored price of the date, with its source; the person can overwrite it.
- Statement placement preview, as the purchase form of cards shows it (`getStatementPlacement`).

Functions, currency exchange:
- Fields: from account, to account, date, description, from amount, to amount, optional fee with category.
- One of the two currencies is the base currency (the API rejects the request otherwise); the form restricts the second account to accounts that satisfy it.
- Live result: effective rate in both directions, compared with the stored price of the date.

Region: currencies and rate sources come from the user's settings and the price source registry (ADR 016).

## 3. Aggregator integrations and connections

Status: Partial. Delivered: `listConnections`, `createConnection`, `syncConnection`, `mapExternalAccount` (`features/accounts/links-page.tsx`, `link-drawer.tsx`, `sync-tab.tsx`). No screen: `listAggregators`, `listIntegrations`, `createIntegration`, `getIntegration`, `deleteIntegration`, `updateIntegrationCredentials`, `getConnection`, `deleteConnection`.

Scenarios: S51, S57, S59. Reference: ADR 008, `docs/operations/pluggy.md`.

Functions, integrations (settings section):
- List of integrations with aggregator, name, last credentials update and the number of connections that use each.
- Create: choose an aggregator from `listAggregators`; the form fields come from its `credential_fields`, not from literals. Secret fields are write-only; after saving the screen shows only that a credential exists.
- Rotate credentials: replace them; the aggregator validates them before the API stores them, and a rejection keeps the earlier credentials.
- Delete: allowed only without connections (`409 integration_in_use`); the dialog lists the connections that block it.

Functions, connection detail (from `/links`):
- Header: name, state (`ok`, `needs_owner`, `failed`), provider status, last and next aggregator update, last sync, last error.
- External accounts table: type, subtype, name, last four digits, currency, state (`pending`, `mapped`, `ignored`), mapped account link, sync start date, last synced date; mapping actions.
- Sync now, with the resulting batches linked to `/accounts/$id/imports/$batchId`.
- Delete connection: the dialog states that imported records and batches stay.
- `needs_owner` state: a call to action that tells the owner to act at the aggregator.

## 4. Institution identifiers

Status: Partial. Delivered: `setInstitutionIdentifier`. No screen: `listInstitutionIdentifierSchemes`.

Existing code: `features/accounts/institutions-page.tsx`, `institution-field.tsx`.

Functions:
- Scheme select filled by `listInstitutionIdentifierSchemes`; identifier input validated against the scheme `pattern` before submit.
- Clear identifier.
- Logo preview, since an identifier keys the institution logo (ADR 013).

## 5. Schedules and occurrences

Status: Delivered. Operations: `listSchedules`, `createSchedule`, `getSchedule`, `listOccurrences`, `realizeOccurrence`, `unrealizeOccurrence`, `skipOccurrence`, `moveOccurrence`, `changeScheduleTerms`, `pauseSchedule`, `endSchedule`, `listCalendars` (`features/planning/`; occurrence actions also in `features/accounts/scheduled-tab.tsx`; occurrences realized by a transaction on its detail, read from the occurrences 31 days either side of its date).

Scenarios: S27, S28, S29, S62. Domain: phase P7.

Route: a top-level planning destination, for example `/planning`, with the tabs agenda, schedules and subscriptions.

Functions, agenda:
- Occurrences in a range of at most 366 days, grouped by day; desktop adds a month calendar beside the list.
- Filters: state (`expected`, `overdue`, `realized`, `skipped`), schedule, account, kind.
- Each row: date, moved-from date when moved, description, kind, account, expected amount, state; overdue rows first in their own group.
- Row actions: realize (choose the transaction from a list of transactions of the account around the expected date and amount, within the schedule's `match_tolerance_bp` and `grace_days`), unrealize, skip with optional reason, move to a date.
- Month totals of expected inflow and outflow.

Functions, schedule list:
- Schedules by kind (`bill`, `income`, `subscription`, `transfer`, `savings`) with account, counterpart, current amount, recurrence in words, next occurrence, end date.

Functions, schedule form (create):
- Kind, account, counterpart, payee, description, amount.
- Recurrence builder: frequency, interval, day of month, weekday with ordinal, business day ordinal, weekend adjustment (`none`, `following`, `preceding`, `modified_following`), start, until or count.
- Preview of the next occurrences computed by the server after creation; before creation, the form states the rule in words.
- Advanced: calendar, match tolerance, grace days.

Functions, schedule detail:
- Terms history: each version with effective date, amount and recurrence.
- Change terms from a date after the latest version (amount, recurrence or both).
- Pauses: list and add a pause range.
- End from a date: the dialog states that expected occurrences from that date are removed and realized ones stay.
- Occurrences of the schedule, past and future.

Functions, subscriptions:
- Schedules of kind `subscription` with monthly and yearly cost, price change history from the terms versions, pause and end actions.

Integration with other screens:
- Transaction detail: occurrences realized by the transaction, with unrealize. `listOccurrences` has no `transaction_id` filter; the lookup queries the schedule's occurrences around the transaction date.
- `/transactions` upcoming rows and `/accounts/$id` scheduled tab gain the row actions of the agenda.

Region: the calendar default comes from the user's region (ADR 016); weekday and month names come from the locale.

Not delivered:
- Upcoming rows in `/transactions`: the ledger lists none since commit `8d59d23`; the agenda and the account's scheduled tab carry the row actions.
- Marks on the calendar's days: Slotted finding "A calendar day cannot carry a mark of what falls on it".
- The server does not check `match_tolerance_bp` on a manual realize; the realize dialog marks the candidates outside it.

## 6. Budgets

Status: Delivered. Operations: `listBudgets`, `createBudget`, `getBudget`, `addBudgetAmount`, `getBudgetProgress`, `getCommitted`, `getCategoryTotals` (`features/planning/`: the budgets tab of `/planning`, `/planning/budgets/new`, `/planning/budgets/$id`). The month view leaves out a budget whose first month follows the chosen month.

Operations: `listBudgets`, `createBudget`, `getBudget`, `addBudgetAmount`, `getBudgetProgress`, `getCommitted`, `getCategoryTotals`.

Scenarios: S60, S63, S66.

Route: a tab of the planning destination or its own destination.

Functions, budget month view:
- Month selector.
- One row per budgeted category: planned, carried from earlier months (rollover), spent, available; a meter of spent against planned plus carried; overspent state.
- Category hierarchy from the category tree, with subtotals per parent.
- Unbudgeted spending: expense categories with totals in the month and no budget (from `getCategoryTotals`).
- Committed in the month (`getCommitted`): installments, expected occurrences and total; the prices used when amounts are in another currency.

Functions, budget form:
- Category (one budget per category; `409 budget_exists` leads to the existing budget), monthly amount, first month, rollover.

Functions, budget detail:
- Amount history by month; add an amount from a month after the latest one.
- Progress of the last months as a chart of planned against spent.
- Link to `/transactions` filtered by the category and month.

## 7. Overview

Status: Delivered. `features/overview/` draws one block per question; each block reads its own queries and fails alone. The net worth block links to Accounts because net worth includes liabilities and `/portfolio` shows none; the attention list links connections to `/accounts/links`.

Operations: `getNetWorth`, `listBalances`, `getBalanceSeries`, `getAccountFlows`, `getCategoryTotals`, `listOccurrences`, `getCommitted`, budgets (item 6), `listStatements`, `listGoals`, `listConnections`, `getReconciliationStatus`, `listTransactions` with `uncategorized`.

Functions, one block per question, each linked to the screen that owns its data:
- Net worth: assets, liabilities, net, in the base currency; change against the previous month.
- Month flows: inflow, outflow and result of the current month; forecast to month end from expected occurrences.
- Spending by category in the month, top categories.
- Upcoming: occurrences of the next days and overdue ones, with the agenda actions of item 5.
- Cards: open and closed statements with due date and amount.
- Budgets: categories over or near their amount.
- Goals: progress summary.
- Attention list: uncategorized transactions, unconfirmed import records, connections in `needs_owner` or `failed`, accounts whose reconciliation status has an open difference.

Layout: desktop shows a grid of blocks; phone width shows one column ordered by the attention list first. Privacy mode masks every amount (ADR 018).

## 8. Instruments and prices

Status: Delivered. `features/instruments/` holds the catalog (`/instruments`), the instrument page (`/instruments/$code`), the price import and the fixed income terms. The ledger section of settings links to the catalog; `defineInstrument` had no screen there. The catalog reads the latest price of each instrument with one `listPrices` call over 366 days, because the contract has no latest-price operation. `listPositions` answers for every account, so the instrument page filters it by instrument code.

Reference: `docs/superpowers/specs/2026-10-23-investments-design.md` sections 4.1 and 4.2, `docs/operations/price-feeds.md`.

Route: an instruments destination, for example `/instruments` and `/instruments/$code`.

Functions, catalog:
- Instruments by type (`currency`, `stock`, `etf`, `reit`, `depositary_receipt`, `fixed_income`, `fund`, `crypto`) with code, name, subtype, quote currency, exchange, latest price and its date.
- Define instrument: code, type, scale, name, quote currency, exchange, subtype; the subtype select comes from `listInstrumentSubtypes` for the chosen type.

Functions, instrument page:
- Price history chart and table for a range of at most 366 days, with the source of each price.
- Record a manual price for a date; a manual price of the same date is replaced, and the form states it.
- Fixed income terms (type `fixed_income`): issue date, maturity, index, percent of index, spread, day count (`bus252`, `act365`), face value. Saving replaces earlier terms and the prices accrued from them; the confirmation states it.
- Positions that hold the instrument, linked to their accounts.

Functions, price import:
- CSV upload; the import is all or nothing; the result shows the number of recorded prices or the problem returned by the API.

## 9. Trades and investment income entry

Status: Delivered. Operations: `recordTrade`, `recordInvestmentIncome`, `listInvestmentIncomeTypes`, `listPositions`, `listPrices` (`features/transactions/`: the trade and investment income kinds of `/transactions/new`, also opened from the security account page with `?kind=` and `account_id`). `TradeInput` and `InvestmentIncomeInput` have no instrument field: the security account holds the instrument. Withheld is always sent; the jurisdiction default for a type is not assumed.

Operations: `recordTrade`, `recordInvestmentIncome`, `listInvestmentIncomeTypes`, `listPositions`, `listPrices`.

Scenarios: S21, S22, S64, S65.

Entry points: the new transaction flow and the security account page.

Functions, trade:
- Side (buy, sell), security account, cash account of the same brokerage, date, quantity, unit price, fees, taxes with category, description.
- Live result: gross, total cash effect; on a sell, the current position and average cost, and the estimated result against average cost.
- Sell quantity limited to the position at the date.

Functions, investment income:
- Security account, cash account, income type from `listInvestmentIncomeTypes`, date, gross, withheld with category, category, description.
- Live result: net amount.

Region: income types and tax treatment come from the user's jurisdiction; no literal type.

## 10. Portfolio

Status: Delivered. Operations: `listPositions`, `getAllocation`, `getReturn` (`features/portfolio/`: `/portfolio`; `listPositions` also per account in `features/accounts/positions-tab.tsx`). `listPositions` takes no `value_in`, so the positions stay in the base currency and the valuation currency applies to the allocation and the return only. The return has no whole-portfolio form: the contract takes one account tree, so the screen offers the investment accounts and their parents.

Reference: investments design section 4.3.

Route: a portfolio destination, for example `/portfolio`.

Functions:
- Date selector for the valuation date.
- Positions across security accounts: instrument, account, quantity, average cost, cost basis, market value, unrealized result, share of total; grouping by account or by instrument.
- Allocation by instrument type, currency or institution (`by`), value and share; displayed as a proportional chart with a table.
- Return: money-weighted annual return of the portfolio or of one account over a period of at most 366 days, with opening value, closing value and the external flows of the period.
- Valuation currency selector (`value_in`).
- Positions without a price at the date are marked as unvalued.

## 11. Tax year report of investments

Status: No screen.

Operations: `listRealizedResults`, `listIncomeEvents`.

Scenarios: S64, S65.

Functions:
- Year selector.
- Realized results: one row per sale with date, instrument, account, quantity, cost, proceeds, result and tax class; totals by month and by tax class.
- Income events: date, instrument, account, income type, tax treatment, gross, withheld; totals by tax treatment.
- Each row links to its transaction.

Region: tax classes and treatments come from the user's jurisdiction.

## 12. Reports

Status: Partial. Delivered inside other screens: `getCategoryTotals` (`features/categories/category-charts.tsx`), `getAccountFlows` (`features/cards`), `getBalanceSeries` (`features/accounts`). No screen: `getNetWorth`.

Route: a reports destination, for example `/reports`.

Functions:
- Net worth over time: series built from `getNetWorth` at month ends, with assets and liabilities.
- Income and expense by category for a period of at most 366 days, with drill-down into the subtree and into `/transactions` filtered by category and period.
- Flows by account: inflow and outflow per day or aggregated per month.
- Period comparison: the same report for two periods side by side.

Domain: phase P9 adds accrual and cash views and statement analytics (S30); those operations are not declared yet.

## 13. Calendars and holidays

Status: No screen.

Operations: `listCalendars`, `listHolidays`.

Functions:
- A read-only settings section: the calendars of the instance with their weekend days; the user's calendar first.
- Holidays of a calendar per year with date, name and source (`rule`, `instance`).
- Link from the schedule form (item 5) to the calendar that adjusts its dates.

## 14. Language model settings: usage and privacy

Status: Partial. Delivered in `features/setup/settings-assistant.tsx`: providers, models, chains per use, usage list and limits.

Operations: `listPresets`, `listProviders`, `createProvider`, `updateProvider`, `deleteProvider`, `listProviderModels`, `listUses`, `setUseChain`, `listUsage`, `setUsageLimit`. Declared uses: `capture.suggest`, `assistant.chat`.

Functions to add or verify against the existing section:
- Per use: whether it sends financial data (`sends_financial_data`), the capabilities it needs, and the notice of each target in its chain (`trains`, `local`, `provider_terms`). A use that sends financial data to a target with notice `trains` is highlighted.
- Per provider and model: requests, errors and tokens today; requests and tokens over the period; meters against the declared daily limits; cooling state until `cooling_until`.
- Provider key check through `listProviderModels`, with its result shown on the provider row.

The API returns today and a period total, not a daily series; a usage chart over time needs a new operation.

## 15. Category suggestions outside capture

Status: Needs ADR amendment. ADR 014 decision L1 restricts `suggestCaptureCategories` to capture lines.

Candidate function: in `/transactions` with the uncategorized filter, a bulk action that asks the model for categories of the selected transactions and shows each suggestion for acceptance before `categorizeTransactions` records it. ADR 014 needs an amendment, or a new operation, before the screen exists.

## 16. Assistant chat

Status: Delivered. ADR 020 and `docs/superpowers/specs/2026-10-23-assistant-chat-design.md`. Operations: `getAssistantChat`, `sendAssistantMessage` (Server-Sent Events), `listAssistantConversations`, `getAssistantConversation`, `deleteAssistantConversation`, `deleteAssistantConversations`, `confirmAssistantProposal`, `rejectAssistantProposal` (`features/assistant/`). The use `assistant.chat` runs over 36 tools that cover every operation of `api/openapi.yaml` or exclude it with a reason (`internal/server/tool_exposure_test.go`).

Functions:
- Conversation panel: a drawer beside the current page on desktop, full screen at phone width; opened from the top app bar, the desktop column, the command palette and the key A.
- Notice of the provider and model in use before the first message; a target with notice `trains` states that the provider uses the content sent.
- Answers in a Markdown subset; links to routes of the navigation map navigate in the app, any other link renders as text.
- Progress line per tool step during a turn.
- Proposal card per write: action, target, each change before and after, Confirm and Reject; executed, failed, rejected, stale, discarded, executing and expired proposals show their state without actions.
- Exhausted quota: the time of return in the user's locale, with the input disabled until then.
- Conversation history list with delete and delete all.
- The current route is sent with each message as the page of the question.
- Privacy mode (ADR 018) masks amounts in answers and proposal cards.

Not delivered: tool results rendered as tables or charts inside an answer.

## 17. Data export

Status: Needs backend. Phase P9 lists "export and import round trip"; no operation is declared.

Functions: a settings section to request an export, follow its progress and download the file.
