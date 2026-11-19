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
| F-05 | CDB with a rate that rises with the holding period | supported | terms `rate_steps` with `rate_steps_apply` `retroactive` or `stepped` (`domain.AccrueSteps`); tool `set_rate_steps`; `TestAccrueSteps`, `TestRateStepsAccrue`, `TestSetRateStepsTool`; spec `docs/specs/2026-11-18-progressive-rate-design.md` | none | Santander, ficha do CDB Progressivo (retroactive); the issuer states the rule |
| F-06 | RDB | supported | subtype `rdb` in `internal/portfolio/jurisdiction/br/br.go`; FGC list; `TestBRProductMatrix` row F-06 against the LTN example of the Tesouro Nacional | none | FGC: in code (Resolução CMN 4.222/2013, annex II, art. 2) |
| F-07 | LCI, LCA, percent of CDI, minimum term | supported | subtypes `lci`, `lca`, exempt class; the minimum term of the rule of the issue date is the default `redeemable_from` of a new contract (`MinimumRedemption`); `TestMinimumTermOfLCIAndLCA` | an LCA updated by a price index takes no default | Resolução CMN 5.119/2024 and 5.215/2025 (BCB normativos and press of 2024-02 and 2025-05, read 2026-11-18) |
| F-08 | LCI, LCA, IPCA plus spread or pre-fixed | partial | as F-03 and F-07 | as F-03; an LCA on IPCA takes no default minimum term | to read |
| F-09 | LC | supported | subtype `lc`, taxed, FGC list; `TestBRProductMatrix` row F-09 against the LTN example of the Tesouro Nacional | none | in code |
| F-10 | LF, senior and subordinated | supported | subtypes `lf` and `lf_subordinated`, taxed, outside the FGC list; a new one takes its maturity as `redeemable_from` (`MinimumRedemption`; `TestMinimumTermOfLCIAndLCA` cases LF and LF subordinated) | none | Lei 12.249/2010 art. 37 and 38; Resolução CMN 5.007/2022 art. 5 (redemption before maturity barred; minimum term of 24 months, 60 with subordination) |
| F-11 | LIG | supported | subtype `lig`, exempt class, outside the FGC; the withholding estimate follows the class (`TestWithholdingFollowsTheTaxClass`); `TestBR` | none | Lei 13.097/2015 (LIG chapter); the issuer's statement (Itaú, investor relations, LIG page) read 2026-11-18; a B3 glossary entry that calls it taxed contradicts the law and the issuers |
| F-12 | LH, LCD | supported | subtypes `lh`, `lcd`, exempt class, FGC list; `TestBRProductMatrix` row F-12 against the LTN example of the Tesouro Nacional | none | Lei 11.033/2004 art. 3, II (LH), read on 2026-11-18; LCD: Lei 14.937/2024, to read |
| F-13 | DPGE | supported | subtype `dpge`, taxed class; the FGC guarantee holds a special limit of R$ 40,000,000.00 per issuer apart from the ordinary one and outside the four-year ceiling; `issuer_exposure` returns `special_value`; `TestExposureOfDPGE`, `TestGuarantee` | none | FGC, material for brokers, December 2025 (fgc.org.br), read 2026-11-18 |
| F-14 | Debenture with half-yearly coupon and amortization | supported | `record_fixed_income` takes `interest_every_months`, `first_payment_on` and `amortizations`; `get_portfolio` view `fixed_income_events` | none | to read |
| F-15 | Incentivized debenture | supported | subtype `debenture_incentivada`, exempt class | none | rate of 0% for an individual: Lei 12.431/2011 art. 2, I, read on 2026-11-18 (planalto.gov.br); 2026: Medida Provisória 1.303/2025, which would have taxed it, lost effect unvoted on 2025-10-08, so the exemption stands (press of 2025-10 and 2026-02, read 2026-11-18) |
| F-16 | CRI, CRA, IPCA plus spread, monthly interest, irregular amortization | partial | subtypes `cri`, `cra`, exempt class; coupons and amortizations as F-14 | as F-03; the explicit schedule is written by `set_payment_schedule` (`TestSetPaymentScheduleTool`); the unit price formula of the registrar was not compared | to read |
| F-17 | CRI, CRA, percent of CDI, CDI plus spread, pre-fixed | supported | as F-01, F-02, F-04; `TestBRProductMatrix` row F-17 (pre-fixed) against the LTN example of the Tesouro Nacional | none | to read |
| F-18 | CDCA | supported | subtype `cdca`, exempt class; `TestBRProductMatrix` row F-18 against the LTN example of the Tesouro Nacional | none | to read |
| F-18b | CPR, commercial note, LAM | supported | subtypes `cpr` (exempt class: financial settlement, Lei 11.033/2004 art. 3, V), `nota_comercial` and `lam` (taxed class); the FGC covers none; the withholding estimate follows the class (`TestWithholdingFollowsTheTaxClass`); `TestBR`, `TestInstrumentSubtypesList` | a CPR settled in goods is not modeled | Lei 11.033/2004 art. 3, V (added by Lei 11.311/2006), camara.leg.br, read 2026-11-18; LAM without FGC: B3 product page, read 2026-11-18 |
| F-19 | Redemption within 30 days | supported | `brFixedIncomeWithholding`, `estimate_redemption`; `TestBRProductMatrix` row F-19: IOF of day 20 (33%) and income tax 22.5% on the gain less the IOF | none | Decreto 6.306/2007 art. 32 and annex, read 2026-11-18 (planalto.gov.br) |
| F-20 | Sale before maturity on the secondary market | partial | `record_investment` kind `sell` with the oldest lot first (`CostMethod`) | the tax of a sale at a price other than the accrued one is not estimated apart | to read |
| F-21 | Indexes IGP-M, Selic, exchange rate | partial | index feeds `br_selic` (SGS 11, by business day) and `br_igpm` (SGS 189, monthly), suggested for BR; `TestIndexFeedsSelicAndIGPM`; the exchange rate is the currency price of `bcb_ptax` | a security indexed to the exchange rate has no index: the PTAX is a price, not an index of the terms | BCB SGS series 11 and 189 |
| F-22 | Savings account (poupança) | partial | account kind `savings`; `yield_mode` `auto` books the yield | the yield rule of the norm is not computed; how `yield_mode` `auto` derives the yield was not checked for this document | to read |

