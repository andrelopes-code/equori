# Activity of a market data feed

Amendment A267 of ADR 025 (F5, F7, F10) and A222 MQ10. Owner, 2026-11-24: the states of the update are badly made, a feed stands with a dash for a long time as if it would never load.

## 1. Causes

- Enabling an index asked for no run: it waited for the next tick, up to 6 hours.
- A tick ran the feeds in one line, the price histories of many minutes before the indexes of seconds.
- The screen read the feeds once. It read them again only after "Update now".
- No state told a feed that waits or runs from one without data: the date read as a dash and the word as "No data", then as "Overdue" at the date a first load had reached.

## 2. Rules

| ID | Rule |
|---|---|
| FA1 | `GET /market-data/feeds` states `activity` of each feed: `running` while a run of it lasts, `queued` while one waits in a tick or was asked for, `idle` otherwise. It is kept in memory. |
| FA2 | A tick runs the indexes, the expectations, the curves and the prices of the window first, then the institutions, the reports and the pending histories, then the accrual, the splits and the holes. |
| FA3 | Enabling a feed runs it at once, apart from the tick. Two runs of one feed never overlap: the second is left to the first. |
| FA4 | The row of an enabled feed reads, first to last: running, "Updating", or "Loading" on a first load; "Queued" while a first load waits; failed, without data, overdue, incomplete, up to date. A first load is a feed without data or an index never read whole (A265 RI4). A running feed shows the loader in the place of the dot. A feed without a date reads "First load" while it runs or waits and "No date" otherwise; no row reads a dash. A run in progress is no problem of the region; the verdict of a region with first loads counts them. |
| FA5 | The screen reads the feeds again every 2 seconds while one runs or waits or a refresh was asked for, every 10 seconds while a history is pending, and not otherwise. |

## 3. Approaches

| Approach | Trade-off | Choice |
|---|---|---|
| A worker for the enabled feeds beside the tick, one lock per feed | One goroutine; a feed runs in seconds while a history downloads | Chosen |
| Every feed in its own goroutine | Twenty sources at once on the database and the network | Rejected |
| Reordering the tick alone | A feed enabled during a history still waits for it | Rejected |

## 4. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 to R4 | Does not apply: no regional value. `activity` is not regional: an enum. |
| R5 | `marketData.status.updating`, `.queued`, `.loading`, `marketData.firstLoad`, `marketData.noDate`, `marketData.count.loading.*`. |
| R6 | Counts through the catalog. |
| C1 to C4, T2 | Does not apply. |
| T1 | Does not apply: no date is computed. |
| B1, B2, B3 | No table, no operation, no setting. |
| D1 to D5 | Does not apply: in memory. |
| S1 | No operation; a field of an existing one. |
| S2 | The same on a phone: the word and the date keep their line. |
| S3 | The article `settings_language_and_region.md`. |
| S4 | No. |
| X1 | S712 an index enabled during the run of a price source is loaded before that run ends; the queued and the running feeds state it. |
| X2 | Does not apply. |
