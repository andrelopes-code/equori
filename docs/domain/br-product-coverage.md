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
| F-01 | CDB, percent of CDI, daily liquidity | supported | `TestRecordFixedIncomeS479`; accrual in `internal/marketdata/domain/accrual.go`; `TestBRProductMatrix` row F-01: 100% of the CDI of January 2025 (BCB SGS 12), 101,013.20 after 22 rates | none | tax table and IOF: in code (`internal/ledger/region_defaults.go`, Lei 11.033/2004 art. 1, Decreto 6.306/2007 art. 32); accrual window: B3 Caderno de Fórmulas of CDBs, 6.1.2, read 2026-11-18 |
| F-02 | CDB, pre-fixed | supported | `TestBRProductMatrix` row F-02, through HTTP and tools: value 1,000,000.00, income tax 37,002.70, FGC excess 750,000.00 | none | LTN example of the Metodologia de Cálculo of the Tesouro Nacional (14.36% a.a., 532 business days, 753.315323 for 1,000.00), read 2026-11-18; Lei 11.033/2004 art. 1, IV |
| F-03 | CDB, IPCA plus spread | partial | `TestRecordFixedIncomeRates`, case "index plus spread" | the monthly index enters by published month without pro rata (`accrual.go`); issuers accrue pro rata by business day with a projected index | to read |
| F-04 | CDI plus spread (debenture, CRI, CRA, CDB) | supported | `TestRecordFixedIncomeCDIPlusSpread`; `TestBRProductMatrix` row F-04: CDI + 1.5%, 101,144.58 after 22 rates | none | to read |
| F-05 | CDB with a rate that rises with the holding period | unsupported | terms hold one rate (`domain.Terms`) | a rate schedule by holding period | to read |
| F-06 | RDB | supported | subtype `rdb` in `internal/portfolio/jurisdiction/br/br.go`; FGC list; `TestBRProductMatrix` row F-06 against the LTN example of the Tesouro Nacional | none | FGC: in code (Resolução CMN 4.222/2013, annex II, art. 2) |
| F-07 | LCI, LCA, percent of CDI, minimum term | partial | subtypes `lci`, `lca`, exempt class; `redeemable_from` | the minimum term of the norm is typed by the user, not derived | exemption: in code (Lei 11.033/2004 art. 3); minimum term: to read |
| F-08 | LCI, LCA, IPCA plus spread or pre-fixed | partial | as F-03 and F-07 | as F-03 and F-07 | to read |
| F-09 | LC | supported | subtype `lc`, taxed, FGC list; `TestBRProductMatrix` row F-09 against the LTN example of the Tesouro Nacional | none | in code |
| F-10 | LF, senior and subordinated | partial | subtype `lf`, taxed, outside the FGC list | no subordinated variant; no rule on redemption before maturity | to read |
| F-11 | LIG | partial | subtype `lig`, classed as taxed and without guarantee | the tax treatment is stated as not confirmed in `fixed_income_br` | to read |
| F-12 | LH, LCD | supported | subtypes `lh`, `lcd`, exempt class, FGC list; `TestBRProductMatrix` row F-12 against the LTN example of the Tesouro Nacional | none | Lei 11.033/2004 art. 3, II (LH), read on 2026-11-18; LCD: Lei 14.937/2024, to read |
| F-13 | DPGE | supported | subtype `dpge`, taxed class; the FGC guarantee holds a special limit of R$ 40,000,000.00 per issuer apart from the ordinary one and outside the four-year ceiling; `issuer_exposure` returns `special_value`; `TestExposureOfDPGE`, `TestGuarantee` | none | FGC, material for brokers, December 2025 (fgc.org.br), read 2026-11-18 |
| F-14 | Debenture with half-yearly coupon and amortization | partial | `record_fixed_income` takes `interest_every_months`, `first_payment_on` and `amortizations`; `get_portfolio` view `fixed_income_events` | none for the schedule: `set_payment_schedule` writes explicit payment dates (`TestSetPaymentScheduleTool`) | to read |
| F-15 | Incentivized debenture | partial | subtype `debenture_incentivada`, exempt class | the tax rule from 2026 onward was not checked | rate of 0% for an individual: Lei 12.431/2011 art. 2, I, read on 2026-11-18 (planalto.gov.br); 2026 rule: Medida Provisória 1.303/2025 is marked there as expired |
| F-16 | CRI, CRA, IPCA plus spread, monthly interest, irregular amortization | partial | subtypes `cri`, `cra`, exempt class; coupons and amortizations as F-14 | as F-03; the explicit schedule is written by `set_payment_schedule` (`TestSetPaymentScheduleTool`); the unit price formula of the registrar was not compared | to read |
| F-17 | CRI, CRA, percent of CDI, CDI plus spread, pre-fixed | supported | as F-01, F-02, F-04; `TestBRProductMatrix` row F-17 (pre-fixed) against the LTN example of the Tesouro Nacional | none | to read |
| F-18 | CDCA | supported | subtype `cdca`, exempt class; `TestBRProductMatrix` row F-18 against the LTN example of the Tesouro Nacional | none | to read |
| F-18b | CPR, commercial note, LAM | supported | subtypes `cpr` (exempt class: financial settlement, Lei 11.033/2004 art. 3, V), `nota_comercial` and `lam` (taxed class); the FGC covers none; the withholding estimate follows the class (`TestWithholdingFollowsTheTaxClass`); `TestBR`, `TestInstrumentSubtypesList` | a CPR settled in goods is not modeled | Lei 11.033/2004 art. 3, V (added by Lei 11.311/2006), camara.leg.br, read 2026-11-18; LAM without FGC: B3 product page, read 2026-11-18 |
| F-19 | Redemption within 30 days | supported | `brFixedIncomeWithholding`, `estimate_redemption`; `TestBRProductMatrix` row F-19: IOF of day 20 (33%) and income tax 22.5% on the gain less the IOF | none | Decreto 6.306/2007 art. 32 and annex, read 2026-11-18 (planalto.gov.br) |
| F-20 | Sale before maturity on the secondary market | partial | `record_investment` kind `sell` with the oldest lot first (`CostMethod`) | the tax of a sale at a price other than the accrued one is not estimated apart | to read |
| F-21 | Indexes IGP-M, Selic, exchange rate | unsupported | the instance stores `cdi` and `ipca` for Brazil | three indexes and their sources | to read |
| F-22 | Savings account (poupança) | partial | account kind `savings`; `yield_mode` `auto` books the yield | the yield rule of the norm is not computed; how `yield_mode` `auto` derives the yield was not checked for this document | to read |

