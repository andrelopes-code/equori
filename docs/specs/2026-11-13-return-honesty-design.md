# Return honesty

Corrections to the section "How it performed" of `/portfolio` after the owner review of 2026-11-13 on the demo book. Amends `docs/specs/2026-11-09-return-clarity-design.md` (verdict of RC2, PC11 figure), `docs/specs/2026-11-06-return-index-comparison-design.md` (R8 period reasons, R23 texts) and investments design 4.3 (longest period of a return).

## Findings

| ID | Observed on the demo book, period 2025-11-14 to 2026-11-13 | Cause |
|---|---|---|
| F1 | The period return is 13.77% to 2026-11-12 and 16.78% to 2026-11-13; TSELIC29 goes from 16,022.86 to 19,607.63 in one day. | The accrual of a fixed income security ignores the prices that outrank it: the series alternates between the manual price of month-ends and the accrual of the other days, 22% apart. |
| F2 | The verdict states 13.77%, the inflation block 13.77% and 10.59% for "Portfolio", the money panel a result to 2026-11-13. | The verdict takes `benchmark.return_bp` (248 CDI days to 11-12), the inflation block `inflation.return_bp` (whole months 12-01 to 10-31); the bar label is "Portfolio" in both. |
| F3 | "Carteira inteira" does not say what it holds. | The option measures every brokerage tree; savings, reserves and checking accounts are other options of the same select. |
| F4 | The opening balance, net deposits, gain and closing balance carry no definition. | No text defines them. |
| F5 | Choosing the reserve account draws a lone full-width figure "Period return". | `PortfolioReturn` passes `subject="portfolio"` for an account; `single_credit` hides the verdict, so the bare branch draws the figure. |
| F6 | The reason "Só um crédito de rendimento registrado" shows on an account with 13 monthly credits. | Each deposit between two month-end credits restarts the comparison (R20); one credit follows the last restart. |
| F7 | No period above 366 days. | `MaxReturnDays = 366`. |
| F8 | From 2023-11-14 to 2024-11-13 the portfolio grows from 19,631.81 to 37,888.09 with 1,100.00 of flows: 87.36%. | The monthly fundings from the opening balances account are no flow: an external flow counts only asset and liability accounts. |
| F9 | From 2023-11-14 to 2024-11-13 the bars compare the portfolio over 365 days with the CDI over 68 days. | The stored CDI rates start on 2024-08-12; the compared return of a tree without recorded yield starts at the period's start. |

## Rules

**HR1 Anchored accrual.** The accrued price of a day after a price that outranks the accrual (priority below 4: manual, csv, official feed) is that price times the accrual of the day over the accrual of the price's day: `observed(d0) × A(d) / A(d0)`, `d0` the latest such price on or before the day, `A(d0)` the accrual of the latest priced day on or before `d0`. A day before every such price, or whose `d0` precedes the first priced day, keeps the unanchored accrual. Recording a price that outranks the accrual deletes the accrued prices of its instrument and quote dated after it; the next tick computes them again. A migration deletes the accrued prices of every instrument that holds such a price, so the next tick anchors the stored history.

**HR2 Longest period.** A return covers at most 3,660 days (`MaxReturnDays`), ten years with their leap days. The return section offers the presets "Last 12 months", "Last 3 years", "Last 5 years" and "Last 10 years", each ending at the valuation date.

**HR3 Verdict.** The verdict states the period return alone: "No período, {subject} rendeu {return}". A period above 366 days adds ", {annual} ao ano": `(1 + return)^(365 / days) − 1`, `days` counted from `from` to `to` inclusive. Without a period return, the portfolio states the personal rate as a sentence of the same size ("No período, a sua taxa pessoal foi de {annual} ao ano"); the figure card of PC11 is removed.

**HR4 Comparison windows.** Each comparison block names its window as the window of both bars: "Carteira e {index} de {from} a {until} · {days} dias" and "Carteira e {inflation} de {from} a {until}". A help button beside the heading explains why the window differs from the period.

**HR5 Scope.** The option measuring every brokerage tree reads "Todas as corretoras" ("All brokerages"). A help button beside the select defines it. A selected account is the subject `account`.

**HR6 Definitions.** Each row of the money panel and the verdict carry a help button. The button is a ghost `IconButton` with the glyph `circle-question`, named "Sobre {term}", with `cursor: help`, under a Slotted `Tooltip` that describes it. Every fact of a tooltip is also in the guide article `investments.md` (Slotted tooltip rule: a tooltip is never the only place a fact is written).

**HR7 Period reasons.** Without `benchmark`, the period return reads true for every reason but `no_yield_recorded`, `nothing_held` and `too_small`: those three read as zero or as rounding. The rule holds on the return section, the Yield tab and the Yield column of the Accounts screen, which read the same function.

**HR8 Restarted single credit.** A tree whose comparison start moved to its last credit because of a flow reports `single_credit_after_flow` in place of `single_credit`. Text: "Só um crédito de rendimento depois do último aporte ou retirada". The text is one short sentence like the other reasons: the yield column of a row wraps a long one onto several lines.

**HR9 Layout.** The money panel takes the whole width when no comparison exists.

**HR10 Equity flows.** A posting on an equity account outside the tree (opening balances, adjustments, transfers in transit) is an external flow, as an asset or liability posting is. Amends investments design 4.3.

**HR11 Index history.** The return compared with an index, for a tree without recorded yield, starts on the first day the comparison has a rate: an index whose stored history starts after the period leaves the earlier days out of both bars.

## Cross-cutting questions

- R1: The CDI and IPCA come from the region's index defaults; no new regional value.
- R2: A region without an index shows the verdict, the money panel and the reason text; HR4 does not apply.
- R3: `unavailable_reason` keeps its pattern; `single_credit_after_flow` matches it.
- R4: Does not apply: no extension point.
- R5: Every new text has a pt-BR and an en catalog key.
- R6: Percentages through `formatBasisPoints`, dates through `formatDate`, both from the active tag.
- C1: Prices stay decimals of 12 places computed with `big.Float`; the annual rate is a display value of basis points.
- C2: Does not apply: no sum across currencies is added.
- C3: Unchanged: a report in another currency than the index states `currency_mismatch`.
- C4: Amounts stay on `useMoneyFormat()`.
- T1: `days` of HR3 is the calendar span of the request; "today" stays `platform/clock`.
- T2: The CDI days remain the index's published rates.
- B1: Does not apply: no table.
- B2: Does not apply: no operation.
- B3: Does not apply: no setting.
- D1: Does not apply: no table.
- D2: One migration deletes derived accrued prices (HR1).
- D3: Does not apply: accrued prices are derived, recomputed by the tick.
- D4: Does not apply.
- D5: Does not apply.
- S1: No operation; `getReturn` changes its documented limit and `unavailable_reason` gains a value.
- S2: Does not apply: `/portfolio` is desktop-only (ADR 027).
- S3: `investments.md` states the 3,660-day limit, the scope of "All brokerages", the definitions of HR6 and the windows of HR4.
- S4: Does not apply: the tool view of the return keeps its fields.
- X1: Does not apply: no scenario added; HR1, HR2 and HR8 are tested through `internal/apitest` and the module tests.
- X2: Unchanged by this change.
