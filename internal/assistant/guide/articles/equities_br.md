Listed securities of a book of region BR for an individual: stocks, units, FII, Fiagro, ETF and BDR traded on B3 (exchange BVMF). Laws read on 2026-11-18 at planalto.gov.br. The law changes: the notice of the broker prevails.

What equori does. get_tax_year lists each sale of the year with its cost at average cost, proceeds, result and tax class, and each income with its tax treatment. equori computes no tax due: it applies no monthly exemption, no rate and no loss carried forward. The user computes the tax due (DARF) from that list, or reads it in the report of the broker.

## Products

| Product | Type | Tax class | Sale of an individual | Income |
|---|---|---|---|---|
| Ação ON, PN, unit (PETR4, TAEE11) | stock | stock | 15%; exempt when the sales of stocks of the month total R$ 20,000.00 or less | dividend, jcp, bonus_shares |
| FII, Fiagro (HGLG11) | reit | fii | 20%, no exemption | distribution |
| ETF (BOVA11, IVVB11) | etf | etf | 15%, no exemption | distribution |
| BDR (AAPL34) | depositary_receipt | bdr | 15%, no exemption | dividend |

A tax class is the class get_tax_year reports for a sale; it comes from the type and the exchange BVMF. No product of this table has a guarantee of the FGC. Liquidity is the trading session of B3: the price is the market price, and settlement follows the rules of the broker.

## Recording

A security is defined with manage_instrument action define: the facts to ask are the code, the type of the table and the exchange BVMF. A purchase or a sale is recorded with record_investment kind buy or sell: the facts to ask are the brokerage, the code, the date, the quantity, the unit price, and the fees and taxes of the brokerage note. A whole note is recorded with record_brokerage_note. A code of the fractional market (PETR4F) resolves to its security. get_holding_lots shows the purchases a sale consumes and the average cost.

Day trade. A purchase and a sale of the same security on the same day by the same holder form a day trade (IN RFB 1.585/2015, art. 65). equori separates the day trade from the other sales; get_tax_year reports it as a result of kind day_trade.

Income is recorded with record_investment kind income: the facts to ask are the code, the date of payment, the income type, the gross amount and the amount withheld. A bonus, a split and a reverse split are recorded with record_corporate_action.

## Tax rules

Sale on the exchange. A net gain is taxed at 15%, and at 20% in a day trade (Lei 11.033/2004, art. 2, I and II). A sale other than a day trade withholds 0.005% of the amount sold at source, dispensed up to R$ 1.00 a month (art. 2, § 1, IV and § 4); a day trade withholds at source under the law in force (art. 2, § 3).

Exemption of stocks. The net gain of an individual on the spot market of stocks is exempt when the sales of stocks of the month total R$ 20,000.00 or less (Lei 11.033/2004, art. 3, I). The rule names stocks only: a sale of FII, ETF or BDR has no exemption.

FII and Fiagro sale. The gain on a sale of units of a FII is taxed at 20% (Lei 8.668/1993, art. 18, text of Lei 9.779/1999).

FII and Fiagro distribution. Exempt for an individual when the units trade only on an exchange or organized over-the-counter market, the fund has at least 100 holders, and the holder owns less than 10% of the units and receives less than 10% of the income of the fund (Lei 11.033/2004, art. 3, III and § 1, text of Lei 14.754/2023). The informe of the fund states the conditions. equori records a distribution of a listed FII as exempt. An amortization of units that lowers the cost has no event of its own.

Dividend. Exempt up to R$ 50,000.00 a month paid by one source to one individual, and above it when the profit is of 2025 or earlier, approved by 2025-12-31 and paid as the approval states. From 2026 a source that pays more than R$ 50,000.00 in a month withholds 10% of the whole amount (Lei 15.270/2025); withheld is that amount. The annual minimum tax on high income is settled in the tax return, not recorded here.

JCP. 15% at source up to 2025-12-31 and 17.5% from 2026-01-01, by the payment date (Lei Complementar 224/2025, art. 8 and 14).

Securities lending (BTC). Shares lent at B3 stay in the holding: the lender keeps their units and their cost, and receives the dividends as a refund from the borrower. The fee of the loan is recorded with record_investment kind income and income_type lending_fee, with the tax the broker withheld at source by the table of the fixed income gains; get_tax_year lists it with the treatment exclusive. Forwards and futures are not recorded, nor a written option (a short position): equori has no model for them.

Listed options. A call or a put bought on B3 is an instrument of type option (such as PETRK300), bought and sold with record_investment like a stock; its result has the tax class option. An option that expires worthless is record_investment kind write_off with its account_id and quantity: the premium paid becomes a realized loss. The exercise of a call is record_corporate_action kind right_exercise on the option: new_instrument is the underlying, amount the strike times the quantity, and the cost of the shares is that amount plus the premium. The exercise of a put is a sale of the underlying at the strike and a write_off of the put. On the new transaction page, the kind Trade offers the side Write-off.

Fund report. The report of a listed FII on the instrument page comes from the CVM (Informe Mensal de FII, feed br_cvm_fii); the break-even is read against the Tesouro IPCA+ curve (feed br_tesouro).

Company statements. The statements of a listed company on the instrument page come from the CVM files DFP, ITR and FCA (feed br_cvm_cia).
