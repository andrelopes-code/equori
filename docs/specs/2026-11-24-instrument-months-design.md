# Month by month of an instrument

The Quote section of `/instruments/$code` answers "in which months and years did the price rise or fall". Amends `2026-11-12-yearly-price-change-design.md` (YP1 to YP7) and `2026-11-11-instrument-page-design.md` (IP1, IP7, IP12). Approved mock: `docs/superpowers/mocks/2026-11-24-instrument-months-design` (owner, 2026-11-24, concept A).

## 1. Diagnosis

- The summary line and the layer "Prices by date" repeat the count, the dates, the high and the low that the range figures and the Data section state. Only the change of each day and the source filter are unique, and both serve an audit.
- The yearly table states four figures per year and no month.
- The chart toolbar lists the prices of the range as a table and exports them.
- The yearly table disappears without a message when its read fails.

## 2. Rules

| ID | Rule |
|---|---|
| IM1 | The block "Month by month" replaces the yearly table and stands last in the Quote section, after the range figures. It is a titled surface whose description states: change of the price of each month in percent, splits adjusted, income not included. |
| IM2 | One row per calendar year with a price, newest first: twelve month cells, the change of the year and the last price of the year. A month without a price is a dash. |
| IM3 | The change of a month is `changeBp` from the last price before the month to the last price of the month, over the adjusted prices (A266 SA6). The first month starts at the first price of the series. The change of a year starts at the last price before the year, or the first price of the series. Null, drawn as a dash, when both ends are the same price or the start is zero. |
| IM4 | The block is drawn when the series holds prices in two or more months. |
| IM5 | Above the table: the best and the worst month with their date, and the months that rose and fell out of the months with a change. |
| IM6 | A cell is shaded in four steps that start at 0%, 2%, 5% and 10%. The portfolio keeps 0%, 1%, 3% and 6%. Over the stored history since 2017, 47% of the months of a stock lie at 6% or more and 23% at 10% or more. |
| IM7 | The column of last prices takes one count of decimals, the one of the newest price, and no symbol; the table's caption names the quote currency. |
| IM8 | Twelve years are drawn; a button shows every year from the thirteenth on, and hides them again. |
| IM9 | While the read is pending and the instrument has a first quote, the block draws its placeholder. A failed read draws the error with a retry. |
| IM10 | Privacy mode masks every change and price, as it did in the yearly table. |
| IM11 | The layer "Prices by date" opens from the Data section, beside the sources. It reads one calendar year, the one of the last quote at first, chosen by a filter "Year"; the source filter stays and returns to every source when the year changes. It lists the traded close (A266 SA6). |
| IM12 | The figure "Quotes in the range" leaves the range figures: the Data section states the count of the series. |
| IM13 | The heat cells, their head, their steps and the month figures are shared by the portfolio and the instruments in `web/src/ui/month-heat`. |

## 3. Data inventory

| Datum | Destination |
|---|---|
| Start price of a year | The last price of the row below; for the first year, the layer of prices by date |
| End price and change of a year | Columns of the block |
| Dates of a partial year | Dashes in the months without a price; the exact dates in the Data section |
| Count, dates and latest source of the range | The Data section (series) and the hero (latest source) |
| Change and source of each day | The layer of prices by date |

## 4. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 to R4 | Does not apply: the Gregorian calendar month is the only period; no value set or extension point. |
| R5 | Keys `instrument.months.*` and `instrument.prices.year` in pt-BR and en; the keys `instrument.yearly.*`, `instrument.prices.summary`, `instrument.figures.points` and `instrument.figures.pointsNote` leave. |
| R6 | Month names, changes and prices through `Intl` from the active tag; the minus sign is U+2212. |
| C1 | No amount is stored. Prices stay exact decimals; a change is an integer of basis points. |
| C2 | Does not apply: no amounts are added. |
| C3 | Prices are in the quote currency of the record, named in the caption. Tested with a USD quote. |
| C4 | The quote currency comes from the record. |
| T1 | Dates are calendar dates, compared as text; "today" comes from `useToday`. |
| T2 | Does not apply. |
| B1, B2, B3 | Does not apply: no table, operation or setting. |
| D1 to D5 | Does not apply: nothing is written. |
| S1 | No operation is added. |
| S2 | The page stays desktop-only (IP14). Beside the assistant pane the table falls to the xs text size. |
| S3 | `investments.md` of the guide changes in the same commits. |
| S4 | Does not apply: the assistant reads the same operations. |
| X1 | No scenario is added. |
| X2 | The C3 test runs with a USD quote and a BRL base. |
