# Assistant answer views

- Date: 2026-11-19
- Status: approved by the owner on 2026-11-19 (concept A of the mock; "gostei! apenas garanta que vai estar tudo com acabamento impecavel"; "pode seguir")
- Mock (contract): `docs/specs/2026-11-19-assistant-answer-views-design-mock/` (`design.html`, `design.css`, `mock.json`, `shots/approved-*.png`; `gen.mjs` writes `design.html`)
- Amends: `internal/assistant/app/guide.tmpl` (rule "no other table … no charts"); `docs/contributing/web.md`, "Assistant conversation" (table "A form per kind")
- Web feature: `assistant`

## 1. Intent

An answer of the assistant shows the data in the form of what it represents: a ranking as ordered bars, a balance as a step line, a statement split as a segmented bar, a write as the change it makes. Today the client infers three forms (compare, ranking, series) from the shape of a Markdown table, the prompt forbids charts, and eight write actions fall back to a list of fields.

## 2. Evidence

| Fact | Source |
|---|---|
| The prompt allows one Markdown table and forbids headings, code blocks and charts. | `internal/assistant/app/guide.tmpl:50` |
| The client turns a table into a block only with 2 columns, one currency marker, values ≥ 0 and 2 or more rows. | `web/src/features/assistant/message/answer-blocks.ts` |
| Figures written by the model are text the model typed; rule "Honest values" requires every figure to come from the API or a named client derivation. | `docs/contributing/web.md`, "Assistant conversation" |
| History sends the model only the text of earlier turns; tool outputs live only inside the turn. | `internal/assistant/llmapi/turn.go` (`run`) |
| A write tool stores a proposal with a server-built preview and the turn collects its ID (`turnState`). | `internal/assistant/app/proposal.go` (`Propose`), `app/turn_state.go` |
| Ten body kinds exist; any other action draws "fields". | `web/src/features/assistant/proposal/bodies/body-kind.ts` |
| A tool call carries an ID, a name and arguments. | `internal/platform/llm/message.go` (`ToolCall`) |

## 3. Approaches

| Approach | Fails on |
|---|---|
| A. No change | The forms stay three; the eight fallback writes keep raw keys. |
| B. More client heuristics over Markdown tables (mock concept C) | Each form is a guess over model-typed text; numbers are not honest; no interaction. |
| C. A `view` argument on every read tool | Every read schema grows; `TestToolCatalog` size ceiling; the model picks a form before it sees the data. |
| D. A presentation tool `show` that names an earlier read of the turn and a form; the server builds the view from that read's stored output (chosen) | One extra tool step per answer with a view; MCP clients do not get views. |

Confidence: medium-high. Invalidated if an owner-run eval shows the cheapest model of the chat chain missing the source or the form in more than 10% of answers; fallback: approach C limited to the five most used forms.

## 4. Rules

### Source and tool

- V1. Every read tool output the chat receives is a JSON object with one added field `view_source`, a handle `r1`, `r2`, … in call order within the turn. The turn keeps the raw output under its handle: at most 24 handles, 256 KiB each; a larger output gets no handle. MCP outputs do not change.
- V2. The assistant module declares the read tool `show` (chat only, not in MCP): `{source: "rN", form: <form id>, select?: {limit?: 1-12, highlight?: string}, next?: [string ≤ 60 runes] ≤ 3}`. The output is `{"view": "<id>"}` or a tool error naming the forms the source allows.
- V3. A registry maps `(source tool, form)` to one builder. A pair outside the registry is a tool error. The description of `show` lists the forms of each source tool, generated from the registry.
- V4. A builder is a pure function `func(output json.RawMessage, sel Select, today time.Time) (View, error)` in the module that owns the source tool (`<module>/toolapi/view_<form>.go`), with a table test whose expected values are derived by hand from the input.
- V5. One answer holds at most 3 views. A fourth `show` call is a tool error.

### View

- V6. A view is `{id, form, title: {key, params}, window: {from?, to?, at?, label_key?}, verdict: {key, params}, prov: {key, params}, open?: {screen, params}, next[], data}`. `data` has one schema per form (`AssistantViewData`, `oneOf` with discriminator `form`).
- V7. Amounts in `data` and in params are integers of minor units with a currency code. Percentages are basis points. Dates are calendar dates. The client formats every one (O9, O10); no view carries a formatted figure.
- V8. The verdict and provenance are catalog keys with typed params, chosen by the builder from the data. The text of the answer states what the view does not; the prompt forbids repeating the view's figures.
- V9. A view is stored in `assistant_view` when its turn stores the answer, linked to the assistant message, and returned in `AssistantMessage.views[]` in creation order. The stream event `answer` carries them.
- V10. A view is a snapshot of the read: reopening the conversation shows the figures as built, with its window.

