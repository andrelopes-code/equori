# instruments

Routes (`web/src/app/router.tsx`): `/instruments` renders `InstrumentsPage`; `/instruments/$code` renders `InstrumentPage`.

Guide topic: `investments` (`web/src/navigation/navigation-map.json`).

Entry components: `pages/instruments-page.tsx`, `pages/instrument-page.tsx`.

Endpoints used by `api.ts` (OpenAPI paths):

- `GET /instruments/{code}`, `PATCH /instruments/{code}`, `DELETE /instruments/{code}`, `POST /instruments`
- `GET /instruments/{code}/terms`, `PUT /instruments/{code}/terms`
- `POST /instruments/{code}/history`, `POST /instruments/{code}/prices`
- `GET /instrument-subtypes`, `GET /market-data/catalog`, `POST /market-data/probe`
- `GET /prices`, `POST /prices`, `POST /prices/import`
- `GET /fund-reports`, `GET /curves` (through `features/calculators`)

Folders:

- `pages/`: the two route components, their styles and tests.
- `catalog/`: the instrument grid of the list screen, its columns and its cells.
- `hide-instrument/`: the actions that hide or show one security, and the selection that does it for many.
- `define-instrument/`: the dialog that defines an instrument, with search, probe and symbol defaults.
- `edit-instrument/`: the dialog that edits an instrument and its symbols.
- `remove-instrument/`: the action that removes an instrument.
- `facts/`: the fact list of one instrument.
- `coverage/`: price coverage, history dialog and coverage actions.
- `data/`: the data section and the sources table.
- `price-import/`: price CSV import dialogs, preview and series parsing.
- `price-chart/`: the price chart and its axis.
- `fund-report/`: the fund report section of a listed real estate fund: its figures, the break-even line and their pure functions.
- `positions/`: the positions that hold the instrument.
- `months/`: the price change of each month and year (`docs/specs/2026-11-24-instrument-months-design.md`).
- `quote/`: the quote section, hero, range figures and range control.
- `sources/`: the "Where to check" section, the external pages that show the instrument (`docs/specs/2026-11-13-instrument-sources-design.md`).
- `price-table/`: the price table and its details.
- `record-price/`: the dialog that records a manual price.
- `terms/`: the fixed income terms dialog, section, progress, accrual and maturity.
- `model/`: pure functions and hooks used by two or more folders, with their tests.
