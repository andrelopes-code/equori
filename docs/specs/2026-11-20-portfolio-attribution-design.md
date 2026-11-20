# Portfolio attribution: what each holding added to the year

- Date: 2026-11-20
- Status: approved. The owner asked for the yearly result of each holding beside the portfolio's ("quando 2 ativos rendem mal no ano mas outros 4 vão bem e eles acabam puxando os dos que foram mal pra cima") and approved the recommendations of the proposal ("use suas recomendações, e faça").
- Scenarios: S656 to S659, S670 and S671.
- Amendment 2026-11-20 (owner: "temos que ver se nosso cálculo está bem feito, considerando a proporção dos investimentos, a rentabilidade, a rentabilidade real"; "siga sua recomendação"): one method for every rate of the section (AT8 to AT12) and columns by year (section 3).

## 1. Context

The section "Como rendeu" answers how much the portfolio earned in a chosen period. It does not answer which holdings produced that result. Attribution is the split of the portfolio's money result of a period into the result of each holding.

Measured on the demo book (2026-11-20): the sum of the holdings' results of formula AT2 equals the portfolio's money result (closing − opening − flows of `GET /reports/return`) to the cent in 2021 to 2025. In 2026 it differed by −R$ 56,23: the income tax withheld on the redemption of RF.260515.QZG3S, which a realized result (proceeds = gross − fees) leaves out. AT2 subtracts the taxes of a sale.

An independent check (2026-11-20) recomputed every row of 2021 to 2026 from the cash of each trade and income and the stored closes, without cost basis or realized results: every result, rate and stale date equalled the API. It also showed that the total row mixed two methods: the rows took the modified Dietz return and the total the time-weighted return of the tree with its cash (2021: 2.05% against 7.46%; 2022: −0.19% against 1.24%), so the rows did not add up to the total. AT8 to AT12 replace AT3's rate.

## 2. Rules

