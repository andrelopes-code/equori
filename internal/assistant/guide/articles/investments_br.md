Rules of a book of region BR for an individual, checked on 2026-11-16. The law changes: the notice of the broker prevails, and a doubt goes to the issuer.

Subtypes of fixed_income (get_portfolio view subtypes). Taxed at source: cdb, rdb, lc (letter of exchange), lf (financial letter), debenture (common), tesouro. Exempt interest (Lei 11.033/2004, Lei 12.431/2011, Lei 14.937/2024): lci, lca, lh, lcd, cdca, cri, cra, debenture_incentivada. lig reads as taxed and not guaranteed: its treatment is not confirmed, so the user checks it with the issuer. The FGC guarantees up to R$ 250,000.00 per holder per institution or conglomerate and R$ 1,000,000.00 in 4 years (Resolução CMN 4.222/2013, annex II, art. 2) for cdb, rdb, lc, lh, lci, lca and lcd; get_portfolio view issuer_exposure shows each issuer against that limit. A tesouro security is federal public debt paid by the Tesouro Nacional (Lei 10.179/2001): the FGC does not apply to it, and issuer_exposure reports it as sovereign_value, apart from uncovered_value. Proposals to tax the exempt kinds were not law on that date.

Income tax of a taxed security, on the gain, by days since each purchase: 22.5% up to 180, 20% from 181 to 360, 17.5% from 361 to 720, 15% above (Lei 11.033/2004, art. 1). Tesouro and a coupon follow the same table. IOF applies to a redemption within 30 days: 96% of the gain on day 1, falling to 3% on day 29, 0 from day 30; the income tax base is the gain less the IOF (Decreto 6.306/2007). A sale removes the cost of the oldest purchase first. estimate_redemption covers the taxed subtypes.

Terms. Indexes: cdi (business days, bus252) and ipca (monthly, act365). A pre-fixed rate and the spread over IPCA count the business days of calendar br_banking: day_count bus252 with calendar_id br_banking. The statement of the issuer is recorded with record_price.

Tesouro Direto. The code is the listing code: LFT, LTN, NTNF, NTNB, NTNBP, NTNC, EDUCA or RENDA, a dot and the maturity as YYYYMMDD (NTNB.20350515). Subtype tesouro, quote currency BRL, scale 2.

Issuer. The CNPJ of the issuer of a contract, numeric or alphanumeric (IN RFB 2.229/2024), is its identifier with the scheme br_cnpj; the check digits are validated.

Funds. The subtypes of fund are fixed_income_fund, multimarket and equity_fund (get_portfolio view subtypes). Come-cotas applies to fixed_income_fund and multimarket, and not to equity_fund; it is recorded with record_corporate_action kind unit_tax. A fixed income or multimarket fund cancels units on the last business day of May and of November for the tax on the gain: 15% for a long-term fund, 20% for a short-term one (Lei 14.754/2023, art. 17 to 19).

Stocks, FII, Fiagro, ETF and BDR, their income and the tax of their sale: get_help topic equities_br.

Indexer comparison. The sources are the CDI and the IPCA of the instance, the Focus survey of the Banco Central do Brasil for the expected rates, and the curves of Tesouro Direto for the market rate of the term and the inflation implied by government bonds. The tax follows the table of the income tax above, and an exempt security pays none. The screen gives no recommendation and no verdict.

Fund report. The report of a listed FII on the instrument page comes from the CVM (Informe Mensal de FII, feed br_cvm_fii); the break-even is read against the Tesouro IPCA+ curve (feed br_tesouro).
