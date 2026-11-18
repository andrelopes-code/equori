# Coverage of Brazilian investment products

This document states, for each product of the matrix of `docs/specs/2026-11-18-assistant-parity-and-br-instruments-design.md` (section 5), what equori records today. A verdict comes from the code at commit `81a66f7d` and from the test named in the row. A row moves to `TestBRProductMatrix` when its verdict is `supported` and its source was read.

Verdicts:

- `supported`: the product is recorded, priced and reported with the tools named.
- `partial`: the product is recorded, and one fact of it is not; the column Missing names that fact.
- `unsupported`: no instrument type, subtype or event represents the product.

Source status:

- `in code`: the norm is cited in a code comment with the date it was read.
- `to read`: the norm of the row was not read for this document. The row stays out of the matrix test until it is.

## Bank and private fixed income

| ID | Product | Verdict | Evidence | Missing | Source |
|---|---|---|---|---|---|
| F-01 | CDB, percent of CDI, daily liquidity | supported | `TestRecordFixedIncomeS479`; accrual in `internal/marketdata/domain/accrual.go` | none | tax table and IOF: in code (`internal/ledger/region_defaults.go`, Lei 11.033/2004 art. 1, Decreto 6.306/2007 art. 32) |
| F-02 | CDB, pre-fixed | supported | `TestRecordFixedIncomeRates`, case "pre-fixed" | worked example from a published formula | to read |
| F-03 | CDB, IPCA plus spread | partial | `TestRecordFixedIncomeRates`, case "index plus spread" | the monthly index enters by published month without pro rata (`accrual.go`); issuers accrue pro rata by business day with a projected index | to read |
| F-04 | CDI plus spread (debenture, CRI, CRA, CDB) | supported | `TestRecordFixedIncomeCDIPlusSpread` | none | to read |
| F-05 | CDB with a rate that rises with the holding period | unsupported | terms hold one rate (`domain.Terms`) | a rate schedule by holding period | to read |
| F-06 | RDB | supported | subtype `rdb` in `internal/portfolio/jurisdiction/br/br.go`; FGC list | none | FGC: in code (Resolução CMN 4.222/2013, annex II, art. 2) |
| F-07 | LCI, LCA, percent of CDI, minimum term | partial | subtypes `lci`, `lca`, exempt class; `redeemable_from` | the minimum term of the norm is typed by the user, not derived | exemption: in code (Lei 11.033/2004 art. 3); minimum term: to read |
| F-08 | LCI, LCA, IPCA plus spread or pre-fixed | partial | as F-03 and F-07 | as F-03 and F-07 | to read |
| F-09 | LC | supported | subtype `lc`, taxed, FGC list | none | in code |
| F-10 | LF, senior and subordinated | partial | subtype `lf`, taxed, outside the FGC list | no subordinated variant; no rule on redemption before maturity | to read |
| F-11 | LIG | partial | subtype `lig`, classed as taxed and without guarantee | the tax treatment is stated as not confirmed in `investments_br` | to read |
| F-12 | LH, LCD | supported | subtypes `lh`, `lcd`, exempt class, FGC list | none | Lei 11.033/2004 art. 3, II (LH), read on 2026-11-18; LCD: Lei 14.937/2024, to read |
| F-13 | DPGE | unsupported | no subtype; `domain.Guarantee` holds one limit per holder | subtype and a second guarantee limit | to read |
| F-14 | Debenture with half-yearly coupon and amortization | partial | `record_fixed_income` takes `interest_every_months`, `first_payment_on` and `amortizations`; `get_portfolio` view `fixed_income_events` | `manage_instrument set_terms` does not take explicit payment dates (`uncoveredFields`, `putInstrumentTerms.payments`) | to read |
| F-15 | Incentivized debenture | partial | subtype `debenture_incentivada`, exempt class | the tax rule from 2026 onward was not checked | rate of 0% for an individual: Lei 12.431/2011 art. 2, I, read on 2026-11-18 (planalto.gov.br); 2026 rule: Medida Provisória 1.303/2025 is marked there as expired |
| F-16 | CRI, CRA, IPCA plus spread, monthly interest, irregular amortization | partial | subtypes `cri`, `cra`, exempt class; coupons and amortizations as F-14 | as F-03 and F-14; the unit price formula of the registrar was not compared | to read |
| F-17 | CRI, CRA, percent of CDI, CDI plus spread, pre-fixed | supported | as F-01, F-02, F-04 | none | to read |
| F-18 | CDCA | supported | subtype `cdca`, exempt class | none | to read |
| F-18b | CPR, commercial note, LAM | unsupported | no subtype | three subtypes with their tax class | to read |
| F-19 | Redemption within 30 days | supported | `brFixedIncomeWithholding`, `estimate_redemption` | none | in code (Decreto 6.306/2007 art. 32) |
| F-20 | Sale before maturity on the secondary market | partial | `record_investment` kind `sell` with the oldest lot first (`CostMethod`) | the tax of a sale at a price other than the accrued one is not estimated apart | to read |
| F-21 | Indexes IGP-M, Selic, exchange rate | unsupported | the instance stores `cdi` and `ipca` for Brazil | three indexes and their sources | to read |
| F-22 | Savings account (poupança) | partial | account kind `savings`; `yield_mode` `auto` books the yield | the yield rule of the norm is not computed; how `yield_mode` `auto` derives the yield was not checked for this document | to read |

## Government bonds