### Client

- V11. One component `AnswerView` draws the anatomy of the mock for every form: kind glyph, title, window, optional R$ / % toggle, verdict, body, provenance line, footer (screen link, chart/table switch, copy) and the follow-up chips. A form only supplies its body and its table rows.
- V12. A form is one entry in `web/src/features/assistant/view/forms.ts`: `{form, icon, unit?: boolean, Body, rows, copy}`. A form the client does not know draws the table rows only (`rows` of the generic `data.rows` every builder also fills).
- V13. Every mark with a value answers hover and keyboard focus with a tooltip that stays inside the view; a chart with several values per column uses the readout line above the plot. A row that opens a record is a link; a row that opens its parts is a toggle.
- V14. A chip sends its text as the next message. The copy action writes the verdict, the window and the table rows as plain text.
- V15. Markdown tables of messages stored before this change keep the current blocks (`answer-blocks.ts`).

### Writes

- V16. The preview gains `effects[]`: `{kind: balance | budget | position | projection | statement, subject, before, after, currency}`, computed by the preview function of the module that owns the write. A body draws its effects as before → after rows.
- V17. Each write body of the mock has one body kind; `body-kind.ts` gains: `install`, `change`, `reconcile`, `goal`, `budget`, `fixed_income`, `custody`, `split`, `transfer`, `attach`, `refund`, `card_face`, `brokerage_note`, `corporate_action`, `contribution_plan`. Existing kinds take the mock's form.
- V18. An outcome replaces its sheet in one line: applied (Abrir, Desfazer when the module undoes), partial (count applied of marked), rejected, expired (Propor de novo), failed (the reason in the danger tone).

### Forms

| Form | Source tool | Body |
|---|---|---|
| `figure` | `get_balances` | value, 30-day sparkline, parts |
| `indicators` | `get_financial_indicators` | three tiles with 12-month sparklines |
| `fx` | `get_balances` | rows per currency, rate, converted total |
| `balance` | `project_balance`, `get_account_history` | step line, projection, lowest point |
| `ranking` | `get_category_totals` | ordered bars, R$ / %, rows that open on payees |
| `compare` | `get_category_totals` (two periods) | paired bars |
| `changes` | `get_category_totals` (two periods) | diverging bars of the difference |
| `treemap` | `get_category_totals` | squarified areas, "Outras" last |
| `series` | `get_category_totals` (months) | columns, average, partial month hatched |
| `heat` | `get_category_totals` (days, new) | calendar of the month |
| `waterfall` | `get_financial_indicators` | start, flows, end |
| `txs` | `search_transactions` | rows with day, total and average |
| `outliers` | `search_transactions` | strip plot in multiples of the category median |
| `transaction` | `get_transaction` | header, postings, history, attachment |
| `explain` | `explain_categorization` | description → rule → category |
| `recurring` | `find_recurring` | 12-month cadence per charge, cost per year |
| `statement` | `get_statement` | segmented bar with shares |
| `commitments` | `get_statement_analytics` | stacked columns of the next statements |
| `agenda` | `list_schedules`, `project_balance` | events grouped by week |
| `budget` | `get_budgets_and_goals` | bars, limit tick, pace mark, excess |
| `goal` | `get_budgets_and_goals` | saved, needed and current-pace paths |
| `holdings` | `get_portfolio` | sortable table with weight |
| `price` | `get_market_data`, `get_holding_lots` | close line, average cost, buys |
| `benchmark` | `get_portfolio` | portfolio and index, base 100 |
| `allocation` | `get_portfolio` | diverging bars against target |
| `contribution` | `get_portfolio` | pairs now / after with target |
| `redemption` | `estimate_redemption` | statement of amounts, tax brackets by days |
| `institution` | `get_institution_indicators` | bullets against the regulatory limit |
| `calculation` | `open_calculator` | inputs, gross and net paths |
| `tax_year` | `get_tax_year` | monthly sales against the exemption, tax payments |
| `coverage` | `get_imports` | covered days per account, gaps |
| `help` | `get_help` | numbered steps |