## Government bonds

| ID | Product | Verdict | Evidence | Missing | Source |
|---|---|---|---|---|---|
| T-01 | Tesouro Selic (LFT) | supported | source `tesourodireto`; subtype `tesouro`; codes in `government_bonds_br`; `TestBRProductMatrix` row T-01 with the published buying and selling prices | none | Tesouro Transparente, PrecoTaxaTesouroDireto.csv, fetched 2026-11-18 |
| T-02 | Tesouro Prefixado (LTN) | supported | as T-01; `TestBRProductMatrix` row T-02: LTN of the Metodologia de Cálculo example, 37,002.70 of income tax, sovereign 1,000,000.00 | none | Metodologia de Cálculo of the Tesouro Nacional, LTN example, read 2026-11-18 |
| T-03 | Tesouro Prefixado with half-yearly interest (NTNF) | supported | as T-01; `fixed_income_events` lists the coupons every 6 months back from the maturity, 48.81 a unit, and 1,000.00 at maturity (`governmentBondCoupons`, `TestS632GovernmentBondEvents`); a coupon is an income of type coupon | none | Metodologia de Cálculo dos Títulos Públicos Federais, Tesouro Nacional (coupon of 10% a year, 1,000.00 × (1.10^½ − 1)) |
| T-04 | Tesouro IPCA+ (NTNBP) | supported | as T-01; `TestBRProductMatrix` row T-04 with the published buying and selling prices | none | Tesouro Transparente, PrecoTaxaTesouroDireto.csv, fetched 2026-11-18 |
| T-05 | Tesouro IPCA+ with half-yearly interest (NTNB) | partial | as T-03: the coupon dates of 6% a year come from the maturity; their amount is missing | the nominal value (VNA) is not published by the source, so a coupon carries no amount until it is recorded | Metodologia de Cálculo dos Títulos Públicos Federais, Tesouro Nacional (coupon of 6% a year on the VNA) |
| T-06 | Tesouro RendA+ | partial | code `RENDA`; `fixed_income_events` lists the 240 monthly amortizations on the 15th ending on the maturity (`monthlyBondCoupons`, `TestS633IncomeBondEvents`) | the nominal value (VNA) is not published by the source, so a payment carries no amount; the units of a payment are a share of whole basis points, within 2% of one of those left | Tesouro Direto, Tesouro RendA+ (240 monthly payments from the conversion date to the maturity) |
| T-07 | Tesouro Educa+ | partial | code `EDUCA`; as T-06 with 60 monthly payments | as T-06 | Tesouro Direto, Tesouro Educa+ (60 monthly payments) |
| T-08 | Tesouro IGPM+ (NTNC) | supported | code `NTNC` in `internal/marketdata/feed/tesourodireto`; `TestBRProductMatrix` row T-08 with the published buying and selling prices | none | Tesouro Transparente, PrecoTaxaTesouroDireto.csv, fetched 2026-11-18 |
| T-09 | Custody fee of B3 | partial | a fee is recorded as an expense | no event ties the fee to the bond; the exemption band is not computed | to read |

## Listed securities

