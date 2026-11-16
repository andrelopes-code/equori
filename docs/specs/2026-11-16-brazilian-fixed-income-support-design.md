# Brazilian fixed income and income support

Status: approved by review of 2026-11-16 (amendment A235 of P8)

## 1. Intent

A Brazilian investor holds bank securities (CDB, RDB, LC, LF, LCI, LCA), securitized and corporate securities (CRI, CRA, debentures), Tesouro Direto bonds and funds, and receives dividends, JCP, fund distributions, coupons and interest. Each product has its own tax rule, and the rule changes by date. equori classifies the tax class and the treatment of an income by subtype (`internal/portfolio/jurisdiction/br/br.go`), but three rules in the code differ from the law in force in November 2026, and the redemption of a taxed security has no estimate of the tax the broker withholds.

## 2. Rules in force (research of 2026-11-16)

| Product or income | Individual, Brazil | Source |
|---|---|---|
| CDB, RDB, LC, LF, common debenture, Tesouro | Income tax at source on the gain, regressive by days from each purchase: 22.5% up to 180, 20% from 181 to 360, 17.5% from 361 to 720, 15% above | Lei 11.033/2004, art. 1 |
| IOF on those securities | Regressive by day on the gain, 96% on day 1 down to 0 on day 30; the income tax base is the gain less the IOF | Decreto 6.306/2007, art. 32 |
| LCI, LCA, CRI, CRA, incentivized debenture | Exempt; MP 1.303/2025 lapsed on 2025-10-08; a bill that creates 7.5% at source was filed in November 2026 and is not law | Lei 11.033/2004, art. 3; Lei 12.431/2011 |
| Interest on equity (JCP) | 15% at source up to 2025-12-31; 17.5% from 2026-01-01 | Lei Complementar 224/2025 |
| Dividend | Exempt; from 2026-01-01 a source that pays one individual more than R$ 50,000 in a month withholds 10% of the whole amount | Lei 15.270/2025 |
| Listed FII and Fiagro distribution | Exempt under the conditions of the law | Lei 11.033/2004, art. 3; Lei 15.270/2025 leaves it unchanged |
| LIG, LCD, CDCA | Treatment not confirmed from a primary source | none |

## 3. Goals, non-goals, anti-goals

Goals:

- G1. The default withholding of a JCP follows the payment date.
- G2. A distribution of a listed FII reads `exempt`.
- G3. LC, LF and a common debenture have a subtype of their own, so a book and the assistant name them.
- G4. A redemption or sale of a taxed fixed income security in a Brazilian book shows the income tax and the IOF a broker withholds, estimated from the lots (A234).

Non-goals:

- NG1. A default withholding of the 10% dividend rule: it needs the month's total per source, and the notice of the broker is exact.
- NG2. Treatment of LIG, LCD and CDCA: no primary source confirms it, so they take no subtype; the assistant tells the user to confirm with the issuer.
- NG3. Come-cotas and the tax of funds.
- NG4. A coupon schedule inside the terms of a security: a coupon paper takes the Price of its issuer (guide article `fixed_income`).

Anti-goals:

- AG1. The estimate never fills `taxes` or `withheld` by itself: the value the user records is the value of the notice.
- AG2. No tax rate in the web or in a literal outside the region implementation.

## 4. Decisions

| ID | Decision | Reason |
|---|---|---|
| FS1 | `DefaultWithholdingBP(region, incomeType string, date time.Time)` in `internal/ledger/region_defaults.go`: `BR` with `jcp` returns 1500 before 2026-01-01 and 1750 from that date; any other pair returns 0. The port `RegionDefaults.WithholdingBP` takes the date of the income. | Extension point under ADR 016; the rate changes by date. |
| FS2 | `Treatment("distribution", "fii")` returns `exempt`; `Treatment("distribution", any other class)` stays `exclusive`. | Lei 11.033/2004, art. 3. |
| FS3 | `br.Subtypes("fixed_income")` adds `lc`, `lf` and `debenture`, each of tax class `fixed_income`. | A taxed security has a name that a book can store. |
| FS4 | `Jurisdiction` gains `Withholding(taxClass string) (WithholdingTable, bool)`; `br` returns the regressive table for class `fixed_income` and none for any other class. The domain function `EstimateWithholding(table, lots, proceeds, date)` takes the consumed lots of a sale (A234), splits `proceeds` over them by units (half to even, the cents left to the oldest lot), and for each lot with a gain returns IOF = gain × IOF rate of the days, then income tax = (gain − IOF) × rate of the days. Days count from the acquisition date of the lot to the sale date. | The tax of each lot depends on its own period. |
| FS5 | `GET /api/v1/accounts/{id}/withholding?date=&quantity=&proceeds=` (role `read`) returns `income_tax`, `iof` and `net` for a sale of `quantity` units for `proceeds`, or `404` for an account outside the book and `422` when the account holds no fixed income security taxed at source. | The sale form and the assistant read one estimate. |
| FS6 | The assistant tool `get_portfolio` gains the view `redemption`. | Same estimate for the assistant (S1). |
| FS7 | The guide articles state the dated rules and the estimate. | S3. |

