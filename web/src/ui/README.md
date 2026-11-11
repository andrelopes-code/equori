# Shared UI

Components, hooks and pure functions used by two or more features. Each folder holds one kind of element. A component, its styles, its test and the pure functions only it uses stay together.

Import with the alias, for example `@/ui/money/money-input`. A folder has no `index.ts`.

| Folder         | Holds                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `money/`       | Amount entry, display, tone, units, rates and priced values (`MoneyInput`, `MoneyValue`, `MoneyFigure`, `PricedValue`, `RateInput`) |
| `form-fields/` | Single controls of a form: choice cards, select, swatches, date input, date shortcuts, field title, phone fields                    |
| `form-layout/` | Form structure: layout, row, section, checks and `FormNotice`                                                                       |
| `dialogs/`     | `ConfirmDialog`, `Presence` and the overlay-open context                                                                            |
| `feedback/`    | Query error, refresh button and hook, bulk outcome notice and its pure rules                                                        |
| `display/`     | Figures, avatars, brand mark, instrument name, QR code and `withValue`                                                              |
| `navigation/`  | Links, back button, header actions, speed dial, month and period controls, `useServed`                                              |
| `runtime/`     | Browser hooks and helpers: debounce, media query, stable callback, copy text, new id                                                |