- AT1. A period is a calendar year: from January 1 to December 31, and to today of the book for the current year. The years start with the year of the first posting of a brokerage tree and end with the current year.
- AT2. The result of a holding in a year is, in the base currency: (market value − cost basis) at the end of the year − (market value − cost basis) at the end of the previous year + Σ (proceeds − fees − taxes − cost) of its sales and write-offs in the year + Σ (gross − withheld) of its income in the year. The holdings of one instrument in several brokerages add into one row.
- AT3. The money result of the portfolio is closing − opening − Σ flows of the brokerage trees over the year (the figures of `GET /reports/return` without `account_id`). `other` is the money result less the sum of AT2: the yield of uninvested cash, fees and taxes recorded outside a trade, and the exchange on cash in another currency.
- AT4. The rate of a holding is the money-weighted return of the year by the modified Dietz method: AT2 ÷ (market value at the start + Σ wᵢ × Fᵢ). Fᵢ is the money put into the holding on day i: the change of cost basis of the day less the result of the day's sales and less its net income (a purchase is gross + fees; a sale is −(proceeds − fees − taxes); a write-off is 0; an income is −(gross − withheld), money that leaves the holding for the cash). Without the income as a flow out, the capital of the cash under AT9 missed the income it received and read negative: −0.16% on the demo book in 2026. wᵢ = (end − i) ÷ (end − start) in days, start being December 31 of the previous year. The rate is absent when the denominator is not positive. It is rounded half to even to basis points.
- AT5. A holding whose market value at either end of the year takes a price of its instrument more than 14 days older than that end is stale. A stale row carries `stale_since`, the date of that price, and no rate. Its result stays in the sum of AT2: the screen states it instead of drawing its bar.
- AT6. A holding without any price at either end makes the year unmeasurable: the year carries `missing`, the instruments without a price, and no `result`, `period_bp`, `other` or `items`. The screen states the missing instruments for that year.
- AT7. Rows are sorted by result, the largest first.
- AT8. The capital of the portfolio is its average money at work in the year: (opening × T + Σ Fᵢ × (end − dateᵢ)) ÷ T, T the days of the measured period of AT13 and Fᵢ the external flows of AT3. The return of the portfolio is its money result ÷ its capital (modified Dietz, the method of AT4), rounded half to even to basis points; absent when the capital is not positive.
- AT9. The capital of a holding is the denominator of AT4. Its weight is its capital ÷ the capital of the portfolio; its contribution is its result ÷ the capital of the portfolio, so contribution = weight × rate. `other` takes the capital of the portfolio less the capital of the holdings. Weights add up to 10,000 basis points and contributions to the return of AT8: each set is rounded by the largest remainder (the floor of each exact share, then one unit to each of the largest remainders, the earlier row first on a tie).
- AT10. A comparison measures what the same money would have earned at an index: an account that opens with the opening value of AT3 and takes the flows of AT3 on their dates grows each day by the index of the day, before the flows of the day. Its result is its closing balance less opening and flows; its return is that result ÷ the capital of AT8 over the same days. The portfolio's return over those days is AT8 on them. The difference of the two results is money the portfolio earned above or below the index.
- AT11. The rate comparison takes the default daily index of the book's region (`BenchmarkIndex`), each rate growing the day it is dated. The inflation comparison takes the default monthly index of the region (`InflationIndex`), the rate of a month spread over its days as (1 + rate)^(1 ÷ days of the month). The days end at `until`: the last day with a rate (daily) or the last day of the last month that has a rate with every month before it in the year (monthly), never after the end of the year. A daily index covers the period when its first rate is at most 7 days after `since` and no two rates are more than 7 days apart; a period it does not cover would read the days without a rate as no growth, so its comparison is absent. A monthly index covers it from the month of `since`. A comparison without a rate in the year, or with an index of another currency than the base, is absent.
- AT12. The real return is (1 + the portfolio's return) ÷ (1 + the inflation return) − 1 over the days of the inflation comparison (Fisher), rounded half to even.
- AT13. A period is measured from the day its money is at work: the year when it opens with a value, else from the day after the day before its first flow, so a flow earns from the next day. `since` is that first day. Dividing a result by the capital of a whole year when the money came in December would state a yearly rate as the growth of the year: 2021 of the demo book read 5.29% for money that came on 2021-11-09 and 2021-12-08. A holding's own rate (AT4) is measured the same way from its own first flow; its weight and contribution stay on the period of the portfolio, so they add up (AT9).

## 3. Interface

`GET /reports/attribution` (`x-book-role: read`) returns `years`, oldest first. Each year holds `year`, `from`, `to`, and either `missing` (AT6) or `since` (AT13), `result` (Money), `capital` (Money, AT8), `return_bp` (AT8), `other` (AT9: `result`, `weight_bp`, `contribution_bp`, `return_bp`), `items`, `rate` and `inflation` (AT10, AT11). Each item holds `instrument`, `result` (Money), `weight_bp`, `contribution_bp`, `return_bp` (absent under AT4 and AT5) and `stale_since` (date, present under AT5). A comparison holds `index`, `until`, `return_bp` (the portfolio over its days), `result` (the portfolio's money over its days), `index_bp`, `index_result` and, for inflation, `real_bp`.

The section "Quem puxou a carteira" sits below "Como rendeu" on `/portfolio`:

- Columns by year, the last six, under the heading "Rendimento da carteira em cada ano": each column is the bar of the return of AT8 of its year, beside a thinner bar of `index_bp` of the rate comparison when the year has one, with the return written under it in the tone of its sign. A legend names both bars. A column is a choice: the current year is chosen on load.
- The summary "Como foi {period}": one line each for the portfolio (`return_bp`, `result`), the same money at the CDI (`index_bp`, `index_result`) and inflation (`index_bp`, `index_result`), as bars on one axis with the rate and the money end-aligned; a note says each index gets the same contributions on the same dates. Under the lines, figures with the name above the value: the difference from the CDI (`rate.result − rate.index_result`), the real return (`real_bp`), the count and sum of the holdings that gained and of those that lost. A gain is written in the success tone, a loss in the danger tone. Each comparison that ends before the year names its `until`; a partial year names its last day. (Amended 2026-11-20: the sentences and the marks on the columns read as confusing.)
- Rows: instrument, a bar of the contribution on an axis centred on zero, weight, rate, contribution and result. The five largest and the five smallest results show one by one; the rest adds into one row "Outros {n} ativos" with the sums of their weights, contributions and results and no rate. A stale row writes "Sem cotação desde {date}" in place of its bar and rate.
- A row "Saldo em conta, tarifas e câmbio" with `other` when its weight or result is not zero, and the total row "Carteira": 100%, the return of AT8 as rate and contribution, and the result.

## 4. Cross-cutting questions

- R1: The indexes of AT11 come from the region: `BenchmarkIndex` and `InflationIndex` (`docs/contributing/regions.md`, rows of the return report); the calendar year is the same in every region.
- R2: A region without an index has no comparison of that kind; the rest of the year stands.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: Section title, summary labels, row labels, partial year mark, stale text and help text: catalog keys `portfolio.attribution.*` in pt-BR and en.
- R6: Money through `useMoneyFormat()`, rates through `formatBasisPoints`, dates and years through `Intl` with the active tag.
- C1: Every amount is an integer of minor units of the base currency.
- C2: Market values are converted to the base currency at the date of each end (`Convert`); cost basis, proceeds and income are recorded in the base currency (ledger weights). A missing price is AT6, never zero.
- C3: A holding quoted in another currency is valued in the base currency at each end; the exchange on its value is part of its result. The exchange on cash goes to `other` (AT3). An index of another currency than the base gives no comparison (AT11).
- C4: The currency is the base currency of the book, from settings.
- T1: Year ends are calendar dates; the current year ends at today of the book (`Ledger.Today`).
- T2: The daily index grows on the days it is dated (its own calendar of business days); the monthly index spreads over the calendar days of its month.
- B1: Does not apply: no table.
- B2: `read`; the HTTP test covers a member with read access and a stranger.
- B3: Does not apply: no setting; the selected year is not stored.
- D1 to D5: Does not apply: no table, no schema change, no recorded fact changes.
- S1: `getAttribution`; tool exposure: the assistant reads it through the `attribution` view of `get_portfolio`.
- S2: Does not apply: `/portfolio` is not a phone route (ADR 027).
- S3: `internal/assistant/guide/articles/investments.md` describes the section.
- S4: The `attribution` view of `get_portfolio` returns the same years.
- X1: S656 (results, sum, weights, contributions and return), S657 (sale with taxes and `other` = 0), S658 (stale price), S659 (missing price), S670 (comparisons with CDI and IPCA and the real return), S671 (a region without indexes).
- X2: S671 runs a book outside Brazil, whose region has no index.
