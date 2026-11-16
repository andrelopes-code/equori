Rules of a book of region BR for an individual, checked on 2026-11-16. The law changes: the notice of the broker prevails, and a doubt goes to the issuer.

Subtypes of fixed_income (get_portfolio view subtypes). Taxed at source: cdb, rdb, lc (letter of exchange), lf (financial letter), debenture (common), tesouro. Exempt interest (Lei 11.033/2004, Lei 12.431/2011): lci, lca, cri, cra, debenture_incentivada. A LIG, LCD or CDCA has no subtype and reads as taxed: its treatment is not confirmed, so the user checks it with the issuer. Proposals to tax the exempt kinds were not law on that date.

Income tax of a taxed security, on the gain, by days since each purchase: 22.5% up to 180, 20% from 181 to 360, 17.5% from 361 to 720, 15% above (Lei 11.033/2004, art. 1). Tesouro and a coupon follow the same table. IOF applies to a redemption within 30 days: 96% of the gain on day 1, falling to 3% on day 29, 0 from day 30; the income tax base is the gain less the IOF (Decreto 6.306/2007). A sale removes the cost of the oldest purchase first. estimate_redemption covers the taxed subtypes.

Terms. Indexes: cdi (business days, bus252) and ipca (monthly, act365). 110% of the CDI is index_id cdi with percent_of_index_bp 11000. CDI plus 2% is percent 10000 and spread_bp 200. IPCA plus 6.5% is index_id ipca, spread_bp 650, day_count bus252, calendar_id br_banking. Pre-fixed 12.5% has no index_id and spread_bp 1250. A pre-fixed rate and the spread over IPCA count the business days of calendar br_banking: day_count bus252 with calendar_id br_banking. The statement of the issuer is recorded with record_price.

Tesouro Direto. The code is the listing code: LFT, LTN, NTNF, NTNB, NTNBP, NTNC, EDUCA or RENDA, a dot and the maturity as YYYYMMDD (NTNB.20350515). Subtype tesouro, quote currency BRL, scale 2.

Dividend. Exempt up to R$ 50,000 a month paid by one source to one individual, and above it when the profit is of 2025 or earlier, approved by 2025-12-31 and paid as the approval states. From 2026 a source that pays more than R$ 50,000 in a month withholds 10% of the whole amount (Lei 15.270/2025); withheld is that amount. The annual minimum tax on high income is settled in the tax return, not recorded here.

JCP. 15% at source up to 2025-12-31 and 17.5% from 2026-01-01, by the payment date (Lei Complementar 224/2025).

Issuer. The CNPJ of the issuer of a contract, numeric or alphanumeric (IN RFB 2.229/2024), is its identifier with the scheme br_cnpj; the check digits are validated.

Distribution. Exempt for a listed FII or Fiagro under the conditions of Lei 11.033/2004 (exchange traded, holder below 10% of the units); the informe of the fund states them.
