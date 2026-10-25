# Transaction detail: attachments, investment and foreign currency facts

Scope: item 1 of `docs/web-roadmap.md`. Web only; no change to `api/openapi.yaml`, CSP or `Content-Disposition`.

## Slice 1: `feat(web): show trade, income and foreign currency facts on a transaction`

- `trade-facts.tsx` in the facts aside: side, instrument link (`/instruments/$code`), quantity, unit price, gross, fees, taxes, cost (sell only), security and cash account links.
- `income-facts.tsx` in the facts aside: income type (`income.type.<code>`, raw code fallback), gross, withheld, net, account links.
- `postings-table.tsx`: original amount beside the booked amount and the implied rate (`ratioText`) for a posting with `original`.
- Catalog keys `transaction.facts.*` in both catalogs.
- Privacy mode masks amounts and the original; rate, quantity and metadata stay visible.
- Region value: none introduced; formats come from `tagOf`/`Intl`, currencies and income types from the record.

## Slice 2: `feat(web): preview the attachments of a transaction`

- Attachment list as a grid (2 columns on phone) with name, size (`Intl` unit), upload date and time.
- Thumbnail: `image/*` uses the content URL with lazy loading; other types use the family kind tile.
- Image viewer dialog: zoom (buttons, wheel, keyboard), download link, previous and next, arrow keys, Escape with focus return, swipe on phone width.
- PDF and other types: download action only (CSP forbids inline PDF; ADR 007).
- `docs/web-roadmap.md`: item 1 Delivered in section and Summary, PDF preview note with snapshot date and commit.

## Verification

`pnpm vitest run` on changed files, `pnpm typecheck`, `make web-check` after slice 2, Playwright smoke at 1280 and 390 px.