## 5. Cross-cutting questions

- R1: The view adds no regional value. Tax brackets, exemption thresholds, regulatory limits and the rate source come from the outputs of `estimate_redemption`, `get_tax_year`, `get_institution_indicators` and `get_balances`, whose regions already implement them. The first weekday of `heat` comes from the active locale (`Intl.Locale` week info, fallback Monday).
- R2: A source without a regional value omits its mark: no exemption line, no bracket bar, no limit tick; the verdict key without that clause is used.
- R3: The form id is `^[a-z][a-z0-9_]{1,39}$` in `openapi.yaml` and in SQL, never an enum.
- R4: Does not apply: no new extension point.
- R5: Titles, verdicts, provenance, window labels, chips of the client, axis and legend words: catalog keys `assistantView.*` in pt-BR and en.
- R6: Every number and date of a view is formatted by the client from the active tag through `Intl` (`useMoneyFormat`, `formatDate` of `i18n/format.ts`).
- C1: Amounts in `data` are integers of minor units with their currency; builders compute shares in basis points with integer maths.
- C2: A sum in a view holds one currency. `fx` names the rate date and source from the output; a missing rate shows the account in its own currency with "sem cotação" and leaves it out of the total, stated in the verdict.
- C3: A view on an account or instrument in a currency other than the base shows the record's currency; totals across currencies appear only in `fx` and `figure`, converted with the rate named.
- C4: The currency of a figure comes from the output; the client formats through `useMoneyFormat()`, so privacy mode hides it.
- T1: Windows are calendar dates in the book's time zone; "today" comes from `platform/clock`, passed to the builder.
- T2: Does not apply: no business-day count; due dates come from the source outputs.
- B1: New table `assistant_view` with `books_id`; every query filters by it; a schema test rejects a row without a book.
- B2: No new operation; `show` is read-only and follows the read role of the chat (HA17).
- B3: Does not apply: no setting.
- D1: `assistant_view` is archived with the conversation, as `assistant_message` (`internal/reporting`, archive steps and `TestEveryTableIsClassified`); the archive version rises.
- D2: One goose migration creates `assistant_view`.
- D3: Does not apply: a view records no fact.
- D4: Does not apply: a view writes no ledger data; writes stay proposals.
- D5: Does not apply: no diagnostic field.
- S1: No new operation. `AssistantMessage` gains `views`; `AssistantPreview` gains `effects`. `TestToolExposure` unchanged; `show` is a chat tool listed in `TestToolCatalog`.
- S2: Every view and body has its 390 px form in the mock; the phone draws the same anatomy.
- S3: The guide article of the assistant topic gains a section on views, the chart/table switch and follow-up chips.
- S4: The model reads `view_source` from each read output and calls `show`; the prompt (`guide.tmpl`) replaces the chart ban with: call `show` for a figure, comparison, share, trend, schedule or list of records; the text adds what the view does not show; no Markdown table when a view shows it.
- X1: Does not apply: no domain scenario changes; `internal/assistant` black-box tests cover V1, V2, V5, V9 through the turn API with a scripted model.
- X2: Builder tests run one case with an account in USD in a BRL book (`fx`, `balance`) and one source without regional values (`redemption`, `tax_year`).

## 6. Tests

- Builders: one table test per form with hand-derived expected values, a zero, an empty source and a long name.
- Turn: a scripted model calls a read, then `show` with its handle; the stored message returns the view; an unknown handle, a form outside the registry and a fourth view return tool errors.
- Client: per form, a test of its pure geometry (positions, shares, lanes, readout) and one render test; `AnswerView` tests for the toggles, copy text and chips.
- Visual: before each commit with a form, captures at 390 and 1440 px in both schemes match the approved shots with no overflow; every tooltip stays inside the view (the mock's `tips.mjs` check).

## 7. Delivery order

1. Source handles, `show`, registry, `assistant_view`, `views[]`, `AnswerView` anatomy, prompt; forms `ranking`, `compare`, `series` move to the registry.
2. Forms by area, one commit per form with its builder, body, keys and row in "A form per kind": patrimony and accounts, spending, transactions, card, planning, investments, taxes and imports.
3. `effects[]` in previews and the write bodies, one commit per kind.
4. Outcomes.
