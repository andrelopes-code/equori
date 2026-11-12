# Detail layers

Moves five blocks of reference content out of the page body and into a layer opened on demand. Amends `docs/specs/2026-11-11-instrument-page-design.md` (IP1) and `docs/specs/2026-11-09-return-clarity-design.md` (RC6).

## 1. Diagnosis

Facts read from the code of `web/src/features` on 2026-11-12.

| ID  | Fact                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Five `Collapsible` components hold reference content: `instruments/price-table/price-details.tsx`, `portfolio/return/return-method.tsx`, `calculators/calculator-frame/method-section.tsx`, `reports/indicator-audit/indicator-audit.tsx`, `accounts/connections/connection-syncs.tsx`. |
| F2  | Each panel is a `Stack` of `Table`, `DescriptionList` and `Text`. The panel mounts inside the page flow and has no height limit.                                                                                                                                                        |
| F3  | `PriceTable` renders every row of `prices`. The history request defaults to 7305 days (`history-dialog.tsx`).                                                                                                                                                                           |
| F4  | Only `MethodSection` and `ConnectionSyncs` pass `description` to `CollapsibleTrigger`. The other three closed states state neither the content nor its size.                                                                                                                            |
| F5  | `ReturnMethod` lists the facts (opening, closing, rates) and the flows (date, amount) as separate blocks. No block relates opening, flows and closing.                                                                                                                                  |
| F6  | `MethodSection` writes the formula as lines of `Text`. `IndicatorAudit` keeps the definitions of the indicators in a list apart from the table columns they define.                                                                                                                     |
| F7  | A modal Slotted `Dialog` makes the page inert (`dialog.md`, Accessibility). A reader who compares a table with the cards behind it cannot do so in a modal layer.                                                                                                                       |

## 2. Decisions

| ID   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DL1  | Reference content (every point of a series, an audit, a method, a log) never mounts in the page body. The page draws one summary line and one button that opens the layer. A disclosure of form fields or of assistant activity stays a `Collapsible` and is outside this spec.                                                                                                                                                                                               |
| DL2  | `ui/dialogs/detail-dialog.tsx` is the shared layer: `Dialog` `size="xl"`, a title, a one-sentence description, a body of sections, and one close button in the footer. The body mounts only while the layer is open. The summary line and the trigger button sit side by side in the page.                                                                                                                                                                                    |
| DL3  | `ui/dialogs/detail-section.tsx` is one titled section of a layer body. The drawer of DL8 reuses it.                                                                                                                                                                                                                                                                                                                                                                           |
| DL4  | Prices (replaces the collapsible of IP1; IP12 stays). Summary line: number of points, first and last date, source of the latest point. Layer: a figure strip (points, first date, last date, lowest, highest), a filter by source, then the table with an inner scroll and a fixed header. A negative change is written in the danger tone.                                                                                                                                   |
| DL5  | Return method (replaces the collapsible of RC6; every row of R17 stays). Summary line: closing value, period return, annual rate. Layer, in order: the reconciliation (opening, deposits, withdrawals, result, closing), the two rates with what sets them apart, the groups of `yieldGroups`, the flows grouped by month with a signed amount. The result is `closing - opening - net flows`, computed by a pure function `reconciliation.ts` and not read from the payload. |
| DL6  | Calculator method. Summary line: the `calc.method.description` text. Layer: numbered steps, the formula in its own block with a legend of symbols, assumptions and limits as two separate sections, sources as links. The formula block uses the Slotted `CodeBlock` family when its anatomy fits; otherwise the block is an own element under `build-own-element` and the gap is a Slotted finding.                                                                          |
| DL7  | Indicator audit. The definitions move into the header of the column they define. The glossary section is removed.                                                                                                                                                                                                                                                                                                                                                             |
| DL8  | The indicator audit opens in a non-modal `Drawer` (`side="end"`, `size="lg"`), so the cards of the tab stay visible beside the table. This is a choice of this spec, not an owner decision.                                                                                                                                                                                                                                                                                   |
| DL9  | Connection syncs. The card keeps one line: time and outcome of the last sync, plus the button. The layer is a master-detail: runs on one side, the records of the selected run and the undo of its decisions on the other.                                                                                                                                                                                                                                                    |
| DL10 | A layer reads its data from the query of its page. It adds no request and no field to the API.                                                                                                                                                                                                                                                                                                                                                                                |