| ID | Product | Verdict | Evidence | Missing | Source |
|---|---|---|---|---|---|
| T-01 | Tesouro Selic (LFT) | supported | source `tesourodireto`; subtype `tesouro`; codes in `investments_br` | none | to read |
| T-02 | Tesouro Prefixado (LTN) | supported | as T-01 | none | to read |
| T-03 | Tesouro Prefixado with half-yearly interest (NTNF) | partial | as T-01; a coupon is an income of type coupon | the coupon is recorded by the user: no schedule comes from the source | to read |
| T-04 | Tesouro IPCA+ (NTNBP) | supported | as T-01 | none | to read |
| T-05 | Tesouro IPCA+ with half-yearly interest (NTNB) | partial | as T-03 | as T-03 | to read |
| T-06 | Tesouro RendA+ | partial | code `RENDA` | the monthly income phase after the conversion date has no event | to read |
| T-07 | Tesouro Educa+ | partial | code `EDUCA` | as T-06 | to read |
| T-08 | Tesouro IGPM+ (NTNC) | supported | code `NTNC` in `internal/marketdata/feed/tesourodireto` | none | to read |
| T-09 | Custody fee of B3 | partial | a fee is recorded as an expense | no event ties the fee to the bond; the exemption band is not computed | to read |

## Listed securities

| ID | Product | Verdict | Evidence | Missing | Source |
|---|---|---|---|---|---|
| E-01 | Stock, unit, round lot and fractional market | supported | type `stock`; an odd-lot code resolves to its security (`noteOrderFromInput`, `internal/ledger/httpapi/notes.go`) | none | to read |
| E-02 | Sale of stock: monthly exemption, rate, loss carried forward | partial | `get_tax_year` lists each sale with cost, proceeds, result and tax class | the tax due is not computed: no monthly exemption, no rate, no loss carried forward | Lei 11.033/2004 art. 2, II (15%) and art. 3, I (R$ 20,000.00 a month, stocks only), read on 2026-11-18 (planalto.gov.br); loss carried forward: to read |
| E-03 | Day trade | partial | `SeparatesDayTrades` (IN RFB 1.585/2015 art. 65); result kind `day_trade` | as E-02 | separation: IN RFB 1.585/2015 art. 65, in code; rate: Lei 11.033/2004 art. 2, I (20%), read on 2026-11-18; withholding of a day trade: art. 2, § 3 refers to the law in force, to read |
| E-04 | Dividend, JCP | supported | income types; `Treatment` in `br.go`; rules in `investments_br` | none | Lei 15.270/2025 and Lei Complementar 224/2025 art. 8 and 14, read on 2026-11-18 (planalto.gov.br); article `equities_br` |
| E-05 | Bonus, split, reverse split, fraction | supported | `record_corporate_action`; `TestRecordCorporateActionToolS431` | none | to read |
| E-06 | Subscription right and receipt | unsupported | `ActionKind` holds split, reverse_split, bonus and unit_tax | a right as a holding, its exercise and its sale | to read |
| E-07 | Merger, spin-off, ticker change | unsupported | as E-06 | an action that moves cost between two securities | to read |
| E-08 | FII, Fiagro: distribution, amortization, sale | partial | type `reit`; tax class `fii`; exempt distribution | an amortization that lowers the cost has no event; the tax of a sale is not computed | distribution: Lei 11.033/2004 art. 3, III and § 1 (100 holders, below 10%); sale: Lei 8.668/1993 art. 18 (20%); both read on 2026-11-18 (planalto.gov.br) |
| E-09 | ETF of stocks, ETF of a foreign index | partial | type `etf` | as E-02 | Lei 11.033/2004 art. 2, II and art. 3, I (the exemption names stocks only), read on 2026-11-18 |
| E-10 | ETF of fixed income | partial | type `etf` | no tax class for the rate by the term of the portfolio | to read |
| E-11 | BDR | partial | tax class `bdr` | the foreign tax of a dividend has no field of its own; as E-02 for a sale | sale: Lei 11.033/2004 art. 2, read on 2026-11-18; tax of a foreign dividend: to read |
| E-12 | Option, forward, future, securities lending | unsupported | no instrument type | four instrument types with their events | to read |
| E-13 | Brokerage note | supported | `record_brokerage_note`; `TestRecordBrokerageNoteToolS427` | none | to read |

## Funds and others

| ID | Product | Verdict | Evidence | Missing | Source |
|---|---|---|---|---|---|
| U-01 | Fixed income fund, multimarket, come-cotas | partial | subtypes `fixed_income_fund`, `multimarket`; `UnitTax` (Lei 14.754/2023 art. 17 to 19); source `cvmfunds` | long term and short term share one subtype pair, so the rate of 15% or 20% is typed | Lei 14.754/2023 art. 17 to 19, read on 2026-11-18 (planalto.gov.br) |
| U-02 | Equity fund | partial | subtype `equity_fund`, class `fund_equity`, no come-cotas | the tax at redemption is not estimated | to read |
| U-03 | Exempt funds (FI-Infra, incentivized debenture fund) | unsupported | no subtype | a subtype with an exempt class | to read |
| U-04 | FIDC, FIP, closed funds | unsupported | no subtype | subtypes and their tax class | to read |
| U-05 | Pension plan PGBL, VGBL | unsupported | no instrument type | an instrument type, the two tax tables and the contribution deduction | to read |
| U-06 | COE | unsupported | no instrument type | an instrument type | to read |
| U-07 | Crypto asset | partial | type `crypto`; source `coinbase` | no tax class for Brazil | to read |
| U-08 | Stock and ETF held abroad | partial | types `stock`, `etf` in another currency | the annual tax of Lei 14.754/2023 and the rate date of the conversion are not computed | to read |

## Count

| Verdict | Rows |
|---|---|
| supported | 17 |
| partial | 25 |
| unsupported | 11 |

## What the assistant says

A row with the verdict `unsupported` is stated as such by the assistant, with the missing fact; the product is not recorded under another subtype (spec A3). A row with the verdict `partial` is recorded, and the assistant states the fact of the column Missing.
