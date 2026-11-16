Payments of a fixed income security are recorded on the New transaction screen or with record_investment. The amounts come from the notice of the broker or the issuer. Without a notice, estimate_redemption returns the income tax and the IOF of a redemption of a taxed security (CDB, RDB, LC, LF, debenture, Tesouro) from its purchase lots, each at the rate of its own holding days; the notice prevails when the user has it.

Interest paid in cash. record_investment kind income. income_type coupon is the coupon of a bond (Tesouro with semiannual interest, debentures, CRI, CRA). income_type interest is interest of a deposit that pays periodically, such as a CDB. gross is the amount before tax. withheld is the income tax kept at source; the Cash receives the difference. Exempt securities (lci, lca, cri, cra, debenture_incentivada) have withheld 0. For a taxed security the rate follows the days since the purchase: 22.5% up to 180 days, 20% from 181 to 360, 17.5% from 361 to 720, 15% above (Lei 11.033/2004, art. 1).

Redemption or sale. record_investment kind sell for the quantity redeemed. unit_price is the gross redemption divided by the quantity, up to 12 decimals. taxes is income tax plus IOF withheld. IOF applies only to a redemption before 30 days. fees is any other charge. In a Brazilian book a sale of fixed income removes the cost of the oldest purchase first; the result is the gross less that cost. At maturity the whole quantity is sold.

Amortization of a CRI, CRA or debenture that returns principal has no operation of its own. Count the quantity in reais of nominal value and record as Price the PU divided by the current nominal value. An amortization is then a sell of the amortized part of the quantity at that Price. The interest paid with it is an income coupon.

Savings accounts (poupança) and reserves are not Instruments: their yield is a transaction categorized under Yield.

A sale or redemption before maturity of an IPCA or pre-fixed security is valued by the market. The Price of the day (the Tesouro feed, or the Price typed from the broker) gives the gain or loss against the cost.

The Portfolio screen and get_tax_year list each income with its tax treatment: exempt, or exclusive (taxed at source).
