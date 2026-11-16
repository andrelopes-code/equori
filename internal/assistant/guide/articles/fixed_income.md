A fixed income security is an Instrument of type fixed_income, shared by every book. A Brokerage holds it as an Investment line. Three steps record it: define the instrument, set its terms, record the buy. A missing fact (kind, issuer, amount, application date, maturity, index and rate, whether interest is paid out) is asked in one short question.

The subtype refines the kind and sets its tax class in the region of the book. get_portfolio with view subtypes lists the subtypes the region accepts. The rates, the exempt kinds and the codes of government bonds are in the article of the region (investments_br for a Brazilian book).

A bond of a government program is defined from the listing of its price source, with the code, the quote currency and the subtype the listing and the region article give. Its prices come from the source; no terms are set.

A bank product or a private security takes one instrument per contract. The code has 2 to 20 capitals, digits or dots, such as CDBINTER.2028. Define with type fixed_income, quote_currency, scale 2 and the subtype. Then set_terms with face_value 1.00 (one unit of the currency of nominal value on the issue date), issued_on, matures_on and the rate:

- Floating at a percent of an index: index_id, and percent_of_index_bp (11000 is 110%).
- Floating plus a spread: index_id, percent_of_index_bp 10000, and spread_bp a year.
- Pre-fixed: no index_id, and spread_bp the rate a year (1250 is 12.5%).

An index that compounds by business day counts business days (bus252); another index and a pre-fixed rate count calendar days (act365). A monthly index enters by published month, without pro rata. The accrued Price is gross: tax is not deducted. A Price typed by the user (record_price, after the statement of the issuer) replaces the accrued one.

Buy. record_investment kind buy, with quantity as the amount applied and unit_price 1.00 on the issue date. A later contribution to a product with the same terms, such as a daily-liquidity deposit, is a buy at the Price of that day. Another rate or maturity is another instrument.

A security that pays coupons or returns principal takes no terms: terms compound the interest and count it twice. Its Price is the unit price of the issuer, recorded with record_price. Payments are in the article fixed_income_payments.
