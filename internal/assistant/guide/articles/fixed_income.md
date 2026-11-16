A fixed income security is an Instrument of type fixed_income. A Brokerage holds it as an Investment line.

A new application of a bank product or a private security (CDB, LCI, LCA, debenture) is one record_fixed_income: the contract and the purchase at once. A missing fact is asked in one short question: kind, issuer, amount, application date, maturity, rate and liquidity. The contract belongs to the book: no other book sees it or its code, which equori derives. More money into a contract the book holds is record_fixed_income with instrument, at the Price of that day. The entry form "Fixed income application" does the same; "Add money" on the page of an owned contract opens it for that contract.

The fields in plain words: subtype is the kind (get_portfolio view subtypes lists those of the region); issuer is who owes the money; matures_on is the date the money returns; daily_liquidity says it can be redeemed on any business day; redeemable_from is the first date before maturity it can be redeemed. The rate:

- A percent of an index: index_id and percent_of_index ("110" for 110% of the CDI).
- An index plus a rate: index_id of a monthly index and spread ("6.5" for IPCA + 6.5%).
- Pre-fixed: no index_id, and spread the rate a year ("12" for 12%).

A public security with a code of its own, such as a government bond, is defined with manage_instrument from the listing of its price source, with the subtype the region article gives; its prices come from the source and it is bought with record_investment. The rates, the exempt kinds and the government bond codes are in the article of the region (investments_br for a Brazilian book).

An index that compounds by business day counts business days (bus252). A pre-fixed rate or a spread over a monthly index counts the business days of the calendar of the region; without one it counts calendar days (act365). A monthly index enters by published month, without pro rata. The accrued Price is gross: tax is not deducted; a position of a taxed subtype also shows its estimated tax and net value. A Price typed by the user (record_price, after the statement of the issuer) replaces the accrued one. manage_instrument edit sets the issuer identifier (issuer_scheme, issuer_id) and set_terms corrects the terms.

A security that pays coupons or returns principal takes its payment dates with the terms, and the accrual prices the coupons. Payments are in the article fixed_income_payments.
