Tesouro Direto securities of a book of region BR for an individual, checked on 2026-11-16. The law changes: the notice of the broker prevails.

Code. The code is the listing code: LFT, LTN, NTNF, NTNB, NTNBP, NTNC, EDUCA or RENDA, a dot and the maturity as YYYYMMDD (NTNB.20350515). Type fixed_income, subtype tesouro, quote currency BRL, scale 2.

Payments. get_portfolio view fixed_income_events lists the payments of a held bond from its code, each on the next banking day. An NTNF, an NTNB and an NTNC pay interest every 6 months back from the maturity (NTNB.20350515 pays on May 15 and November 15); a RENDA returns its principal in 240 monthly payments on the 15th and an EDUCA in 60, the last on the maturity, each amortizing one part in the payments left of the units held. An NTNF pays 48.81 a unit of interest and 1,000.00 at maturity, an LTN 1,000.00. The other bonds pay their VNA, the nominal value of 1,000.00 at the base updated by their index: the IPCA for an NTNB, an NTNBP, a RENDA and an EDUCA (from 2000-07-15, by the index numbers of the IBGE), the IGP-M for an NTNC (from 2000-07-01) and the Selic of each business day for an LFT (from 2000-07-01); the factor is rounded to 16 decimals and the VNA truncated to 6. A coupon is the VNA times 0.02956301 (1.06^½ − 1), 0.05830052 for the NTNC of 2031-01-01 (1.12^½ − 1), truncated to 6 decimals; a payment of principal is the VNA (Tesouro Nacional, Metodologia de Cálculo dos Títulos Públicos Federais, version of 2024-04-29). A payment whose VNA counts a month or a day of the index not yet published carries no amount (rate_missing) until it is. A coupon is recorded as an income of type coupon; a monthly payment of a RENDA or an EDUCA as a sale of the units it amortizes.

Custody fee. B3 charges 0.20% a year of the value of a bond, pro rata since the purchase, the last coupon or the last half-yearly charge of July 2024, deducted at a sale, a coupon or the maturity since 2024-12-31; a Tesouro Selic pays it only on the value above R$ 10,000.00 of all the holder's Tesouro Selic, the book read as one holder: a sale pays on its share of that excess (B3, tarifas de Tesouro Direto, read 2026-11-19). estimate_redemption and the position's estimated_net deduct it as custody_fee; a RENDA or an EDUCA follows its own table. The fee is recorded as an expense of the sale.

Tax. A Tesouro security and its coupon follow the income tax table and the IOF of a taxed security (get_help topic fixed_income_br).

Guarantee. A tesouro security is federal public debt paid by the Tesouro Nacional (Lei 10.179/2001): the FGC does not apply to it, and get_portfolio view issuer_exposure reports it as sovereign_value, apart from uncovered_value.

## Products

Each row is a bond equori values at the price of its source, as the product matrix checks with published prices. A purchase is record_investment kind buy of the code; the facts to ask are the brokerage, the code, the date, the units and the unit price. The tax is the table of art. 1 of Lei 11.033/2004, and IOF within 30 days.

| ID | Bond | Code | Interest | Source, read 2026-11-18 |
|---|---|---|---|---|
| T-01 | Tesouro Selic | LFT | none before maturity | Tesouro Transparente, PrecoTaxaTesouroDireto.csv |
| T-02 | Tesouro Prefixado | LTN | none; 1,000.00 at maturity | Metodologia de Cálculo of the Tesouro Nacional, LTN example |
| T-04 | Tesouro IPCA+ | NTNBP | none before maturity | Tesouro Transparente, PrecoTaxaTesouroDireto.csv |
| T-08 | Tesouro IGPM+ com Juros Semestrais | NTNC | coupon on January 1 and July 1, recorded with record_investment kind income | Tesouro Transparente, PrecoTaxaTesouroDireto.csv |