## Government bonds

| ID | Product | Verdict | Evidence | Missing | Source |
|---|---|---|---|---|---|
| T-01 | Tesouro Selic (LFT) | supported | source `tesourodireto`; subtype `tesouro`; codes in `government_bonds_br`; `TestBRProductMatrix` row T-01 with the published buying and selling prices | none | Tesouro Transparente, PrecoTaxaTesouroDireto.csv, fetched 2026-11-18 |
| T-02 | Tesouro Prefixado (LTN) | supported | as T-01; `TestBRProductMatrix` row T-02: LTN of the Metodologia de Cálculo example, 37,002.70 of income tax, sovereign 1,000,000.00 | none | Metodologia de Cálculo of the Tesouro Nacional, LTN example, read 2026-11-18 |
| T-03 | Tesouro Prefixado with half-yearly interest (NTNF) | partial | as T-01; a coupon is an income of type coupon | the coupon is recorded by the user: no schedule comes from the source | to read |
| T-04 | Tesouro IPCA+ (NTNBP) | supported | as T-01; `TestBRProductMatrix` row T-04 with the published buying and selling prices | none | Tesouro Transparente, PrecoTaxaTesouroDireto.csv, fetched 2026-11-18 |
| T-05 | Tesouro IPCA+ with half-yearly interest (NTNB) | partial | as T-03 | as T-03 | to read |
| T-06 | Tesouro RendA+ | partial | code `RENDA` | the monthly income phase after the conversion date has no event | to read |
| T-07 | Tesouro Educa+ | partial | code `EDUCA` | as T-06 | to read |
| T-08 | Tesouro IGPM+ (NTNC) | supported | code `NTNC` in `internal/marketdata/feed/tesourodireto`; `TestBRProductMatrix` row T-08 with the published buying and selling prices | none | Tesouro Transparente, PrecoTaxaTesouroDireto.csv, fetched 2026-11-18 |
| T-09 | Custody fee of B3 | partial | a fee is recorded as an expense | no event ties the fee to the bond; the exemption band is not computed | to read |

