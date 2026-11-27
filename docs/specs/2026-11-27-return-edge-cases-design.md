# Return edge cases

Corrections to the return report after the audit of 2026-11-27. Amends sections 4.3 and 4.4 of `docs/specs/2026-10-23-investments-design.md` (`annual_bp`, `trailing_return`), A124 (S130), R1 of `docs/specs/2026-11-06-return-index-comparison-design.md` (amendment A208) and HR3 of `docs/specs/2026-11-13-return-honesty-design.md`.

## Findings

| ID | Observed through `GET /reports/return` or the solver | Cause |
|---|---|---|
| F1 | A deposit of 1,000.00 on 2026-10-26, measured from 2026-10-26 to 2026-10-26: `annual_bp` −9999 beside `period_bp` 0. | Every nonzero flow is dated on one day: the present value is 0 at every rate, and the solver returns its lower bound. |
| F2 | A gain of 2% in one day, a loss of 3% in one day, or any gain on the day of the first deposit: 422 `return_undefined`. The account page hides its Yield section and its Yield cell. | The annual rate lies outside [−99.99%, 100,000%]; the report fails before the time-weighted return is computed. |
| F3 | A brokerage emptied by a withdrawal on 2026-10-01 that receives a dividend of 50.00 on 2026-10-26: no `period_bp` for 2025-11-01 to 2026-10-31; the months and windows of the results tab stop at 2026-10. | R1 leaves `period_bp` absent for a subperiod that starts at 0 with a nonzero gain. |
| F4 | With `annual_bp` absent, the screens that state the personal rate have no figure to state. The verdict of HR3 on the portfolio has no caller since the results tab (`docs/specs/2026-11-24-portfolio-results-design.md`) draws the return; the account page and the method layer state the personal rate. | RE2 makes `annual_bp` optional. |
| F5 | A goal over a checking account with a salary of 5,000.00 and expenses of 4,500.00 each month and one transfer of 1,000.00 to savings in the last 12 months: `trailing_return.annual_bp` 44897. | The annual rate discounts the external flows of section 4.3 only: the salary counts as yield. |

## Rules

**RE1 One date.** `annual_bp` is absent when every nonzero flow of the solver, the opening and the closing value included, is dated on one day: no time passes, so no rate exists.

**RE2 Optional annual rate.** `annual_bp` is optional in `ReturnReport`. It is absent under RE1 and when the rate lies outside [−99.99%, 100,000%]. `return_undefined` stays for a period where no money was invested (S127) and for a report where both `annual_bp` and `period_bp` are absent. A goal reads no `trailing_return` without `annual_bp`.

**RE3 Empty start.** Amends R1: outside R19, a subperiod with `V(start) = 0` and no inflow contributes 1 whatever its gain. Such a subperiod holds no invested money: an income paid after the last unit was sold is cash with no base. A subperiod with `V(start) = 0` and an inflow keeps the rule of R1, and `V(start) < 0` with a nonzero gain still leaves `period_bp` absent.

**RE4 Absent personal rate.** Amends HR3: without `annual_bp`, the method layer omits the row "Sua taxa pessoal ao ano", the foot of the account page omits its line "Taxa anual", and the personal sentence of HR3 is not drawn.

**RE5 Flows of a cash tree.** Amends section 4.3 and A124: the annual rate of a tree under R19 discounts the flows of R19, so income and expense other than yield are money in and out, as in its time-weighted return. A goal over a checking account without yield reads 0. S130 records its 50.00 against the Yield account.

## Cross-cutting questions

- R1: Does not apply: no regional value.
- R2: Does not apply: no regional behavior changes.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: Does not apply: no new text.
- R6: Does not apply: no new format.
- C1: Does not apply: no amount is stored; rates stay basis points.
- C2: Does not apply: no sum across currencies.
- C3: Does not apply: the report keeps `value_in`.
- C4: Does not apply: no amount is formatted.
- T1: Does not apply: no date rule changes.
- T2: Does not apply: no business-day count.
- B1: Does not apply: no table.
- B2: Does not apply: `getReturn` keeps its role.
- B3: Does not apply: no setting.
- D1: Does not apply: no table.
- D2: Does not apply: no schema change.
- D3: Does not apply: the report and `trailing_return` are derived.
- D4: Does not apply.
- D5: Does not apply.
- S1: `getReturn` drops `annual_bp` from `required`.
- S2: Does not apply: no layout changes; RE4 removes a row and a line when absent.
- S3: Does not apply: `investments.md` states no figure these rules change.
- S4: The tool view omits `annual_bp` when absent, as it omits zero.
- X1: Does not apply: no scenario added; S130 changes its posting by RE5; RE1 to RE3 and RE5 are tested through `internal/apitest` and the domain tests, RE4 by `return-view.test.tsx`.
- X2: Does not apply.
