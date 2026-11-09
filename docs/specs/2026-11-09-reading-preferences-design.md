# Reading preferences for amounts, privacy, book colour, motion and charts

## Intent

The appearance studio (`2026-10-29-appearance-studio-design.md`) controls colour, surfaces, shape and text. It does not yet control how amounts read, when amounts hide on their own, which book is active at a glance, how a screen change moves, or a chart palette that keeps series apart for a reader with protanopia or deuteranopia. This design adds those controls and unifies the colour of a signed amount across screens.

## Goals

- One rule decides the colour of a signed amount on every screen, with a reader preference to turn colour off.
- Summary figures can drop minor units or use the compact notation of the active language tag.
- Privacy mode can turn on by itself when the tab is left or the reader is idle.
- Each book of a member can carry its own accent, so the active book is recognised without reading its name.
- A change of page cross-fades the main region.
- A chart palette that keeps adjacent series distinguishable under protanopia and deuteranopia.
- The browser tab icon takes the accent in force.
- Every amount drawn as `Text` outside a family that sets tabular figures takes tabular figures.

## Non-goals

- Revealing one amount on hover or press while privacy mode is on. It breaks ADR 018 O9 and needs a pointer.
- Animating a figure when its value changes. Slotted issue #84 asks for it in `StatCard`; equori carries no own version.
- Tinting the installed application's icons. They are PNG files declared in `manifest.json` and do not change at run time.
- A book accent shared by every member of a book. That needs a column, a migration, an operation and an ADR.
- Slashed zero. None of the five bundled faces (Geist, Geist Mono, Inter, Source Sans 3, Nunito) carries the OpenType `zero` feature.
- Chart textures (`Chart` prop `texture`).

## Anti-goals

- A colour that reveals what the privacy mask hides. `privacy/mask.ts` drops the sign because direction is information; a tone that tells money in from money out defeats it.
- Money out drawn in the danger tone. Spending is the normal case; `danger` names a problem.
- A summary format that reaches a table or a ledger row. Slotted LG-01 requires the change at the unit's own precision there.

## Rules

| ID | Rule |
|---|---|
| RP1 | `amountTone(kind, direction, mode, hidden)` in `web/src/ui/amount-tone.ts` returns the tone of a signed amount. `kind` is `flow` (money that moved: a transaction, an entry, a statement line, an income or expense total) or `result` (a figure judged good or bad: a gain or loss, a return, a net result). `direction` is `in`, `out` or `none`. With `mode` `colour`: `flow` in → `success`, `flow` out → the text's own ink, `result` in → `success`, `result` out → `danger`, `none` → the text's own ink. With `mode` `sign`, or with `hidden` true, every amount takes the text's own ink. A hook `useAmountTone()` reads `mode` and `hidden` and returns `(kind, direction) => tone`. |
| RP2 | The preference `amountTone` (`colour`, `sign`; default `colour`) is stored under `equori.amountTone`, belongs to `appearanceNames` and is outside every theme (A1). |
| RP3 | Each call site of RP4 replaces its own sign rule with `useAmountTone()`. The written sign stays in both modes (Slotted LG-01: the tone is a second signal beside the sign). |
| RP4 | Call sites, found by searching `tone=` beside an amount in `web/src`: `features/transactions/amount-cell.tsx` (flow, direction from the sign; a transfer is `none`; a voided row keeps `muted`); `features/reports/entry-table.tsx:78` (flow, direction from the sign: money out leaves `danger`); `features/reports/entry-totals.tsx` (income and expense are flow, the net result is result); `features/cards/statement-lines.tsx` with `features/cards/line-amount.ts` (flow, direction from `card_role`: `charge` is out, every other role is in); `features/portfolio/holding-gain-cell.tsx`, `features/portfolio/sales-table.tsx`, `features/portfolio/account-yield.tsx`, `features/portfolio/yield-group-list.tsx` (result). A threshold tone (an overspent budget, a reimbursement leftover) is not a sign tone and stays as it is. |
| RP5 | The preference `summaryAmounts` (`full`, `whole`, `compact`; default `full`) is stored under `equori.summaryAmounts`, belongs to `appearanceNames` and is outside every theme. `MoneyFormat` gains `summary(m, scale): MoneySegment[]`. `full` returns `segments`. `whole` formats with `maximumFractionDigits: 0`. `compact` formats with `notation: "compact"`; the compact suffix is a segment of its own kind and is drawn in the unit part. All three go through `Intl` with the active tag (O10). With privacy on, `summary` returns the masked segments of `segments`. |
| RP6 | `ui/money-value.tsx` draws `fmt.summary`. `MoneyValue` is the only consumer, so `ui/figure-card.tsx` and its 21 consumers follow. No table, list, field or chart reads `summary`. |
| RP7 | The preference `privacyAuto` (`never`, `leave`, `idle`; default `never`) is stored under `equori.privacyAuto`, per browser, beside `equori.privacy` (ADR 018 P1). It is not in `appearanceNames`. `leave` turns privacy on when `document.visibilityState` becomes `hidden`. `idle` turns privacy on after 5 minutes without `pointerdown`, `keydown`, `wheel` or `touchstart` on the document. Turning on goes through `setHidden(true)`, so other tabs follow through the `storage` event. Only the reader turns privacy off, with the existing switch. |
| RP8 | The control of RP7 is a radio group in `features/setup/settings-privacy.tsx`, under the existing switch. |
| RP9 | The preference `bookAccents` is stored under `equori.bookAccents` as a JSON object from book ID (decimal string) to an accent value valid under `accent.ts`, and belongs to `appearanceNames`. A book without an entry uses the accent in force. On write, entries of books outside the member's memberships are dropped. A malformed value reads as `{}`. |
| RP10 | The ID of the active book is stored under `equori.activeBooks` when the books query resolves, and before the reload that `useSwitchBooks` triggers. `main.tsx` applies the book's accent at boot from that ID, so a reload never paints the accent of another book first. |
| RP11 | The effective accent is `bookAccents[activeBooks]` when present, else `accent`. On the route `/appearance` the effective accent is `accent`, so the studio draws what it edits. A theme never holds `bookAccents`; the active theme (A4) compares `accent`. |
| RP12 | The studio's Colour tab gains a section "Book colour" when the member belongs to two or more books: one row per book with its name and a choice between "Theme accent" (no entry) and the accent swatches and picker of A18. |
| RP13 | The router sets `defaultViewTransition: { types: (info) => (info.pathChanged ? ["page"] : false) }`. A change of search params alone does not transition. The main region carries `view-transition-name: main`. The shell has no transition name and does not move. The cross-fade of `main` lasts `--slotted-duration-medium`, which motion `reduced` sets to 1 ms and `prefers-reduced-motion` sets to the theme's reduced value. A browser without `document.startViewTransition` navigates without a transition. |
| RP14 | The surface value `chart` gains `distinct`. `equori.theme.ts` replaces Slotted's data scale with eight hues at one lightness per scheme, and every current `chart` value overrides the series again from the accent, so none of them carries Slotted's measurement. `distinct` writes, per scheme `dark` and `light`, the derivations of `--slotted-data-1` to `--slotted-data-8` from `defaultTheme.recipe.<scheme>` (`@slotted/themes/default`): accent-seeded, with alternating lightness. Slotted documents that scale as measured: adjacent slots separate by at least ΔE 16.8 under simulated protanopia and deuteranopia in every scheme, and each slot clears 3:1 against every surface (`sparkline.md`). A16 and the import of A6 accept `distinct`. A15 conformance passes with it. |
| RP15 | The `<link rel="icon">` takes an SVG built from `public/icon.svg` whose white fill is the effective accent's hex (RP11). The stroke is unchanged. It is rewritten whenever the effective accent changes. |
| RP16 | Each `Text` that draws an amount outside a Table, DataGrid, DataList or StatCard carries `numeric="tabular"`. A search for `<Text` blocks that call `fmt.money`, `fmt.signed` or `fmt.number` without `numeric` finds 23. The ones inside a table cell already take tabular figures from the family and need no change. |

