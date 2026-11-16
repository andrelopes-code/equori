A fixed income security is an Instrument of type fixed_income, shared by every book. A Brokerage holds it as an Investment line. Three steps record it: define the instrument, set its terms, record the buy. A missing fact (kind, issuer, amount, application date, maturity, index and rate, whether interest is paid out) is asked in one short question.

Kinds in a Brazilian book. get_portfolio with view subtypes lists the subtypes. The subtypes cdb, rdb and tesouro are taxed at source. The subtypes lci, lca, cri, cra and debenture_incentivada have exempt interest for an individual (Lei 11.033/2004, Lei 12.431/2011); in November 2026 proposals to tax them were not law. A letter of exchange (LC), a financial letter (LF) and a common debenture have no subtype and are taxed like a CDB. A LIG, LCD or CDCA has no subtype either, so equori reports it as taxed: the user checks its treatment with the issuer.

Tesouro Direto. Define the instrument from the listing of the source tesouro_direto: code such as NTNB.20350515, type fixed_income, quote currency BRL, scale 2, subtype tesouro. Its prices come from the source; no terms are set.

Bank products and private securities (CDB, RDB, LC, LF, LCI, LCA). One instrument per contract. The code has 2 to 20 capitals, digits or dots, such as CDBINTER.2028. Define with type fixed_income, quote_currency BRL, scale 2 and the subtype. Then set_terms with face_value 1.00 (one real of nominal value on the issue date), issued_on, matures_on and the rate:

- 110% of the CDI: index_id cdi, percent_of_index_bp 11000.
- CDI plus 2% a year: index_id cdi, percent_of_index_bp 10000, spread_bp 200.
- IPCA plus 6.5%: index_id ipca, spread_bp 650.
- Pre-fixed 12.5% a year: no index_id, spread_bp 1250.

The CDI counts business days (bus252). IPCA and pre-fixed count calendar days (act365); IPCA enters by published month, without pro rata. The accrued Price is gross: income tax and IOF are not deducted. A Price typed by the user (record_price, after the statement of the issuer) replaces the accrued one.

Buy. record_investment kind buy, with quantity as the reais applied and unit_price 1.00 on the issue date. A later contribution to a product with the same terms, such as a daily-liquidity CDB, is a buy at the Price of that day. Another rate or maturity is another instrument.

A security that pays coupons or returns principal (CRI, CRA, debentures, Tesouro with semiannual interest) takes no terms: terms compound the interest and count it twice. Its Price is the unit price (PU) of the issuer, recorded with record_price. Payments are in the article fixed_income_payments.
