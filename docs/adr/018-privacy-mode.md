# ADR 018: Privacy mode

- Status: accepted
- Date: 2026-10-22

## Context

A finance application is opened in places where others can see the screen. People expect one switch that hides balances and amounts everywhere, as other finance applications offer. Amounts reach the interface through about 60 files, as text in cells, as sentences, as chart labels and as accessible names. A blur applied by CSS to marked elements covers only the elements someone marked, leaves the real value in the DOM, and misses text built in code.

## Decision

| ID  | Rule                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | The preference lives in `PrivacyProvider` (`web/src/privacy`), per browser, under `localStorage` key `equori.privacy` (value `hidden`). The first render reads it, so a reload never paints an amount first. A `storage` event keeps other tabs in step.           |
| P2  | Masking happens where text is built. `useMoneyFormat()` wraps `formatMoney`, `formatMoneyParts`, `formatSigned` and `formatPlain`. While privacy is on, it returns the currency symbol and `••••`: no sign, no digit count. The real amount never reaches the DOM. |
| P3  | A component outside `PrivacyProvider` reads `hidden`, so a missing provider shows masks and is seen at once.                                                                                                                                                       |
| P4  | `MoneyFormat.entry()` is never masked. Only a field the person types into reads it (`ui/money-input`).                                                                                                                                                             |
| P5  | O9 (`web/CLAUDE.md`) forbids importing the four formatters outside `src/i18n`, `src/privacy`, `src/testing` and tests. A use that is not an amount to read carries a `no-restricted-imports` disable comment with its reason.                                      |
| P6  | Every screen with amounts has a test that renders it hidden and calls `expectNoAmounts` (`web/src/testing/privacy.ts`). The helper reads the markup, attributes included, and fails on a known amount string or on any text shaped like a formatted amount.        |
| P7  | The switch is the `PrivacyToggle` in the phone's top app bar, a checkbox item in the account menu and an action in the command palette.                                                                                                                            |

## Consequences

- A new screen that formats an amount compiles only through `useMoneyFormat()`. A plain function that formats receives the `MoneyFormat` as an argument.
- A memoised column, word list or chart option that calls the format lists it in its dependencies; the identity of the object changes only with the locale and with `hidden`.
- Chart shapes stay: the relative size of bars and lines remains visible. Axis labels, tooltips and accessible names are masked.
- The admin operation console shows raw request and response JSON and is not masked.
- Percentages, counts and dates are not masked.

## Revisit criterion

A screen shows an amount while privacy is on, or a use of the formatters needs a fifth disable comment.