| ID | Product | Verdict | Evidence | Missing | Source |
|---|---|---|---|---|---|
| E-01 | Stock, unit, round lot and fractional market | supported | type `stock`; an odd-lot code resolves to its security (`noteOrderFromInput`, `internal/ledger/httpapi/notes.go`) | none | to read |
| E-02 | Sale of stock: monthly exemption, rate, loss carried forward | supported | `get_tax_year` view `gain_tax`: the R$ 20,000.00 exemption, 15%, the loss carried by pool and the tax withheld (`Jurisdiction.GainTax`); `TestGainTax`, `TestS628S629GainTax`; spec `docs/specs/2026-11-18-monthly-gain-tax-design.md` | none | Lei 11.033/2004 art. 2 and 3, I; IN RFB 1.585/2015 art. 56 to 61; Lei 9.430/1996 art. 68 |
| E-03 | Day trade | supported | `SeparatesDayTrades` (IN RFB 1.585/2015 art. 65); result kind `day_trade`; the day-trade pool of `gain_tax` at 20% with its own losses; `TestS628S629GainTax` | none | separation: IN RFB 1.585/2015 art. 65, in code; rate: Lei 11.033/2004 art. 2, §1 |
| E-04 | Dividend, JCP | supported | income types; `Treatment` in `br.go`; rules in `equities_br` | none | Lei 15.270/2025 and Lei Complementar 224/2025 art. 8 and 14, read on 2026-11-18 (planalto.gov.br); article `equities_br` |
| E-05 | Bonus, split, reverse split, fraction | supported | `record_corporate_action`; `TestRecordCorporateActionToolS431` | none | to read |
| E-06 | Subscription right and receipt | supported | `record_corporate_action` kinds `right_issue` (rights at no cost) and `right_exercise` (rights into the share or the receipt for the price paid); a right is sold with `record_investment` sell; the receipt becomes shares through `conversion`; `TestRightIssueAndExercise`, `TestRightExerciseTool`; the corporate action entry offers both | a partial exercise sells or writes off the rest first (`write_off`, `TestS625RightWrittenOff`) | IN RFB 1.585/2015, art. 58: a right received free has cost zero (owner decision 2026-11-18: zero weight on its units, migration 00126) |
| E-07 | Merger, spin-off, ticker change | supported | `record_corporate_action` kinds `conversion` and `spin_off`; `TestConversionMovesTheCost`, `TestSpinOffToolSplitsTheCost`; the corporate action entry offers both | the tax of an exchange is not computed; the cost moved by a spin-off is the percent of the notice of the company | IN RFB 1.585/2015 not readable at normas.receita.fazenda.gov.br on 2026-11-18 (the page needs a browser); the percent comes from the notice of the company |
| E-08 | FII, Fiagro: distribution, amortization, sale | supported | type `reit`; tax class `fii`; exempt distribution; an amortization is `record_corporate_action` kind `capital_return`, which lowers the cost (`TestCapitalReturnLowersTheCost`, `TestCapitalReturnTool`); the tax of a sale is the FII pool of `gain_tax` | none | distribution: Lei 11.033/2004 art. 3, III and its paragraph; sale: Lei 8.668/1993 art. 18 |
| E-09 | ETF of stocks, ETF of a foreign index | supported | type `etf`; the ordinary pool of `gain_tax` at 15%, without the exemption of stocks; `TestGainTaxExemptionReadsStocks` | none | Lei 11.033/2004 art. 2, II and art. 3, I (the exemption names stocks only) |
| E-10 | ETF of fixed income | supported | `etf` subtype `fixed_income_etf`, class `etf_fixed_income`, outside the monthly tax (`TestGainTaxLeavesFixedIncomeETF`); the tax withheld on the sale is recorded as `taxes` | the rate by the term of the portfolio is the one withheld, not estimated | Lei 13.043/2014 art. 2 |
| E-11 | BDR | partial | tax class `bdr` | the foreign tax of a dividend has no field of its own; a sale is in the ordinary pool of `gain_tax` | sale: Lei 11.033/2004 art. 2, read on 2026-11-18; tax of a foreign dividend: to read |
| E-12 | Option, forward, future | partial | type `option`; a bought option is traded like a stock, expires with `record_investment` kind `write_off` (premium as a realized loss) and a call is exercised with `record_corporate_action` kind `right_exercise` (cost: strike plus premium); `TestS623OptionExpires`, `TestS624CallExercised`, `TestWriteOffTool`, `TestOptionWriteOffInTaxYear`; spec `docs/specs/2026-11-18-listed-options-design.md` | a written option (short position), futures with their daily settlement and forwards | IN RFB 1.585/2015 on options, to read in the norm |
| E-12b | Securities lending (BTC), lender | supported | income type `lending_fee`, treatment `exclusive`; the units and the cost stay in the holding; `TestJurisdictionBRTreatments`, `TestBR` | the borrower side (a short sale of borrowed shares) is not modeled | the lender fee is withheld at source by the fixed income table (IN RFB 1.585/2015; broker statements), to read in the norm |
| E-13 | Brokerage note | supported | `record_brokerage_note`; `TestRecordBrokerageNoteToolS427` | none | to read |

