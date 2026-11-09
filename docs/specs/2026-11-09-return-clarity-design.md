# Return clarity

Redesign of the section "How it performed" of `/portfolio` and of the tab "Yield" of an account page. Amends `docs/specs/2026-11-07-portfolio-clarity-design.md` (PC11, PC12) and `docs/specs/2026-11-06-return-index-comparison-design.md` (R17, the rows "Account page, tab Yield" and "Portfolio, return section"). R5, R8, R9, R12, R18 to R23 and every value the server returns stay as they are.

## Intent

Both screens draw `yieldGroups` through `YieldGroupList`: up to three groups of equal weight (the period, the comparison with the index, the return net of inflation), each a grid of `FigureCard`s over a ruled list. Measured on the fixtures `marketReturn` and `comparedReturn`:

- No line states the answer to "was it worth it". The reader compares figures spread across three groups.
- The word "Return" and the index name repeat in two groups with different bases (the days compared, the whole months of the inflation).
- The money result (the gain) appears nowhere, although `opening`, `closing` and `flows` hold it.
- The method is closed on the portfolio and absent on the account page.

A reader asks, in this order: did it make money, did it beat the index, did it beat inflation. The screens answer in that order, in one sentence, one chart and one money panel, and keep every figure of R17 one action away.

## Decisions and their sources

| ID | Decision | Source |
|---|---|---|
| D1 | One sentence states the answer before any figure. | Owner review of 2026-11-09: the section reads as figures assembled from ready parts. |
| D2 | A comparison is two bars on one axis with the value written at the bar end. Lengths read more precisely than numbers in cards. | `docs/specs/2026-11-07-portfolio-clarity-design.md`, D3. |
| D3 | The money result is derived on the client from `opening`, `closing` and `flows`: `gain = closing - opening - sum(flows)`. A flow is positive when money entered the tree (`internal/portfolio/internal/app/return.go`, `Return`). | The report; no field is added. |
| D4 | A bar needs no color to be read: the value is written on it, the index is solid, the inflation is hatched, and the chip beside each comparison holds an icon and words. | Dataviz rule: identity is never color alone. |
| D5 | The decomposition of the growth into deposits and gain stands on the portfolio only, where deposits are common. The account page states the same rows without the bar. | Owner, 2026-11-09. |

## Rules

**RC1 Order.** The body of both screens reads top to bottom: the verdict (RC2), the comparisons beside the money panel (RC3, RC4), the notes (RC7), the profile sentence of R17, then the details (RC6). Beside means two columns from 760 px of the section's width and one column below it.

**RC2 Verdict.** One `Text size="lg" weight="semibold"` sentence. The subject is "the portfolio" on `/portfolio` and "the account" on an account page. The base is `return_bp` of the benchmark when it holds one, else `period_bp` when R17 keeps it (`periodReturn` of `yield-figures.ts`).

| Report | Sentence |
|---|---|
| `rate`, `percent_bp` and `annual_bp` present | "In the period, {subject} returned {return}: {percent} of the {index} ({annual} a year){real}." |
| `market` with `excess_bp` | "In the period, {subject} returned {return}: {delta} pp above the {index}{real}." Below: "{delta} pp below". At zero: "in line with". |
| a benchmark with neither of the two | "In the period, {subject} returned {return}, against {indexReturn} of the {index}{real}." |
| no benchmark, a period return R17 keeps | "In the period, {subject} returned {return}." |
| no figure R17 keeps | no sentence; the notes of RC7 stand alone, and `/portfolio` keeps its single card of the personal rate. |

`{real}` is present only with `inflation`: ", with a real return of {real} over the {inflationIndex}". `{delta}` is the absolute value of `excess_bp` in percentage points with two decimals. Every number goes through `formatBasisPoints` or `numberFormatter` (one minus sign, web rule "One minus sign").

**RC3 Comparisons.** Up to two blocks, each a heading, its window, a chip and two bars.

| Block | Present when | Bars | Chip |
|---|---|---|---|
| "Against the {index}" | `benchmark.return_bp` is defined | the subject at `return_bp`, the index at `index_bp`, the window `benchmark.from` to `benchmark.until` and `days` | `rate` with `percent_bp`: "{percent} of the {index}" (check icon at 100 or more, down arrow below); `market` with `excess_bp`: the signed pp (up, down or equal arrow); else none |
| "Against inflation" | `inflation` is defined | the subject at `inflation.return_bp`, the inflation at `inflation.index_bp`, the window `inflation.from` to `inflation.until` | "{real_bp} real" with an up arrow above zero and a down arrow below |

The chip tone is `success` above zero, `danger` below, neutral at zero. Both blocks share one axis (RC5). A block draws no title of its own beyond its heading, and the pair of bars has `role="img"` with an `aria-label` that states the two values.

**RC4 Money panel.** Heading "In money". Rows: opening, "Net deposits" (only when `flows` is not empty; the sum of `flows`), "Gain" (`closing - opening - sum(flows)` with a sign), closing. Amounts go through `useMoneyFormat()` with the scale of the currency of the record. The panel is not drawn when `opening`, `closing` and every flow do not share one currency. A negative gain is in the danger tone.