## Texts

New catalog keys, with pt-BR and en text: the label and the two choices of RP2; the label and the three choices of RP5; the label and the three choices of RP7; the section title of RP12, its row label and "Theme accent"; the label of `distinct` in the chart choice.

## Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | The compact suffix and the grouping come from `Intl` with the active tag (RP5). No regional literal. |
| R2 | A tag without compact data falls back to `Intl`'s own output for that tag. |
| R3 | Does not apply: no value set stored in SQL or the API. |
| R4 | Does not apply: no extension point. |
| R5 | The keys listed under Texts. |
| R6 | Summary amounts through `Intl` (RP5). No date. |
| C1 | Does not apply: nothing is stored or computed; only the display of existing amounts changes. |
| C2 | Does not apply: no sum or comparison. |
| C3 | Does not apply: an amount keeps its own currency in every mode. |
| C4 | Every mode goes through `useMoneyFormat()` and is masked under privacy (RP5). The tone is neutral under privacy (RP1). |
| T1 | Does not apply: no date. The idle delay of RP7 is a wall-clock timer in the browser, outside `platform/clock`. |
| T2 | Does not apply. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | Member level, synced through `/me/appearance` (ADR 029 BK21): `amountTone`, `summaryAmounts`, `bookAccents`, `chart`. Browser level: `privacyAuto` and `activeBooks`. |
| D1 to D5 | Does not apply: no table, schema, fact, ingestion or diagnostic field. |
| S1 | Does not apply: no operation. |
| S2 | The studio and settings already serve the phone (A7). Every control of this design appears there. RP13 applies on the phone. |
| S3 | `privacy_and_the_assistant.md` gains the automatic modes of RP7. `settings_language_and_region.md` gains the amount colour, the summary format and the book colour. |
| S4 | Does not apply: appearance values are not book data. |
| X1 | Does not apply: no HTTP behaviour. |
| X2 | The test of RP5 runs under `en` and `pt-BR` tags with a currency other than the book's base currency. |

## Tests

- `amount-tone.test.ts`: every combination of kind, direction, mode and hidden of RP1.
- One test per call site of RP4, asserting the tone of a money-in and a money-out amount, and the text's own ink with privacy on.
- `use-money-format.test.tsx`: `summary` in each mode of RP5, under two tags, and masked with privacy on.
- `privacy-provider.test.tsx`: each mode of RP7 with a fake timer and a dispatched `visibilitychange`; `never` leaves privacy off.
- `accent.test.ts`: the effective accent of RP11 with and without an entry, on `/appearance` and elsewhere; the boot read of RP10; malformed `bookAccents` reads as `{}`.
- `surface-recipe.theme.test.ts`: A15 conformance with `distinct`; the eight `--slotted-data-*` derivations of `distinct` equal those of `defaultTheme.recipe` per scheme.
- A test that the icon link's SVG carries the effective accent hex after an accent change (RP15).
- A test of the `types` function of RP13: `["page"]` for a path change, `false` for a search change.

## Left to the builder

- The order of the new controls inside the studio's Text tab (RP2, RP5).
- The prop or wrapper that carries `view-transition-name` on the main region.
- Whether `amountTone` returns Slotted's `inherit` or `default` for the text's own ink, per family.
