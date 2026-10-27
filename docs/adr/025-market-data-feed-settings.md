# ADR 025: Market data feed settings

- Status: accepted
- Date: 2026-10-27
- Amends: ADR 016 X6 (feeds only), calculators design §6 ("History")
- Keeps: N17 (`docs/domain/08-non-functional-requirements.md`): the application contacts only feeds an operator or an admin enabled

## Context

An instance enables price and index feeds through `EQUORI_PRICE_FEEDS` and `EQUORI_INDEX_FEEDS`. A change requires editing the environment and restarting the process, and the identifiers (`br_cdi`, `b3_cotahist`) are not shown anywhere in the interface. A failing feed is visible only in the log: the B3 feed stored no price from 2026-10-22 to 2026-10-27 because one record of one daily file was in UTF-8 (fixed in `791b3fe5`), and no screen showed it.

Market data is public and shared by the instance: `marketdata_price` and `marketdata_index_rate` have no `user_id`. ADR 003's `user_id` rule applies to business data of a user, not to these tables.

## Decision

| ID | Rule |
|---|---|
| F1 | Table `marketdata_feed (id text PRIMARY KEY CHECK (id ~ '^[a-z0-9_]{2,40}$'), enabled boolean NOT NULL)`. It has no `user_id`. A row exists for each feed whose state was stored. |
| F2 | The enabled set is read on each tick. With at least one row, it is the rows with `enabled`. With no row, it is the identifiers of `EQUORI_PRICE_FEEDS` and `EQUORI_INDEX_FEEDS`, empty when neither is set. |
| F3 | `SuggestedFeeds(region)` in `internal/marketdata/region_defaults.go` names the feeds suggested to a user of `region`; a suggestion enables nothing. `GET /indexes` lists the suggested indexes first, so a calculator offers the region's index as its first choice. `BR` → `b3_cotahist`, `bcb_ptax`, `br_cdi`, `br_ipca`; `US` → `us_sofr`, `us_cpi`; a member of the euro area → `ecb`, `eu_estr`, `ea_hicp`; any other region → none. |
| F4 | Every feed of the registry is built at startup; `EQUORI_FEED_<ID>_URL` keeps overriding its address. An unknown identifier in the two variables still stops the process (ADR 016 X6). |
| F5 | `GET /api/v1/market-data/feeds` (`listMarketDataFeeds`): every feed of the registry with `id`, `kind` (`price` or `index`), `enabled`, `suggested` (by F3 for the calling user's region), `last` (latest stored date of its source, or null), `stale`, `last_run` (time of the last tick that ran it, or null) and `error` (message of its last failure, or null). The tick status is kept in memory and is empty after a restart. |
| F6 | `PUT /api/v1/market-data/feeds/{id}` (`setMarketDataFeed`) with `{enabled}` stores the row. On the first write with no row, the current enabled set of F2 is stored first, so a write never changes the state of another feed. An unknown identifier is 404 `not_found`. |
| F7 | `POST /api/v1/market-data/refresh` (`refreshMarketData`) starts a tick and answers 202. While a tick runs, scheduled or requested, it answers 409 `refresh_running`. The tick runs on the context of `RunFeeds`, not of the request. |
| F8 | F6 and F7 change the instance. They require the role `admin`; another user gets 403 `admin_required`. F5 is open to every user. |
| F9 | Each source declares `Lag`, in calendar days: the delay after the end of a period by which its publication is due. A feed is `stale` when it is enabled, has a `last`, and today is later than the end of the period of `last` plus `Lag`. The end of a daily period is the next day; the end of a monthly period is the first day of the next month. Values: `b3_cotahist`, `bcb_ptax`, `ecb`, `br_cdi`, `eu_estr`, `us_sofr` 5; `br_ipca` 20; `us_cpi` 20; `ea_hicp` 25. |
| F10 | The settings screen shows one row per feed: its name, kind, switch, `last`, a warning when `stale` or `error` is set, and one "Update now" action for the instance. While no feed is enabled and some are suggested, it offers one action that enables the suggested feeds. |
| F11 | The three operations have no tool for language models: their exclusion is `-instance` (ADR 012 T14). |

## Consequences

- A new instance fetches nothing until an admin enables a feed; the settings screen suggests the feeds of the admin's region.
- The two variables become seeds: once a row exists they are ignored.
- `identity` exposes the role of a user.
- A feed added in a later version starts disabled on an instance that stored rows.

## Not covered

- Per-instrument staleness of prices: a feed is stale by its latest stored date over all instruments.
- Notifications of a stale feed outside the settings screen.
- Price sources for exchanges outside the B3.

## Revisit criterion

An instance whose users need different feed sets, or a feed whose publication delay varies beyond its `Lag`.
