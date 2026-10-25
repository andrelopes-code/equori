# Foreign purchase and currency exchange entry

Source: `docs/web-roadmap.md` item 2. Scenarios: S16, S17. Contract: `recordForeignPurchase`, `exchangeCurrency`, `getStatementPlacement`, `listPrices`.

## Slice 1: `feat(web): record a foreign purchase`
- `foreign-math.ts`: half-even conversion and charge on BigInt, tested against S16 (100.00 USD at 5.4830, 350 bp: 548.30 and 19.19).
- `foreign-draft.ts`, `use-foreign-entry.ts`, `foreign-form.tsx`: card (base currency only), date, payee, description, category, original amount and currency, rate, charge bp and category, statement.
- Currencies: instruments of type `currency` other than the base, plus a free ISO 4217 code.
- Suggested rate: stored price of the currency in the base currency on the date, with its source; empty with a notice when absent.
- Live result: converted amount, charge, total; statement preview from `getStatementPlacement`.
- Kind `foreign_purchase` in the picker, the `kind` search parameter and the card page action.
- Catalog keys `foreignPurchase.*` in both catalogs.

## Slice 2: `feat(web): record a currency exchange`
- `exchange-draft.ts`, `use-exchange-entry.ts`, `exchange-form.tsx`: from and to accounts, date, description, amounts, optional fee with category.
- Destination restricted so one of the two currencies is the base.
- Live result: effective rate in both directions, total debited with the fee, difference against the stored price of the date.
- Kind `exchange` in the picker and the account page action for a foreign-currency account.
- Catalog keys `exchange.*`.
- `docs/web-roadmap.md`: item 2 Delivered in the section and the Summary table; snapshot line.

## Region
Charge rate comes from the card (`foreign_charge_bp`), base currency and currency list from the API, formats from `Intl` with `tagOf`. A neutral region test (`en`, EUR base, charge 0) covers both forms.
