# Portfolio clarity

Redesign of `/portfolio`, `/portfolio/year`, the positions of an account, an instrument's page and the instrument catalog. Amends `docs/specs/2026-10-23-investments-design.md` (allocation on screen), `docs/specs/2026-11-06-return-index-comparison-design.md` (R7, R17, "Portfolio, return section") and `docs/specs/2026-10-29-ui-clarity-curation-investments.md` (the words "Rendimentos" and "Fluxos").

## Intent

The screens hold real figures and answer no question. Measured on the demo book of 2026-11-07:

- The page states three totals for "the portfolio": 166,417.26 (positions), 170,392.69 (return), 234,210.58 (allocation of every asset account), and "% of portfolio" means two bases: stocks are 25.62% in one table and 18.16% in another.
- The total gain, 16,282.47, appears on no line of the page, and the year page states no total for the year.
- The first total stands 1,100 px below the top. Twelve positions draw twelve groups of one row each.
- Quantities and average costs ignore the locale, and tax classes read as raw codes.

A reader opens the portfolio to answer three questions: how much do I have, how much did I make, and was it worth it. An expert then wants quantity, average cost and the method of each rate.

## Decisions and their sources

| ID | Decision | Source |
|---|---|---|
| D1 | The figure compared with an index is the time-weighted return. The money-weighted rate is the investor's own result and stays in the method. | RBC Wealth Management, PWL Capital, Co-operators on TWR and MWR: TWR removes the timing of flows, MWR measures the individual's result. |
| D2 | A holding shows its gain in money and in percent, and the page states income beside it, since a price gain alone understates a holding that pays income. | Sharesight, "How your broker's performance numbers mislead you"; holding page: capital gains and dividends. |
| D3 | Allocation is drawn as sorted bars. Above five categories a pie is unreadable, and lengths read more precisely than angles. | UK Government Analysis Function, module 9; Cleveland and McGill, as cited by practitioner guides. |
| D4 | The default list shows what every reader needs; technical columns are one action away. | Progressive disclosure, Nielsen; Carroll's training-wheels studies, with the caveat that the split follows frequency of use. |
| D5 | "Portfolio" means the brokerage trees: priced positions and brokerage cash. This is the base `getReturn` already measures, so the three totals become one. Savings and reserves stay on Accounts. | `useReturnOptions`, `wholePortfolio`. |
| D6 | The allocation of every asset account moves to the net worth tab of Reports, whose subject it is. No capability is lost. | Spec G4. |

## Rules

### The page

**PC1 Order.** `/portfolio` reads top to bottom: the three summary figures, "How it performed", "Where the money is", "Investments". The list of every row comes last (RE-08).

**PC2 Summary.** One `FigureGrid` of three `FigureCard`s:

| Label | Value | Note |
|---|---|---|
| Portfolio value | Valued positions plus brokerage cash | The two parts. The count of positions without a price, when any. |
| Gain or loss | Market value minus cost over the positions whose two amounts share a currency; `delta` is the same over cost | The cost it is measured on, and that income is apart. The count of positions left out for a mixed currency, when any. |
| Income in {year} | Net income of the valuation year up to the valuation date, per currency | The tax withheld. A door to `/portfolio/year?tab=income`. |

**PC3 Holdings.** The rows of the page are a pure function of positions, accounts, instruments and cash balances (`portfolio-holdings.ts`). Each row has a kind (`position`, `cash`), the type, currency and institution it groups under, and its share of the valued total by `sharesBP`. Every share on the page comes from it, so the shares of a group add up to the group's bar.