## Listed securities

| ID | Product | Verdict | Evidence | Missing | Source |
|---|---|---|---|---|---|
| E-01 | Stock, unit, round lot and fractional market | supported | type `stock`; an odd-lot code resolves to its security (`noteOrderFromInput`, `internal/ledger/httpapi/notes.go`) | none | to read |
| E-02 | Sale of stock: monthly exemption, rate, loss carried forward | partial | `get_tax_year` lists each sale with cost, proceeds, result and tax class | the tax due is not computed: no monthly exemption, no rate, no loss carried forward | Lei 11.033/2004 art. 2, II (15%) and art. 3, I (R$ 20,000.00 a month, stocks only), read on 2026-11-18 (planalto.gov.br); loss carried forward: to read |
| E-03 | Day trade | partial | `SeparatesDayTrades` (IN RFB 1.585/2015 art. 65); result kind `day_trade` | as E-02 | separation: IN RFB 1.585/2015 art. 65, in code; rate: Lei 11.033/2004 art. 2, I (20%), read on 2026-11-18; withholding of a day trade: art. 2, § 3 refers to the law in force, to read |
| E-04 | Dividend, JCP | supported | income types; `Treatment` in `br.go`; rules in `equities_br` | none | Lei 15.270/2025 and Lei Complementar 224/2025 art. 8 and 14, read on 2026-11-18 (planalto.gov.br); article `equities_br` |
| E-05 | Bonus, split, reverse split, fraction | supported | `record_corporate_action`; `TestRecordCorporateActionToolS431` | none | to read |
| E-06 | Subscription right and receipt | supported | `record_corporate_action` kinds `right_issue` (rights at no cost) and `right_exercise` (rights into the share or the receipt for the price paid); a right is sold with `record_investment` sell; the receipt becomes shares through `conversion`; `TestRightIssueAndExercise`, `TestRightExerciseTool`; the corporate action entry offers both | a partial exercise sells or writes off the rest first (`write_off`, `TestS625RightWrittenOff`) | IN RFB 1.585/2015, art. 58: a right received free has cost zero (owner decision 2026-11-18: zero weight on its units, migration 00126) |
| E-07 | Merger, spin-off, ticker change | supported | `record_corporate_action` kinds `conversion` and `spin_off`; `TestConversionMovesTheCost`, `TestSpinOffToolSplitsTheCost`; the corporate action entry offers both | the tax of an exchange is not computed; the cost moved by a spin-off is the percent of the notice of the company | IN RFB 1.585/2015 not readable at normas.receita.fazenda.gov.br on 2026-11-18 (the page needs a browser); the percent comes from the notice of the company |
| E-08 | FII, Fiagro: distribution, amortization, sale | partial | type `reit`; tax class `fii`; exempt distribution | an amortization that lowers the cost has no event; the tax of a sale is not computed | distribution: Lei 11.033/2004 art. 3, III and § 1 (100 holders, below 10%); sale: Lei 8.668/1993 art. 18 (20%); both read on 2026-11-18 (planalto.gov.br) |
| E-09 | ETF of stocks, ETF of a foreign index | partial | type `etf` | as E-02 | Lei 11.033/2004 art. 2, II and art. 3, I (the exemption names stocks only), read on 2026-11-18 |
| E-10 | ETF of fixed income | partial | type `etf` | no tax class for the rate by the term of the portfolio | to read |
| E-11 | BDR | partial | tax class `bdr` | the foreign tax of a dividend has no field of its own; as E-02 for a sale | sale: Lei 11.033/2004 art. 2, read on 2026-11-18; tax of a foreign dividend: to read |
| E-12 | Option, forward, future | partial | type `option`; a bought option is traded like a stock, expires with `record_investment` kind `write_off` (premium as a realized loss) and a call is exercised with `record_corporate_action` kind `right_exercise` (cost: strike plus premium); `TestS623OptionExpires`, `TestS624CallExercised`, `TestWriteOffTool`, `TestOptionWriteOffInTaxYear`; spec `docs/specs/2026-11-18-listed-options-design.md` | a written option (short position), futures with their daily settlement and forwards | IN RFB 1.585/2015 on options, to read in the norm |
| E-12b | Securities lending (BTC), lender | supported | income type `lending_fee`, treatment `exclusive`; the units and the cost stay in the holding; `TestJurisdictionBRTreatments`, `TestBR` | the borrower side (a short sale of borrowed shares) is not modeled | the lender fee is withheld at source by the fixed income table (IN RFB 1.585/2015; broker statements), to read in the norm |
| E-13 | Brokerage note | supported | `record_brokerage_note`; `TestRecordBrokerageNoteToolS427` | none | to read |

