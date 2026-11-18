Tesouro Direto securities of a book of region BR for an individual, checked on 2026-11-16. The law changes: the notice of the broker prevails.

Code. The code is the listing code: LFT, LTN, NTNF, NTNB, NTNBP, NTNC, EDUCA or RENDA, a dot and the maturity as YYYYMMDD (NTNB.20350515). Type fixed_income, subtype tesouro, quote currency BRL, scale 2.

Payments. get_portfolio view fixed_income_events lists the payments of a held bond from its code, each on the next banking day: an NTNF, an NTNB and an NTNC pay interest every 6 months back from the maturity (NTNB.20350515 pays on May 15 and November 15); an NTNF pays 48.81 a unit of interest (1,000.00 × (1.10^½ − 1), Metodologia de Cálculo of the Tesouro Nacional) and 1,000.00 at maturity, an LTN 1,000.00 at maturity. The nominal value of an LFT, an NTNB, an NTNBP and an NTNC is not published by the source, so their events carry no amount (rate_missing). A coupon is recorded as an income of type coupon. EDUCA and RENDA list no payment.

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