**RC5 Axis.** Both blocks use one domain, chosen by `comparisonAxis(values)`: the step is the smallest of `1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 300, 400, 500, 600, 800, 1000` percent for which `up + down <= 3`, where `up = ceil(1.25 * peak / step)` and `down = ceil(1.25 * trough / step)` (each zero when its side is empty; `up = 1` when every value is zero). The domain runs from `-down * step` to `up * step`. A negative bar extends left of the zero line from it. The ticks are the multiples of the step and are written under the last block. The 1.25 margin leaves room for the value written at the bar end.

**RC6 Details.** A `Collapsible` "Details and method", closed by default, holds in order: the groups of `yieldGroups` as ruled lists (every row of R17 stays), then the content of the former `ReturnMethod` (opening, closing, time-weighted return, personal rate, the sentence on the difference, the flows). Account pages gain the method. `ReturnMethod` and the groups share one `Collapsible`.

**RC7 Notes.** `yieldNotes` stand under the comparisons as `Text size="sm" tone="muted"` on both screens (R23, R19). `/portfolio` gains them.

**RC8 Bar element.** The bars are an element of the app's own (CP-04): the `chart` family draws one fill per series and no signed domain shared across two blocks. It carries the comment of the build-own-element skill and cites the Slotted issue opened for the need (web rule "Slotted workarounds"). Paint comes from tokens: the subject `--slotted-tone-accent-solid`, the index `--slotted-text-muted`, the inflation `--slotted-text-muted` with a 135 degree hatch. The element reads in forced colors through `forced-colors` system colors.

**RC9 Growth bar.** On `/portfolio` only, under the money rows, when the net deposits and the gain are both above zero: one bar split in two segments proportional to the two values, a legend naming each with its amount, no axis. In every other case no bar is drawn.

**RC10 Phone.** `/portfolio` stays desktop-only (ADR 027). On an account page below 600 px the section stays between the figures and the chart (R17, placement) and every region stacks in one column. At 390 px the page holds no horizontal scroll.

**RC11 States.** Loading keeps the skeleton of the section. A `return_undefined` problem and the other problems keep their present screens. The verdict never draws while the report loads.

## Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | No regional value is added. The index and the inflation index come from the report (`benchmark.index`, `inflation.index`), the words from the catalog. |
| R2 | A region without an index has no `benchmark`: the sentence "In the period, {subject} returned {return}." and the reason of R23 stand. |
| R3 | Does not apply: no value set stored in SQL or the API. |
| R4 | Does not apply: no extension point. |
| R5 | The keys `return.verdict.*`, `return.subject.*`, `return.against.*`, `return.money.*` and `return.details`, each with `en` and `pt-BR` text. The plan lists the exact text. |
| R6 | Every percent through `formatBasisPoints`, every date through `formatDate`, every amount through `useMoneyFormat()`; all follow the active tag. |
| C1 | The gain is computed on the client in minor units of the report's currency by integer arithmetic. No `float64` amount. |
| C2 | A sum holds one currency; a report whose amounts differ in currency draws no money panel (RC4). |
| C3 | The report is already in the valuation currency (`value_in`); the screen reads the currency from the record. |
| C4 | The currency comes from the report's `Money`. Every amount goes through `useMoneyFormat()`, so privacy mode hides it. |
| T1 | Every date comes from the report. "Today" stays `useToday()` for the account window. |
| T2 | Does not apply: no business-day count on the screen. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | Does not apply: no setting. |
| D1 to D5 | Does not apply: no table, schema, fact, ingestion or diagnostic field. |
| S1 | Does not apply: no operation. |
| S2 | The account page serves the phone (RC10). `/portfolio` is desktop-only (ADR 027). |
| S3 | The guide articles of the topics "portfolio" and "accounts" describe the sentence, the bars and the money panel (plan, task 5). |
| S4 | Does not apply: the assistant reads the report through its own tool. |
| X1 | Does not apply: no HTTP behavior and no scenario. The web tests carry A208 R17 and PC10 to PC12. |
| X2 | The tests of the verdict and the money panel run under `en` and `pt-BR` with a currency other than BRL and a base currency other than the account's. |

## Tests

- `return-axis.test.ts`: the table of RC5.
- `return-money.test.ts`: the gain, the net deposits and the one-currency guard of RC4.
- `return-summary.test.ts`: each row of the table of RC2 and each block of RC3, under `en` and `pt-BR`.
- `return-bars.test.tsx`, `return-money-panel.test.tsx`: the elements of RC3, RC4, RC8 and RC9.
- `portfolio-return.test.tsx`, `account-tabs.test.tsx`: A208 R17 and PC10 to PC12 through the screens, with the changed expectations named in the commit body.

## Non-goals

- A line of the value over time: the report holds no series.
- A target or a benchmark chosen by the user.
- A change of the report or of any server rule.
