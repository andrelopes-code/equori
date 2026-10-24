# Instruments and prices

Item 8 of `docs/web-roadmap.md`. Contract: `listInstruments`, `defineInstrument`, `getInstrument`, `getInstrumentTerms`, `putInstrumentTerms`, `listPrices`, `recordPrice`, `importPrices`, `listInstrumentSubtypes`, `listPositions`. Scenarios: S123 to S125.

## Decisions

- Feature directory `web/src/features/instruments/`; destination `/instruments` (phone: More sheet).
- `defineInstrument` has no screen in settings, contrary to the roadmap status line; the form is new.
- The contract has no operation that returns the latest price. The catalog calls `listPrices` once per instrument over the last 366 days and keeps the greatest date. A currency quotes in the base currency; the base currency itself has no price.
- `listPositions` takes a date and returns every account; the instrument page filters it by instrument code.
- Region-dependent values: type, subtype, index, day count and source are contract values and read as catalog words with the raw code as fallback. No list of them is a literal beyond the contract enumerations of `InstrumentType` and `TermsDayCount`.
- Unit prices and the average cost follow the privacy rule of `positions-tab.tsx`: masked when privacy mode is on.

## Slices

0. `fix(web): list the budget deletion in the admin operations` (done: `operations.test.ts` passes).
1. `feat(web): add the instrument catalog`: route, navigation, grouped catalog with latest price, define form with subtype select, link from settings.
2. `feat(web): add the instrument page with prices and positions`: route `/instruments/$code`, price chart and table over up to 366 days, manual price form, positions.
3. `feat(web): add fixed income terms and price import`: terms form with replacement notice (S123 to S125), CSV price import, roadmap item 8 as Delivered.

## Tests (vitest)

- Catalog grouping by type with latest price; subtypes filtered by type; define request body.
- Price window never longer than 366 days; manual price replacement notice; positions of the instrument.
- Terms only for `fixed_income`, with the values of S123 and S124; replacement notice; import result and Problem.