## Funds and others

| ID | Product | Verdict | Evidence | Missing | Source |
|---|---|---|---|---|---|
| U-01 | Fixed income fund, multimarket, come-cotas | partial | subtypes `fixed_income_fund`, `multimarket`; `UnitTax` (Lei 14.754/2023 art. 17 to 19); source `cvmfunds` | long term and short term share one subtype pair, so the rate of 15% or 20% is typed | Lei 14.754/2023 art. 17 to 19, read on 2026-11-18 (planalto.gov.br) |
| U-02 | Equity fund | partial | subtype `equity_fund`, class `fund_equity`, no come-cotas | the tax at redemption is not estimated | to read |
| U-03 | Exempt funds (FI-Infra, incentivized debenture fund) | unsupported | no subtype | a subtype with an exempt class | to read |
| U-04 | FIDC, FIP, closed funds | unsupported | no subtype | subtypes and their tax class | to read |
| U-05 | Pension plan PGBL, VGBL | supported | fund subtypes `pgbl` and `vgbl`, tax classes `pension_pgbl` (taxed on the whole redemption) and `pension_vgbl` (on the gain), no come-cotas; contributions are purchases of quotas, redemptions sales with the tax withheld, portability a custody transfer; `get_tax_year` returns `deductible_contributions` of PGBL plans; `TestPensionContributions`, `TestPensionPlans`, `TestYearContributions` | the tax of a redemption is the one the insurer withholds: the progressive and the regressive tables are not computed; the 12% limit of the deduction needs the taxable income, which equori does not hold | Lei 11.053/2004 art. 1 and Lei 9.532/1997 art. 11 as cited; Lei 14.803/2024 checked 2026-11-18 at camara.leg.br |
| U-06 | COE | unsupported | no instrument type | an instrument type | to read |
| U-07 | Crypto asset | partial | type `crypto`; source `coinbase` | no tax class for Brazil | to read |
| U-08 | Stock and ETF held abroad | partial | types `stock`, `etf` in another currency | the annual tax of Lei 14.754/2023 and the rate date of the conversion are not computed | to read |

## Count

| Verdict | Rows |
|---|---|
| supported | 23 |
| partial | 26 |
| unsupported | 4 |

## What the assistant says

A row with the verdict `unsupported` is stated as such by the assistant, with the missing fact; the product is not recorded under another subtype (spec A3). A row with the verdict `partial` is recorded, and the assistant states the fact of the column Missing.
