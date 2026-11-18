Bank and private fixed income of a book of region BR for an individual, checked on 2026-11-16. The law changes: the notice of the broker prevails, and a doubt goes to the issuer. Tesouro Direto: get_help topic government_bonds_br.

Subtypes of fixed_income (get_portfolio view subtypes). Taxed at source: cdb, rdb, lc (letter of exchange), lf (financial letter), debenture (common), tesouro. Exempt interest (Lei 11.033/2004, Lei 12.431/2011, Lei 14.937/2024): lci, lca, lh, lcd, cdca, cri, cra, debenture_incentivada. lig reads as taxed and not guaranteed: its treatment is not confirmed, so the user checks it with the issuer. The FGC guarantees up to R$ 250,000.00 per holder per institution or conglomerate and R$ 1,000,000.00 in 4 years (Resolução CMN 4.222/2013, annex II, art. 2) for cdb, rdb, lc, lh, lci, lca and lcd; get_portfolio view issuer_exposure shows each issuer against that limit. Proposals to tax the exempt kinds were not law on that date.

Income tax of a taxed security, on the gain, by days since each purchase: 22.5% up to 180, 20% from 181 to 360, 17.5% from 361 to 720, 15% above (Lei 11.033/2004, art. 1). A coupon follows the same table. IOF applies to a redemption within 30 days: 96% of the gain on day 1, falling to 3% on day 29, 0 from day 30; the income tax base is the gain less the IOF (Decreto 6.306/2007). A sale removes the cost of the oldest purchase first. estimate_redemption covers the taxed subtypes.

Terms. Indexes: cdi (business days, bus252) and ipca (monthly, act365). A pre-fixed rate and the spread over IPCA count the business days of calendar br_banking: day_count bus252 with calendar_id br_banking. The statement of the issuer is recorded with record_price.

Indexer comparison. The sources are the CDI and the IPCA of the instance, the Focus survey of the Banco Central do Brasil for the expected rates, and the curves of Tesouro Direto for the market rate of the term and the inflation implied by government bonds. The tax follows the table of the income tax above, and an exempt security pays none. The screen gives no recommendation and no verdict.

## Products

Each row is a product equori records and values as the published calculation of its source does (checked by the product matrix). The tool is record_fixed_income; the facts to ask are the brokerage, the amount, the application date, the issuer, the maturity and the rate.

| ID | Product | Subtype | Rate form | Tax of an individual | Guarantee | Liquidity | Source, read 2026-11-18 |
|---|---|---|---|---|---|---|---|
| F-01 | CDB pós-fixado | cdb | percent of the CDI (index_id cdi, percent_of_index) | table of art. 1 of Lei 11.033/2004; IOF within 30 days | FGC | daily_liquidity when the issuer allows it | BCB SGS series 12 (CDI); B3 Caderno de Fórmulas of CDBs, 6.1.2 |
| F-02 | CDB prefixado | cdb | annual rate (spread) on bus252 with calendar_id br_banking | table of art. 1 of Lei 11.033/2004 | FGC | at maturity unless redeemable_from | Metodologia de Cálculo of the Tesouro Nacional, LTN example |
| F-04 | CDB CDI + spread | cdb | percent of the CDI and an annual spread | table of art. 1 of Lei 11.033/2004 | FGC | at maturity unless redeemable_from | BCB SGS series 12 (CDI); B3 Caderno de Fórmulas of CDBs, 6.1.2 |
| F-06 | RDB | rdb | as the CDB; not transferable | table of art. 1 of Lei 11.033/2004 | FGC | at maturity | Metodologia de Cálculo of the Tesouro Nacional, LTN example |
| F-09 | Letra de Câmbio (LC) | lc | as the CDB | table of art. 1 of Lei 11.033/2004 | FGC | at maturity | Metodologia de Cálculo of the Tesouro Nacional, LTN example |
| F-12 | Letra Hipotecária (LH), LCD | lh, lcd | as the CDB | exempt, Lei 11.033/2004 art. 3, II | FGC | at maturity | Metodologia de Cálculo of the Tesouro Nacional, LTN example |
| F-17 | CRI, CRA | cri, cra | pre-fixed, percent of the CDI, CDI + spread | exempt, Lei 11.033/2004 art. 3, II and IV | none | at maturity | Metodologia de Cálculo of the Tesouro Nacional, LTN example |
| F-18 | CDCA | cdca | as the CRI | exempt, Lei 11.033/2004 art. 3, IV | none | at maturity | Metodologia de Cálculo of the Tesouro Nacional, LTN example |
| F-19 | Redemption within 30 days | any taxed subtype | any | IOF of the annex of Decreto 6.306/2007, then income tax on the gain less the IOF | as the product | as the product | Decreto 6.306/2007, art. 32 and annex |