## 3. Slices

One vertical slice per commit, in this order. Each slice starts with a failing test.

1. `detail-dialog.tsx`, `detail-section.tsx` and DL4.
2. DL5 with `reconciliation.ts` and its test.
3. DL6.
4. DL7 and DL8.
5. DL9.

Slice 1 measures the open layer of an instrument with 7305 prices on `make run-prod` at 390 px with the CPU throttled 4x. A cost above one frame per interaction opens a Slotted finding for row windowing in `Table`.

## 4. Cross-cutting questions

| ID  | Answer                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Does not apply: no regional value is added. The sources of the calculators stay in the code of their region.                                                                                                        |
| R2  | Does not apply: no behavior differs by region.                                                                                                                                                                      |
| R3  | Does not apply: no value set is added.                                                                                                                                                                              |
| R4  | Does not apply: no extension point is added.                                                                                                                                                                        |
| R5  | Each summary line, section title, filter label and trigger label is a catalog key with pt-BR and en text.                                                                                                           |
| R6  | Counts, dates and rates go through `format.ts` and `numberFormatter`, with the active tag.                                                                                                                          |
| C1  | Does not apply: nothing is stored. The reconciliation sums integer minor units of the report.                                                                                                                       |
| C2  | The reconciliation sums amounts of the report's currency only. A flow in another currency is not added; the section states that it is left out.                                                                     |
| C3  | Amounts stay in the currency of the report. No conversion is added.                                                                                                                                                 |
| C4  | Every amount goes through `useMoneyFormat()`, so privacy mode masks it in the summary line and in the layer.                                                                                                        |
| T1  | Dates are calendar dates of the payload. Grouping flows by month uses the year and month of the date text, with no time-zone conversion.                                                                            |
| T2  | Does not apply: no business-day count and no due date.                                                                                                                                                              |
| B1  | Does not apply: no table is added.                                                                                                                                                                                  |
| B2  | Does not apply: no operation is added.                                                                                                                                                                              |
| B3  | Does not apply: no setting is added.                                                                                                                                                                                |
| D1  | Does not apply: no table is added.                                                                                                                                                                                  |
| D2  | Does not apply: no schema change.                                                                                                                                                                                   |
| D3  | Does not apply: no recorded fact changes. The undo of a sync decision (DL9) keeps its current operation.                                                                                                            |
| D4  | Does not apply: no data is written from a bank, a file or a model.                                                                                                                                                  |
| D5  | Does not apply: no diagnostic field.                                                                                                                                                                                |
| S1  | Does not apply: no operation is added to `api/openapi.yaml`.                                                                                                                                                        |
| S2  | None of `/instruments/$code`, `/portfolio`, `/reports`, the calculators and the links page is a phone route in ADR 027 S3. The slices carry no phone code and are tested at desktop width.                          |
| S3  | The guide article of each topic changes in the same commit as its slice: `investments.md` (slices 1 and 2), `reports.md` (slice 4), `imports_and_bank_connections.md` (slice 5). No article covers the calculators. |
| S4  | Does not apply: the assistant reads no new data.                                                                                                                                                                    |
| X1  | Does not apply: no HTTP behavior and no scenario.                                                                                                                                                                   |
| X2  | Slice 2 has a reconciliation test whose flows hold a currency other than the opening's. No test of this spec depends on a region.                                                                                   |

## 5. Tests

- `portfolio-return.test.tsx`, `return-view.test.tsx`, `indicator-audit.test.tsx` and the tests of the instrument page change their expectations from "open the collapsible" to "open the layer". The commit body names the decision (DL4 to DL9).
- A layer test checks that the body is absent before the button is pressed and present after.
- `reconciliation.test.ts` covers deposits only, withdrawals only, no flows and a flow in another currency.
- Each new file receives one injected defect before the slice is committed; a defect no test catches is reported as uncovered.

## 6. Out of scope

- The four other `Collapsible` uses (`schedule-advanced-section`, `goal-card/goal-parts`, `settings-assistant`, `assistant/message/turn-activity`) are not examined.
- Export of a layer's table.
- A period filter on the price table.
