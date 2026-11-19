Income paid on an Investment is recorded with record_investment kind income, on the New transaction screen or by the assistant. It takes the Investment line, the payment date (the day the money arrives), gross (the amount before tax), withheld (the tax kept at source, 0 when none) and the Cash account that receives the net amount. get_portfolio with view income_types lists the types the book accepts; the article of the region names its rates and its exempt income (investments_br for a Brazilian book).

The types:

- dividend: a company dividend.
- jcp: interest on equity, taxed at source on the gross amount. When withheld is absent, equori applies the region's rate of the payment date. The assistant passes withheld from the broker notice.
- distribution: a distribution of a real estate fund or another fund.
- coupon and interest: fixed income payments, as in fixed_income_payments.

Bonus shares and splits are corporate actions, not income. A bonus with a cost per unit is recorded through the corporate action.

withheld is always the amount of the notice. It is not computed from gross, except the default of jcp.

Outside the regions that have an article, the types and the default withholding follow the region of the book; the tax withheld abroad goes in withheld, in the currency of the payment.

A correction of an income is a correction of the whole record, with a reason. Before recording, search_transactions for that date and Investment avoids a duplicate.

The tax treatment of each income reads exempt, exclusive (taxed at source) or taxable (declared in the annual return by the progressive table) in the Portfolio screen and in get_tax_year; the label does not change the amount recorded.
