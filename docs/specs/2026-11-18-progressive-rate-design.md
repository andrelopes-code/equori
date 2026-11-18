# Progressive rate of a fixed income security

Coverage row F-05 of `docs/domain/br-product-coverage.md`; phase 6 of `docs/specs/2026-11-18-assistant-parity-and-br-instruments-design.md`. Issue andrelopes-code/equori#56.

## 1. Goal

A CDB whose rate rises with the time it is held (CDB progressivo) is valued at the rate its holding period has reached, under the rule its issuer states: the new rate applies from the issue date (retroactive) or from the day it starts (stepped).

## 2. Rules

| ID | Rule | Basis |
|---|---|---|
| PR1 | The terms of a security may hold rate steps: each step has `after_days`, the days held from the issue date after which it applies (above 0, increasing), and the `percent_of_index_bp` and `spread_bp` it takes. The terms' own percent and spread hold before the first step. | The products step at fixed periods of the holding (six months, one year); the issue date of a bank CDB is the day of the application. |
| PR2 | `rate_steps_apply` is `retroactive` or `stepped`. Retroactive: the price on a day is the accrual of the whole period since the issue at the step that day has reached. Stepped: each step accrues from its own day, chained to the price the previous step reached. | Santander, ficha do CDB Progressivo (retroactive); other issuers step per period. The issuer's terms decide. |
| PR3 | A security without steps accrues as before. | |
| PR4 | A step day is counted in calendar days from the issue date; the price of a step starts on the first priced day on or after it. | The accrual prices business days of a daily index and weekdays otherwise. |

## 3. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: the steps are terms of the security, the same in every region. |
| R2 | A region without an index keeps the pre-fixed accrual; steps apply to its spread. |
| R3 | `rate_steps_apply` is a closed set of two rules of accrual, not a regional value. |
| R4 | Does not apply. |
| R5 | No screen text in this slice: the steps are written through the terms API and the tools. |
| R6 | Does not apply. |
| C1 | The price stays the accrual of `face_value`, integer minor units. |
| C2 | Does not apply. |
| C3 | Does not apply. |
| C4 | Does not apply. |
| T1 | The step day counts calendar days from `issued_on`. |
| T2 | The days priced follow the index and calendar of the terms, unchanged. |
| B1 | The steps live in `marketdata_fixed_income_rate_step`, keyed by the instrument as the terms are; a book owns its contract (A236 FC1) and reaches its steps through it. |
| B2 | The terms operation keeps its role. |
| B3 | Does not apply. |
| D1 | The table is a fact of the instrument: exported with the terms. |
| D2 | One migration: the table and the column `rate_steps_apply`. |
| D3 | The terms are replaced whole, as before. |
| D4 | Does not apply. |
| D5 | Does not apply. |
| S1 | No new operation; `putInstrumentTerms` and the terms of `record_fixed_income` take the steps. |
| S2 | Does not apply: no screen in this slice. |
| S3 | The guide article `fixed_income_br` names the steps. |
| S4 | `record_fixed_income` takes `rate_steps` and `rate_steps_apply`. |
| X1 | S626 a retroactive step, S627 a stepped one. |
| X2 | The accrual test runs on a pre-fixed security, which needs no region. |
