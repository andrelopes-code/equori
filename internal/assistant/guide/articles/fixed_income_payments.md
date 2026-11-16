Payments of a fixed income security are recorded on the New transaction screen or with record_investment. The amounts come from the notice of the broker or the issuer; the notice prevails over any estimate.

Interest paid in cash. record_investment kind income. income_type coupon is the coupon of a bond. income_type interest is the interest of a deposit that pays periodically. gross is the amount before tax. withheld is the tax kept at source; the Cash receives the difference. withheld is 0 for a security that pays no tax at source. The rates are in the article of the region.

Redemption or sale. record_investment kind sell for the quantity redeemed. unit_price is the gross redemption divided by the quantity, up to 12 decimals. taxes is the tax withheld on the redemption, fees any other charge. The result is the gross less the cost. A region may remove the cost of the oldest purchase first: the Position screen and the sale form show the cost the sale removes.

Estimate. estimate_redemption returns the tax a redemption withholds, from the purchase lots the sale consumes, each at the rate of its own holding days. get_help investments_br names the regions and the securities it covers. The answer of the account lots (the field estimates_withholding) tells whether the account has an estimate. Use it when the user has no notice yet.

Amortization of a security that returns principal in parts has no operation of its own. Count the quantity in units of nominal value and record as Price the unit price of the issuer divided by the current nominal value. An amortization is then a sell of the amortized part of the quantity at that Price. The interest paid with it is an income coupon.

A redemption before maturity is valued at the Price of the day: the gain or loss is the gross less the cost.

Savings accounts and reserves are not Instruments: their yield is a transaction categorized under Yield.

The Portfolio screen and get_tax_year list each income with its tax treatment.
