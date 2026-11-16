# Assistant settings pane: redesign

Status: mock approved by the owner on 2026-11-16 (skill `redesign-ui-section`). The approved mock is
the contract (`docs/contributing/web.md`, "Assistant conversation"): the code draws every element,
state and measure below.

Scope: the pane `assistant` of `/settings` (`web/src/features/setup/assistant`,
`web/src/features/setup/usage`). No change to the API, the schema or the Go code.

## Diagnosis of the previous pane

- The notice "free tier uses data" appeared once in the alert, once per provider row and once per
  use row; "sends financial data" appeared on every use.
- Today's figures of a model appeared twice: in a sentence and in the meters.
- The chain of a use was one sentence that repeated the provider name before every model.
- The chain dialog of a use on its default chain showed "no model".
- At 390 px the provider row broke its name into one character per line.
- The capability select of the chain dialog drew its summary under its tags (Slotted issue #127).

## Questions of the reader

1. Does the assistant answer, and with which model?
2. Where does the data go?
3. In which order does each function try the models?

Usage against the limits serves an audit: it is reachable and starts closed.

## Rules

| ID | Rule |
|---|---|
| A1 | The pane draws, in this order: the status, the providers, the functions, the usage. The block "Advanced" is removed: the functions are always visible and only the usage folds. |
| A2 | Status: one sentence, "The assistant answers with `<model>`", the model in the monospace font and the accent text tone, at the `3xl` step (`2xl` below 600 px). Under it, one line at `sm`: the provider of that model, then, in the warning text tone, the sentence that a provider trains on submitted content, when a use that sends financial data has such a target. No icon, no alert box. Without an answering model the sentence is "The assistant does not answer yet". |
| A3 | Answering model of a use (client derivation): the first target of its chain that offers every capability the use needs and whose usage row is neither `reached` nor `cooling` (`usageStatus`). The status reads the use `assistant.chat`. |
| A4 | Provider row, 56 px (60 px on a phone): a 32 px tile with the first letter of the name; the name over "preset · key state"; the notice of the provider in words, in the warning text tone when it trains; "Edit" and the menu. A phone keeps the tile, the name over the preset and the menu. A provider of the instance has no action. No tag. |
| A5 | Function row, 80 px (88 px on a phone): the name and, end-aligned on the same line, one note; under them the route. The button "Edit order" stands at the end, centred on the row. |
| A6 | Note of a function, the first that applies: a target that lacks a needed capability, in the danger text tone ("`<model>` does not offer `<capabilities>`"); a target that is paused or over its limit ("`<model>` paused until `<time>`", "`<model>` reached its limit"); "Custom order"; "Default order". A phone draws no note. |
| A7 | Route: one stop per target in chain order, joined by a 1 px link. A stop is a pill of 26 px with its position in a 20 px circle and the model in the monospace font. The answering stop takes the accent surface and a solid accent circle; a target that lacks a capability is struck through; a paused target takes the muted text. The route has one accessible name that lists the targets and the answering model. A phone draws the first stop and "+N". A use with no target writes "No provider serves this function". |
| A8 | Usage: a card that starts closed. Its closed line holds "Usage and limits" and, end-aligned, today's requests, the count of paused models in the danger text tone and the count of models near a limit in the warning text tone; a count of zero is not written. Open, it holds one row of 56 px per provider and model under column heads: model over provider and today's errors; today's requests and today's tokens, each end-aligned over a 4 px meter when a limit is declared and with no track when none is; the state in words; "Limits". A phone row is 68 px: model and state, then the request meter with its value. Below the rows stand the figures of the period and the chart, unchanged. |
| A9 | Chain dialog: the title "Order of `<use>`" and the sentence with the needed capabilities. The list shows the targets the use runs, also on a default chain. An item is 52 px (60 px on a phone): its position, the model in the monospace font over the provider and its condition (a missing capability in the danger text tone, a pause), then "up", "down" and "remove" as icon buttons; a phone holds one menu with the three actions. |
| A10 | Adding a target: the provider select, the model as a combobox that lists the models of the provider (the preset's suggestions and, when the provider answers, the models it lists) and accepts any other text, and the button "Add". Under them, the capabilities as a group of three checkboxes with the legend "What this model offers". No multiple select. |
| A11 | Saving a chain equal to the default chain of an untouched default use sends nothing changed: "Save" on a default use the reader did not edit closes the dialog; "Restore default" sends the empty list. |
| A12 | No text of a row, an item or a card head wraps; a text that does not fit is shortened by the design at that width, then truncated with an ellipsis. No triangular warning icon. |
| A13 | Loading draws the status, two cards and the closed usage line in the shape of the content. A failed read is one `FormNotice` above the content, as before. |

## Client derivations and their tests

- A3 and A6: `assistant/use-answer.ts`, tested with hand-written chains and usage rows.
- A8 summary: `usage/usage-summary.ts`, tested with hand-written rows.

## Cross-cutting questions

- R1: Does not apply: the pane holds no value that varies by country.
- R2: Does not apply: no regional behaviour.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: New catalog keys in `catalog.en.ts` and `catalog.pt-BR.ts` for the status, the notes, the usage summary, the column heads and the dialog.
- R6: Request and token counts through `numberFormatter`; the pause time through `Intl.DateTimeFormat` of the active tag.
- C1: Does not apply: no amount.
- C2: Does not apply: no amount.
- C3: Does not apply: no amount.
- C4: Does not apply: no amount.
- T1: "Now" for a pause is the time the usage query answered, as before.
- T2: Does not apply: no business day.
- B1: Does not apply: no table.
- B2: Does not apply: no operation.
- B3: Does not apply: no setting.
- D1: Does not apply: no table.
- D2: Does not apply: no schema change.
- D3: Does not apply: no recorded fact.
- D4: Does not apply: no written data.
- D5: Does not apply: no diagnostic field.
- S1: Does not apply: no operation.
- S2: `/settings` is a phone route (ADR 027, S3): every rule above states its phone form.
- S3: The operations of the reader are unchanged (add, edit, check, list models, delete, order, limits); the guide article needs no change.
- S4: Does not apply.
- X1: Does not apply: no scenario.
- X2: The existing test that words the pane in English for another region and base currency stays.

## Tests that change

`settings-assistant.test.tsx`: the cases of the block "Advanced" (removed by A1), of the tags per use
(replaced by A2, A6, A7) and of the meters (moved into the folded usage by A8) are rewritten to the
rules above. No other test changes.