## Funds and others

| ID | Product | Verdict | Evidence | Missing | Source |
|---|---|---|---|---|---|
| U-01 | Fixed income fund, multimarket, come-cotas | supported | subtypes `fixed_income_fund`, `multimarket` (long term, 15%) and `short_term_fund` (20%); `UnitTax` with `RateBP` (Lei 14.754/2023 art. 17 to 19); `estimated_tax` of each come-cotas (`UnitTaxEstimate`, `TestS634UnitTaxEstimate`); source `cvmfunds` | none | Lei 14.754/2023 art. 17 to 19, read on 2026-11-18 (planalto.gov.br) |
| U-02 | Equity fund | supported | subtype `equity_fund`, class `fund_equity`, no come-cotas; the position estimates the 15% withheld at redemption, without IOF, on the average cost (`FixedIncomeWithholding`, `TestS635EquityFundEstimate`) | none | Lei 14.754/2023 art. 21; Decreto 6.306/2007 art. 32 §2 |
| U-03 | Exempt funds (FI-Infra, incentivized debenture fund) | supported | fund subtype `fi_infra`, class `fund_exempt`: a distribution is exempt, no come-cotas; `TestBR`, `TestUnitTaxOfClosedFunds` | none | Lei 12.431/2011 art. 3; come-cotas: Lei 14.754/2023 as summarized by law firms, 2026-11-18 |
| U-04 | FIDC, FIP, closed funds | partial | fund subtypes `fidc` (come-cotas calendar), `fidc_entity` (an investment entity: no come-cotas) and `fip`, class `fund`; a `fidc_entity` or `fip` position estimates 15% of its gain at redemption (`TestS636InvestmentEntityEstimate`, `TestFIDCEntityHasNoUnitTax`); a distribution is exclusive at source | the IOF of a redemption within 30 days is not estimated; a FIP that is not an investment entity is read as one | Lei 14.754/2023 art. 24 and 26 as summarized by law firms; Resolução CMN 5.111/2023, 2026-11-18 |
| U-05 | Pension plan PGBL, VGBL | supported | fund subtypes `pgbl` and `vgbl`, tax classes `pension_pgbl` (taxed on the whole redemption) and `pension_vgbl` (on the gain), no come-cotas; contributions are purchases of quotas, redemptions sales with the tax withheld, portability a custody transfer; `get_tax_year` returns `deductible_contributions` of PGBL plans; `TestPensionContributions`, `TestPensionPlans`, `TestYearContributions` | the tax of a redemption is the one the insurer withholds: the progressive and the regressive tables are not computed; the 12% limit of the deduction needs the taxable income, which equori does not hold | Lei 11.053/2004 art. 1 and Lei 9.532/1997 art. 11 as cited; Lei 14.803/2024 checked 2026-11-18 at camara.leg.br |
| U-06 | COE | partial | fixed income subtype `coe`, taxed class, no FGC; `TestBR`, `TestUnitTaxOfClosedFunds` | the payoff of the structure is not modeled: the value is the price the user records from the issuer | to read |
| U-07 | Crypto asset | supported | type `crypto`, class `crypto`; source `coinbase`; the crypto pool of `gain_tax` (R$ 35,000.00 exemption, capital gain brackets, DARF 4600); `TestGainTaxCrypto`, `TestBracketTax` | crypto held at an exchange abroad (annual tax of Lei 14.754/2023) is not computed | Lei 13.259/2016 art. 1; IN SRF 84/2001 art. 3; press of 2025-2026 on the exemption |
| U-08 | Stock and ETF held abroad | partial | an instrument quoted in another currency; `get_tax_year` view `abroad_tax`: 15% a year from 2024, losses carried, tax paid abroad credited up to 15% of its income (`AbroadTax`, `TestAbroadTax`, `TestS637AbroadTax`) | an income in another currency is converted by equori's rate of its date, not the buying and selling rates the law names; whether a treaty allows the credit is the user's | Lei 14.754/2023 art. 2 to 5; RFB, Perguntas e Respostas offshores (IN RFB 2.180/2024), questions 20, 21, 23 and 45, read 2026-11-19 |

## Count

| Verdict | Rows |
|---|---|
| supported | 39 |
| partial | 15 |
| unsupported | 0 |

## What the assistant says

A row with the verdict `unsupported` is stated as such by the assistant, with the missing fact; the product is not recorded under another subtype (spec A3). A row with the verdict `partial` is recorded, and the assistant states the fact of the column Missing.
