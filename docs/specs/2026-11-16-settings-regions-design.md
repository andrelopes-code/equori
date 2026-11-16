# Settings by region

The owner review of 2026-11-16 chose concept C of the mock: a settings pane that holds regional values orders them by relevance and marks each region with its flag. This spec covers the market data pane, the calendars pane and the currency choice of the finances pane.

## Behaviour

- A **region group** is the set of rows that belong to one region. Its header holds the flag, the region name, a "Your region" tag for the book's region, and a sentence of the form `<n> of <m> active · <verdict>`. The verdict is `Up to date`, `<n> with problems` or `None active`.
- The panes order groups by relevance: the book's region first, `Global` second, every other region after them under one disclosure named `Other regions`.
- The `Other regions` header holds text only: `<n> regions · <m> sources · <k> active`. It shows no flag; each region inside it shows its flag once, in its own header.
- The book's region and `Global` open by default. `Other regions` and each region inside it open when one of its sources has a problem, and stay closed otherwise.
- A feed row holds the name, a detail line (`<kind> · <coverage>`), a status column (latest date and a status word) and the switch. A failure or a pending history takes a third line. The kind labels are `Price`, `Index` and `Expectation`; the pane no longer has `Prices` and `Indexes` cards.
- The status word is `Up to date`, `Overdue`, `Failed`, `No data` or `Disabled`. Colour marks `Overdue` and `Failed` only; a healthy row stays neutral.
- The calendars pane groups its calendars the same way: the book's region, then `Global`.
- The base currency choice shows the flag of the currency's country beside its code and name. The name comes from `Intl.DisplayNames` in the active language.

## Region of a feed

The API has no region on `MarketDataFeed`. The web derives it from the feed id in `feedRegion`, a `switch` of the region code of each feed; an id without a case belongs to `Global`. A calendar takes its region from the same rule: `br_banking` is `BR`, `weekend` is `Global`.

Out of scope: a `region` field on the API, matching a euro-area country to the `EU` group, sorting other regions by display name (they sort by code).

## Flags

`ui/region/region-flag` draws the flag of a region as an SVG of the application's own for `BR`, `US` and `EU`, a globe for `Global`, and a plate with the two letters of the code for any other region. No dependency is added. Emoji flags are not used: Windows does not draw them. The flag is decorative (`aria-hidden`); the region name beside it carries the meaning.

## Cross-cutting questions

- R1: The region of a feed (`feedRegion`), the region of a calendar (`calendarRegion`) and the flag art (`flag-art`) vary by region. Each is a `switch` on the region code in `web/`.
- R2: A region without a case has the `Global` group for its feeds and calendars, and a code plate for its flag.
- R3: Does not apply: no stored value set is added.
- R4: Adds the rows "Feed region" (extension points) and `flag-art.tsx` (web files) to `docs/contributing/regions.md`.
- R5: Adds `marketData.region.*`, `marketData.kind.*`, `marketData.status.*`, `region.global`, `region.euroArea`, `region.yours` and `calendar.regionGroup.*` keys, each with pt-BR and en text.
- R6: Dates go through `formatDate` with the active tag; counts go through `numberFormatter`.
- C1: Does not apply: no amount is stored or computed.
- C2: Does not apply: no amounts are added or compared.
- C3: Does not apply: no amount is shown.
- C4: The currency shown comes from the instrument record, never from a literal.
- T1: A feed date is a calendar date from the API.
- T2: Does not apply: no business day is counted.
- B1: Does not apply: no table is added.
- B2: Does not apply: no operation is added.
- B3: Does not apply: no setting is added.
- D1: Does not apply: no table is added.
- D2: Does not apply: no schema change.
- D3: Does not apply: no recorded fact changes.
- D4: Does not apply: no data is written from outside.
- D5: Does not apply: the diagnostic file is unchanged.
- S1: Does not apply: no operation is added.
- S2: The settings page is served on a phone (ADR 027); each group and row is captured at 390 px.
- S3: Does not apply: the guide has no article for the topics `market_data` and `calendars`.
- S4: Does not apply: the assistant reads no new data.
- X1: Does not apply: no scenario of `docs/domain/06-scenarios.md` is added.
- X2: `feed-region.test.ts` and `settings-market-data.test.tsx` run with the book's region `DE` (no home group) and `BR`.

## Verification

Both schemes at 390 and 1440 px, the states up to date, with problems, none active, member (read only), loading and error, and no content wider than its box.
