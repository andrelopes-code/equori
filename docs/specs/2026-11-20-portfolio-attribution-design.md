# Portfolio attribution: what each holding added to the year

- Date: 2026-11-20
- Status: approved. The owner asked for the yearly result of each holding beside the portfolio's ("quando 2 ativos rendem mal no ano mas outros 4 vão bem e eles acabam puxando os dos que foram mal pra cima") and approved the recommendations of the proposal ("use suas recomendações, e faça").
- Scenarios: S656 to S659.

## 1. Context

The section "Como rendeu" answers how much the portfolio earned in a chosen period. It does not answer which holdings produced that result. Attribution is the split of the portfolio's money result of a period into the result of each holding.

Measured on the demo book (2026-11-20): the sum of the holdings' results of formula AT2 equals the portfolio's money result (closing − opening − flows of `GET /reports/return`) to the cent in 2021 to 2025. In 2026 it differed by −R$ 56,23: the income tax withheld on the redemption of RF.260515.QZG3S, which a realized result (proceeds = gross − fees) leaves out. AT2 subtracts the taxes of a sale.

## 2. Rules

- AT1. A period is a calendar year: from January 1 to December 31, and to today of the book for the current year. The years start with the year of the first posting of a brokerage tree and end with the current year.
- AT2. The result of a holding in a year is, in the base currency: (market value − cost basis) at the end of the year − (market value − cost basis) at the end of the previous year + Σ (proceeds − fees − taxes − cost) of its sales and write-offs in the year + Σ (gross − withheld) of its income in the year. The holdings of one instrument in several brokerages add into one row.
- AT3. The money result of the portfolio is closing − opening − Σ flows of `GET /reports/return` over the year without `account_id`; its rate is `period_bp` of that report. `other` is the money result less the sum of AT2: the yield of uninvested cash, fees and taxes recorded outside a trade, and the exchange on cash in another currency.
- AT4. The rate of a holding is the money-weighted return of the year by the modified Dietz method: AT2 ÷ (market value at the start + Σ wᵢ × Fᵢ). Fᵢ is the money put into the holding on day i: the change of cost basis of the day less the result of the day's sales (a purchase is gross + fees; a sale is −(proceeds − fees − taxes); a write-off is 0). wᵢ = (end − i) ÷ (end − start) in days, start being December 31 of the previous year. The rate is absent when the denominator is not positive. It is rounded half to even to basis points.
- AT5. A holding whose market value at either end of the year takes a price of its instrument more than 14 days older than that end is stale. A stale row carries `stale_since`, the date of that price, and no rate. Its result stays in the sum of AT2: the screen states it instead of drawing its bar.
- AT6. A holding without any price at either end makes the year unmeasurable: the year carries `missing`, the instruments without a price, and no `result`, `period_bp`, `other` or `items`. The screen states the missing instruments for that year.
- AT7. Rows are sorted by result, the largest first; a row with no result goes last, by instrument.

## 3. Interface

`GET /reports/attribution` (`x-book-role: read`) returns `years`, oldest first. Each year holds `year`, `from`, `to`, and either `missing` (AT6) or `result` (Money), `period_bp` (absent when undefined), `other` (Money) and `items`. Each item holds `instrument`, `result` (Money), `return_bp` (absent under AT4 and AT5) and `stale_since` (date, present under AT5).

The section "Quem puxou a carteira" sits below "Como rendeu" on `/portfolio`:

- A row of years. Each year shows its rate (`period_bp`); the current year is selected on load and is marked as partial.
- One sentence: "Em {year}, a carteira ganhou {result} ({rate}). {n} ativos somaram {gains}; {m} tiraram {losses}." The second sentence names only the counts that are not zero.
- Rows of the five largest results and of the five smallest negative ones; the rest adds into one row "Outros {n} ativos". Each row: instrument, a bar on an axis centered on zero, the result and the rate. A stale row writes "Sem cotação desde {date}" in place of its bar and rate.
- A row "Saldo em conta, tarifas e câmbio" with `other` when it is not zero, and the total row "Carteira" with `result` and `period_bp`.

## 4. Cross-cutting questions

- R1: Does not apply: no regional value; the calendar year is the same in every region.
- R2: Does not apply: no region-dependent value.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: Section title, sentence, row labels, partial year mark, stale text and help text: catalog keys `portfolio.attribution.*` in pt-BR and en.
- R6: Money through `useMoneyFormat()`, rates through `formatBasisPoints`, dates and years through `Intl` with the active tag.
- C1: Every amount is an integer of minor units of the base currency.
- C2: Market values are converted to the base currency at the date of each end (`Convert`); cost basis, proceeds and income are recorded in the base currency (ledger weights). A missing price is AT6, never zero.
- C3: A holding quoted in another currency is valued in the base currency at each end; the exchange on its value is part of its result. The exchange on cash goes to `other` (AT3).
- C4: The currency is the base currency of the book, from settings.
- T1: Year ends are calendar dates; the current year ends at today of the book (`Ledger.Today`).
- T2: Does not apply: no business days.
- B1: Does not apply: no table.
- B2: `read`; the HTTP test covers a member with read access and a stranger.
- B3: Does not apply: no setting; the selected year is not stored.
- D1 to D5: Does not apply: no table, no schema change, no recorded fact changes.
- S1: `getAttribution`; tool exposure: the assistant reads it through the `attribution` view of `get_portfolio`.
- S2: Shown on a phone: rows keep the instrument, the result and the bar; the rate moves under the result.
- S3: `internal/assistant/guide/articles/investments.md` describes the section.
- S4: The `attribution` view of `get_portfolio` returns the same years.
- X1: S656 (results, sum and rate), S657 (sale with taxes and `other` = 0), S658 (stale price), S659 (missing price).
- X2: Does not apply: no regional value.
