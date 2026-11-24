# Split-adjusted price charts and changes

Amendment A266, issue #72. Amends MQ18 of `2026-11-09-market-quotes-design.md`, section 1 of `2026-11-12-instrument-quotes-overview-design.md` and YP3 to YP5 of `2026-11-12-yearly-price-change-design.md`, which read a split as a fall. Owner, 2026-11-24: the history of what a person holds has no defect that other sites do not have.

## 1. Measurements (2026-11-24)

The splits Yahoo states for the 16 BVMF instruments of an instance with splits were compared with the closes of the B3: `close / previous close × ratio` lies between 0.966 and 1.06 for 48 of 49, and is 4.90 for one (ABEV3, 2013-11-12, the split of the share it replaced). The B3 states KNRI11 (10:1, 2014-06-02), which Yahoo does not. Neither states BBDC4 (2:1, 2007-03-26).

## 2. Rules

| ID | Rule |
|---|---|
| SA1 | A split is the first session of an instrument in new units and the ratio of the units after it to the units before it: 5 for 5:1, 0.008 for 1:125, 1.1 for a bonus of 10%. |
| SA2 | A price source states splits through the optional interface `feed.SplitSource`: `b3_price_report` (the stock events of the B3 listed companies page: DESDOBRAMENTO and BONIFICACAO of p% are 1 + p / 100, GRUPAMENTO is the factor; events of one day multiply; the class comes from the code: 3 `ACNOR`, 4 `ACNPR`, 5 `ACNPA`, 6 `ACNPB`, any other suffix an ISIN without `ACN`) and `yahoo_chart` (`events=split`). Once a day the enabled ones are read, in the order of the registry. |
| SA3 | A split is stored when the closes confirm it: the first price on or after its date, at most 15 days later, over the last price before it, times the ratio, lies in [0.75, 1.33]. Its date becomes the date of that first price. The first source to state a date keeps it. |
| SA4 | `GET /prices` gives each price `adjusted`, its value over the ratio of each split after its date, rounded half to even to 8 decimals, absent without one. `value` stays the traded close. |
| SA5 | `GET /instrument-quotes` gives the references and the trend adjusted: the change of a window that holds a split is the change of the holder. |
| SA6 | The chart, the figures of the range, the hero and the yearly changes of an instrument read the adjusted price. The table of prices by date reads the traded one. |
| SA7 | Valuations, positions and the ledger read the traded close: the quantity of a position carries the split as a corporate action. |

## 3. Approaches

| Approach | Trade-off | Choice |
|---|---|---|
| Adjust on read from stored, confirmed splits | One join; the traded close stays the fact | Chosen |
| Store adjusted closes | Every valuation before a split would be wrong, and each split rewrites the history | Rejected |
| Infer a split from a jump of the closes | A fall of 50% of a company would be hidden | Rejected |

## 4. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | The class suffix and the event words of the B3 live in `feed/b3pricereport`. |
| R2 | Without a split source, no price is adjusted. |
| R3 | `source` keeps `^[a-z0-9_]{2,40}$`. |
| R4 | None: `feed.SplitSource` is an optional interface of the extension point "Price source". |
| R5 | `instruments.subtitle` and `instrument.yearly.note` state that splits are adjusted. |
| R6 | Does not apply: the prices keep their format. |
| C1 | Prices are exact decimals (`money.Rate`). |
| C2 to C4 | Does not apply: one instrument in one quote currency. |
| T1 | Dates are sessions. |
| T2 | Does not apply. |
| B1 | Table of instance data, without `books_id` (ADR 025, Context). |
| B2, B3 | No operation, no setting. |
| D1 | `marketdata_split` is left out of the export: a tick writes it again. |
| D2 | Migration 151. |
| D3, D4, D5 | Does not apply. |
| S1 | No operation; a field of an existing one. |
| S2 | The same on a phone. |
| S3 | The article `settings_language_and_region.md`. |
| S4 | No: the assistant reads traded prices. |
| X1 | S711 a confirmed split leaves no jump in the prices and the changes; an unconfirmed one is not stored. |
| X2 | Does not apply. |
