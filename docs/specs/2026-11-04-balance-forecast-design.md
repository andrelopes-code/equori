# Balance of the month: every occurrence ahead, and the card statements due

- Status: delivered
- Date: 2026-11-04
- Scenarios: S278 and S279 of `docs/domain/06-scenarios.md`

## 1. Intent

The overview's "Balance of the month" chart draws the balance of the Available accounts in the base currency, realized up to today and forecast to month end. Two rules of the chart leave out what moves that balance:

- The forecast adds only the expected occurrences of the Available accounts (`getProjection`). A card purchase moves the Available balance on the due date of its statement, and no statement enters the forecast. The ubiquitous language defines a projection with the open statements (`docs/domain/02-ubiquitous-language.md`, Projection).
- The chart marks at most three occurrences, each at least eight days from today and from the other marks (`annotatedEvents`). The rule came before Slotted 0.1.0-beta.31, whose chart lays out colliding labels itself: a second row, then the lowest `priority` hidden and named by the tooltip.

## 2. Rules

| ID | Rule |
|---|---|
| B1 | For the current month, each statement that `owedStatements` lists for an open card in the base currency enters the forecast as an outflow of its amount, on its due date when the due date falls between today and month end, and on today when the due date is before today. A statement due after month end does not enter. |
| B2 | A card with an expected occurrence from today to month end whose schedule has the card as its account or counterpart contributes no statement under B1: the schedule already pays it from the Available accounts. |
| B3 | B1 assumes that the Available accounts pay the card statements. The forecast does not name the paying account. |
| B4 | Every forecast event is an upright line on its day, labelled by its description. A statement's description is "{card} statement" / "Fatura {card}". |
| B5 | A line's `priority` is the absolute amount of its event in minor units. The today line has the highest priority. The chart hides the labels that collide past the second row and names them in the tooltip. |
| B6 | A past month draws no forecast, so B1 and B4 add nothing to it. |
| B7 | An occurrence dated today, an overdue one or a statement past due, lowers the forecast from the next day, so the realized and the forecast lines meet on today. On the last day of the month it lowers the forecast of today. |
| B8 | The value axis starts a quarter of the balance's span below the lowest balance, rounded down to the span's order of magnitude, never below zero. A negative or zero balance keeps the chart's own axis. Workaround for Slotted issue #70. |

B1 changes every figure read from the forecast: the forecast balance at month end and the lowest balance ahead.

No regional value enters: the currency comes from settings, and the dates of a statement come from its card.

## 3. Code

| Piece | Place |
|---|---|
| `statementEvents(owed, today, end, paid)` | `web/src/features/overview/forecast.ts`, pure, tested in `forecast.test.ts` |
| Statement queries and B2 | `web/src/features/overview/use-overview.ts`, reusing `statementsQuery`, `currentAndUnpaid` and `owedStatements` |
| `eventLines` | `web/src/features/overview/balance-annotations.ts`: one line per event, with `priority` (B5) |
| `annotatedEvents` | removed with its tests, replaced by B5 |
| `balanceFloor(rows)` | `web/src/features/overview/balance-rows.ts`, B8, tested in `balance-rows.test.ts` |
| Message | `overview.balance.statement` in `catalog.en.ts` and `catalog.pt-BR.ts` |

## 4. Acceptance

- S278: today 2026-11-04. A card statement due on 2026-11-05 owes 1,200.00, and a subscription on the card is expected on 2026-11-30. The forecast on 2026-11-05 is 1,200.00 below the forecast on 2026-11-04. The chart marks "Nubank statement" on 5 November and no line on 30 November.
- S279: four occurrences ahead fall within eight days of each other. The chart draws four lines. Their priorities follow their absolute amounts.
