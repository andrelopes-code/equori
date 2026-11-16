Income paid on an Investment is recorded with record_investment kind income, on the New transaction screen or by the assistant: the Investment line, the payment date, gross, withheld and the Cash account that receives the net amount. The income types a book accepts come from get_portfolio with view income_types. Interest and coupons of fixed income are in the article fixed_income_payments.

dividend. A company dividend. In a Brazilian book, dividends of profits approved up to 2025-12-31 are exempt. From 2026 a company that pays more than R$ 50,000 in a month to one individual withholds 10% of the whole amount (Lei 15.270/2025). withheld is the amount the notice shows, or 0 below the limit.

jcp. Interest on equity. It is taxed at source on the gross amount: 15% up to 2025 and 17.5% from 2026 (Lei Complementar 224/2025). equori fills 15% when withheld is absent, so the assistant always passes withheld from the broker notice.

distribution. A distribution of a real estate fund (FII), a Fiagro or another fund. In listed FII and Fiagro the distribution is exempt for an individual who holds less than 10% of the units, under the conditions of Lei 11.033/2004 (a fund traded on an exchange); the informe of the fund states them. withheld is 0 unless the notice shows a withholding. equori labels a distribution exclusive (taxed at source): the label does not change the amount recorded.

coupon and interest. Fixed income payments, as in fixed_income_payments.

bonus shares and splits are corporate actions, not income. A bonus with a cost per unit is recorded through the corporate action.

Outside Brazil the income types and the default withholding follow the region of the book; the tax withheld abroad goes in withheld.

The payment date is the date the money arrives, not the record date. A correction of an income is a correction of the whole record with a reason. Before recording, search_transactions for that date and Investment avoids a duplicate.