**PC4 Cash.** A cash row is an asset account of kind `brokerage` whose currency is a currency instrument and which has no child account, with a nonzero `value` read through `/accounts/{id}/balance` at the valuation date in the valuation currency (`balance` stays in the account's own currency). A failed read leaves that row without a value and counted as unpriced. Its type is the group `cash`, "Brokerage cash".

**PC5 Grouping.** One control, "Group by" (type, currency, institution), held in `by` in the address, drives the bars and the list. Grouping by account and by investment is removed: each security is an account of its own, so both drew one row per group.

**PC6 Bars.** "Where the money is" is one framed table, largest first: the group, its share drawn as a `ProgressBar`, its value and its percent, with a total. One table replaces the pie and the table that repeated its figures, so a reader gets the length and the exact number on one line.

**PC7 List.** "Investments" is a framed `DataGrid` grouped by `by`, with sums on each group row and on a summary row. The summary row holds no label while Slotted issue #80 stands: the summary figures state the same total.

- Default columns: Investment (name, then the code in the muted tone, linked to its page), Market value, Gain or loss (amount and percent of cost, signed, in the tone of its sign), % of portfolio.
- Columns a reader adds through `ColumnManager`: Quantity, Average cost, Cost, Price, Price date, Account. The arrangement is kept in `localStorage`.
- Sort on every numeric column; default by market value, descending.
- A market value whose oldest price is more than 7 days older than the valuation date says so under the amount. The Price date column always holds the date.
- A position without a price says "No price" and stays out of every total and share. A mixed-currency gain stays empty with its accessible reason.

**PC8 Actions.** The list's heading holds "Record a buy or sale" (`/transactions/new?kind=trade`) and "Record income" (`?kind=investment_income`). The unpriced note links to `/instruments`. The empty state offers the first action.

**PC9 Header.** Title, subheading, help, valuation currency, valuation date and a link "Income and sales". The long sentence of the old link is gone.

### How it performed

**PC10 Section.** The controls stand on the heading's row: the account of the return (`ChoiceSelect`) and the period (`PeriodControl`, `allowAll={false}`), replacing the two date fields (web rule "Domain controls before families"). The default stays the 12 months that end at the valuation date. The 366-day limit stays, and a longer period states the existing warning.

**PC11 Figures.** The body is `yieldCards` (the account page's own cards), so a figure reads the same on both screens. A report without a benchmark shows one card with `period_bp`, or `annual_bp` when that is also absent.

**PC12 Method.** A `Collapsible` "How it is calculated", closed by default, holds: opening value, closing value, the time-weighted return, the money-weighted rate named "Your personal rate a year", one sentence on the difference, and "Deposits and withdrawals" (the flows). The label "Annual return" as the page's headline is gone: a market profile states that it does not annualize (R12).

### The year

**PC13 Words.** The page is "Income and sales in {year}". "Income" is money received; "Return" is a rate. The tab "Rendimentos" reads "Proventos" in pt-BR; the term "Rendimento" stays for a rate of the account page. "Fluxos externos" reads "Aportes e retiradas".

**PC14 Income tab.** Three figures (net received, withheld, gross). Two charts side by side: net by month, every month of the period, and net by investment, top ten, each in the currency most events pay in. Then "For your tax return": one table by type and treatment, replacing the two tables. Then every event, where a row names the investment and the account at the top of its tree.

**PC15 Sales tab.** Three figures (result of the year, amount sold, number of sales). "By month" and "By tax class" stand side by side, so a label stays near its figure; "By month" adds the amount sold, a figure a jurisdiction's monthly limit is read against. No limit or exemption is computed (investments design NG2). Then every sale. "Receita" reads "Valor da venda".

**PC16 Tax class labels.** `taxYear.class.<code>` exists in both catalogs for the classes of `br` and for the generic classes; an unknown code still reads as itself (ADR 016).

### Numbers

**PC17 Locale.** A quantity reads through `fmt.money(m, scale, { symbol: false })`, and an average cost through `averageCostMoney`, as money of the cost's currency with the decimals of the text. The three position tables and the sales table follow it. `fmt.plain` stays for text a field reads back.

**PC18 Words of a type.** In pt-BR `instruments.type.reit` reads "Fundos imobiliários".

### Instrument pages

**PC19 Instrument page.** The position comes first when the book holds the instrument, and states nothing when it does not. Then the chart of prices, the terms, and the facts last. The price table stays under a closed `Collapsible`. The sources `b3_cotahist`, `b3_consolidated`, `bcb_ptax` and `ecb` have labels. A price on the catalog and in the price table reads grouped with at most four decimals (`formatPrice`); the exact decimal stays in every calculation and form.

**PC20 Catalog.** The instruments grid lists securities first; the currency group starts closed.

### Net worth

**PC21 Allocation.** The net worth tab of Reports adds "Where your assets are": the table of PC6 over `/reports/allocation` at the last day of the period, by type, currency or institution (`assets_by` in the address), under a heading that states it covers every asset account.

### Valuation and regions

**PC22 A missing price.** `price_missing` says which rate is missing and offers the way out. With a valuation currency other than the base: the rate of that currency in the base, the date its recorded rates start, an action that starts the period the day after that date (the opening value reads the day before), an action back to the base currency, and a link to the currency's page to record rates. In the base currency: an investment lacks a price, with a link to the catalog. The server's detail names the first conversion it could not make, which is the investment and not the rate to record, so the screen does not show it.

**PC23 A gain in another currency.** A cost keeps the currency it was paid in. When no position has cost and value in one currency, the gain figure holds no number: it says the gain reads in the cost's currency and links there. A zero is never drawn for it. Income stays in the currency it was paid in and says so when that is not the valuation currency.

**PC24 Tax year.** The income figure reads the tax year that holds the valuation date. The response states the range of the year asked, so a date before that range reads the year before.

## Non-goals

- A chart of the portfolio's value over time. No read returns the valued series of the brokerage trees (`/reports/balances` is per account, unvalued). It needs a server read and its own design.
- Total return per holding since purchase: income reads per year, and a realized gain is not attributed to a position still held.
- Tax computation, target allocation, rebalancing, order entry (investments design NG2, NG4).
- A phone layout: `/portfolio` stays desktop-only (ADR 027).

## Region-dependent values

No new extension point. The index and the inflation index come from the report (`benchmark.index`, `inflation.index`, chosen by region on the server), and a region without one states the return alone. The tax year comes from the response of the income read (PC24). Tax class and price source labels are catalog keys with a fallback to the code (`docs/contributing/regions.md`, checklist 5 and 6). The 7-day stale price rule is not regional.

## Slices

1. Numbers and labels (PC16, PC17, PC18).
2. Holdings model, summary, bars, list, actions, header (PC1 to PC9).
3. How it performed (PC10 to PC12).
4. Net worth allocation (PC21).
5. Year page (PC13 to PC15).
6. Instrument pages (PC19, PC20).
7. Help article and assistant guide.