## 5. Scenarios

| ID | Case | Expected |
|---|---|---|
| FS-S1 | JCP of 100.00 without `withheld`, dated 2025-12-31 | Withheld 15.00 |
| FS-S2 | JCP of 100.00 without `withheld`, dated 2026-01-01 | Withheld 17.50 |
| FS-S3 | Distribution of a listed FII in a Brazilian book | Treatment `exempt` in `GET /income-events` |
| FS-S4 | `GET /instrument-subtypes?type=fixed_income` | Adds `debenture`, `lc`, `lf` in order |
| FS-S5 | One lot of 100 units, cost 1,000.00, sold for 1,100.00 after 10 days | IOF 66.00 (gain 100.00 × 66%), income tax (100.00 − 66.00) × 22.5% = 7.65, net 1,026.35 |
| FS-S6 | Two lots (cost 500.00 after 200 days, cost 600.00 after 400 days), sale of both for 1,300.00 | Per lot gain 100.00 and 100.00; no IOF; income tax 20.00 and 17.50 |
| FS-S7 | A sale at a loss | Income tax 0, IOF 0 |
| FS-S8 | An account of a stock, a `lci` or a book outside Brazil | 422 |
| FS-S9 | Roles `owner`, `write`, `read`; a member of another book | 200 for the three roles; 404 |

## 6. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | The JCP rate, the treatment of a distribution, the subtypes and the withholding table vary by country: `internal/ledger/region_defaults.go` (`DefaultWithholdingBP`) and `internal/portfolio/jurisdiction/br/br.go` (`Treatment`, `Subtypes`, `Withholding`). |
| R2 | A region without a case gets withholding 0, no estimate (422) and the universal subtypes. |
| R3 | `subtype` is `^[a-z0-9_]{2,40}$` already; the new subtypes add no `enum`. |
| R4 | One row "Fixed income withholding" in `docs/contributing/regions.md`; the row "Income withholding" names the date. |
| R5 | No new text on a screen beyond the estimate line of the sale form: catalog keys in `pt-BR` and `en`. |
| R6 | The estimate line writes amounts through `useMoneyFormat()`. |
| C1 | Income tax, IOF and net are integers of the cash currency's minor units, rounded half to even per lot. |
| C2 | One currency: the base currency of the lots. |
| C3 | The estimate exists only where the cost is in the base currency, as A234 does. |
| C4 | The line goes through `useMoneyFormat()`. |
| T1 | The dates are calendar dates of the book; days are calendar days between two dates. |
| T2 | No business days. |
| B1 | Does not apply: no table. |
| B2 | `GET /accounts/{id}/withholding` declares `x-book-role: read`; FS-S9 covers the roles and another book. |
| B3 | No setting. |
| D1 | Does not apply: no table. |
| D2 | Does not apply: no schema change. |
| D3 | No recorded fact changes; a recorded withholding is never rewritten. |
| D4 | No bank, file or model writes the estimate. |
| D5 | No diagnostic field. |
| S1 | One operation: `GET /accounts/{id}/withholding`. `get_portfolio` view `redemption` covers it. No new `Problem.code`. |
| S2 | The sale form is a phone route; the estimate line keeps one line at 390 px. |
| S3 | The articles `fixed_income`, `fixed_income_payments` and `investment_income` change. |
| S4 | The view `redemption` of `get_portfolio`. |
| X1 | S456 to S464 map FS-S1 to FS-S9 in order. Each test carries its ID. |
| X2 | FS-S1, FS-S2, FS-S3, FS-S5 and FS-S8 run with region `BR`; FS-S8 also with region `NZ`. |

## 7. Left to the builder

- The tables of IOF by day (1 to 29) in `br`, with the source in a comment.
- A test of `EstimateWithholding` with the fixtures of FS-S5 to FS-S7 before the endpoint.
