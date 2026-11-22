# Assistant answer views

- Date: 2026-11-19
- Status: approved by the owner on 2026-11-19 (concept A of the mock; "gostei! apenas garanta que vai estar tudo com acabamento impecavel"; "pode seguir")
- Mock (contract): `docs/superpowers/mocks/2026-11-19-assistant-answer-views-design-mock/` (local, `design.html`, `design.css`, `mock.json`, `shots/approved-*.png`; `gen.mjs` writes `design.html`)
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
- V2. The assistant module declares the read tool `show` (chat only, not in MCP): `{source: ["rN"] (1 or 2 handles), form: <form id>, select?: {limit?: 1-12, highlight?: string}, next?: [string ≤ 60 runes] ≤ 3}`. The output is `{"view": "<id>"}` or a tool error naming the forms the source allows.
- V2a. A form that compares two periods (`compare`, `changes`) takes 2 handles of the same source tool; every other form takes 1.
- V2b. `get_category_totals` gains `group: month | day` (optional): the output then adds `periods[{from, to, categories}]`. It feeds `series` (month) and `heat` (day) and passes `TestToolCatalog`.
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
- D1: `assistant_view` stays out of the archive, as `assistant_message` does (households design HA55): `notExported` and `replacedTables` of `internal/reporting/postgres`; the archive version does not change.
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

1. Source handles, `show`, registry, `assistant_view`, `views[]`, `AnswerView` anatomy, prompt; forms `ranking` and `compare` move to the registry.
2. `group` on `get_category_totals` with `series` and `heat`; then forms by area, one commit per form with its builder, body, keys and row in "A form per kind": patrimony and accounts, spending, transactions, card, planning, investments, taxes and imports.
3. `effects[]` in previews and the write bodies, one commit per kind.
4. Outcomes.

## 8. Amendment of 2026-11-20: what the implementation settled

- A1. The view types live in `internal/platform/view`; each module builds the views of its own reads in its `toolapi` (`internal/ledger/viewapi` for the ledger, whose `toolapi` holds 40 files) and exposes them with `Views()`; `internal/server/modules.go` hands them to the assistant.
- A2. A view value is one of: text, money, bp (a share), count, date, month, times (a multiple), rate (a return, up to two decimals), points (a difference of two rates) and decimal (a number written with a dot, such as a price). A share below 10% keeps one decimal.
- A3. `show` takes 1 handle, 2 for `compare` and `changes`, 1 to 2 for `figure` (net worth and its days) and 1 to 4 pages of one search for `txs`, `outliers` and `heat`.
- A4. A form draws only what its read returns. The mock's marks without a source are left out: the goal's monthly history (the `goals` form shows saved against target and the monthly amount to the date), the cadence dots of recurring charges (the `recurring` form shows the yearly cost from the cadence), the future commitments of a card (the `statement_history` form shows the closed statements), the gap days of imports (the `imports` form shows the batches), the expansion of a ranking row into payees (a row opens the category's transactions), the conversion rates of balances (the `allocation` form read by currency shows the converted shares).
- A5. Forms built: ranking, compare, changes, treemap, series, waterfall, indicators (get_category_totals, get_financial_indicators); budget, goals, agenda, balance, recurring (planning); txs, outliers, heat, transaction, redemption (ledger); figure, allocation, contribution, holdings, benchmark, tax_year (portfolio); statement, statement_history (get_statement_analytics); explain, categorization (classification); institution, price (marketdata); imports (ingestion); help, calculator (assistant).
- A6. V16 (`effects[]`) is not built: the write bodies draw the changes and items the previews already send. A kind without a body draws its records and then each change before → after; goals, budgets, fixed income applications and custody transfers have bodies of their own.
- A7. V18 keeps the existing receipt and result blocks; an executed write whose tool derives an exact inverse adds Desfazer (V19).

## 9. Amendment of 2026-11-20: undo (V19)

- V19. Desfazer runs, once, the existing write that reverses an executed proposal, as a new proposal of the same answer (`undoes` names the original); the click is the confirmation. The inverse goes through the preview, the basis check and the execution of every proposal. An inverse that fails is stored failed with its reason and leaves the original undoable; an executed one sets `undone_by` on the original and the receipt reads "Desfeito". An undo is not undone. `POST /assistant/proposals/{id}/undo` takes the reason the client writes in the member's language; it answers 409 `proposal_not_undoable` or `proposal_undone`.
- V20. Each tool declares its inverse with `tool.WithUndo`; a write without an exact inverse has no Desfazer:

| Write | Desfazer runs |
|---|---|
| record_transaction, record_investment (new), record_fixed_income, transfer_custody, record_corporate_action | void_transaction of the transaction it recorded (anular: it stays in history with the reason) |
| attach_file | detach_attachment of the attachment it added |
| manage_card add_card / set_card_active | remove_card of the card it added / set_card_active with the opposite state |
| manage_accounts_and_payees close_account | reopen_account |
| manage_budget_or_goal create_budget / create_goal | delete_budget / delete_goal of what it created |
| manage_budget_or_goal link_expense, unlink_expense, allocate | the opposite link / allocate of the opposite amount |
| manage_occurrence realize / skip | unrealize / reopen |
| manage_rule create_rule / create_alias | delete_rule / delete_alias of what it created |
| manage_instrument hide, show | show, hide |
| review_investment_movement confirm, dismiss | undo |

- V21. Writes without Desfazer, by cause: a void (the ledger forbids restoring a voided transaction), a deletion or a merge (the record is gone), a write that replaces values (corrections, amounts, terms, settings, profile, appearance: the earlier value is not in the call), a write of several records (brokerage note, categorization, imports, price files, statement settlement: no single inverse undoes all of them), and an external effect (sync, export, quote probe). Each is corrected by asking the assistant again.

## 10. Amendment of 2026-11-21: a chart of the rows (V22 to V26)

Owner, 2026-11-21: the model chooses the drawing of a view among its form's body only; a figure that the body does not draw as the member asks (a trend as a line, a split as a pie) has no view. Every builder already fills `rows` with typed values (V12), so a drawing of those rows keeps every figure from the read.

- V22. `select` of `show` gains `chart`: `bar` (horizontal bars), `column` (vertical bars), `line`, `area` or `pie`. Without it the view draws its form's body. `chart` is a closed universal set of drawings and not a value that grows with regions, so the schema holds an `enum`.
- V23. `view.PlotOf(rows, chart)` (`internal/platform/view/plot.go`) chooses the columns. The label column is the first column whose every value is a text, a date or a month. The series are the other columns whose every value is a number (money, bp, count, times, rate, points) of the unit of the first such column: the same field and, for money, the same currency. `pie` keeps the first series, takes at most 8 rows and no value below zero. `line` and `area` take at least 2 rows. A table without a label column or a series, or outside these limits, is a tool error that names the cause; the view is not stored.
- V24. The payload gains `plot: {chart, label, series[]}`, indexes of `rows.head`. The view stays a snapshot of the read (V10).
- V25. The client draws a payload with `plot` as a Slotted `Chart` of the rows (`plot-body.tsx`), with the toolbar off: the chart/table switch of the foot (V11) keeps its role. Each value and each axis tick is written by `valueText` through `useValueFormat`, so privacy mode masks amounts (C4). A series is named by its head key.
- V26. The prompt line of `show` adds: pass `select.chart` when the member asks for a drawing the form does not have, or when a line, a pie or bars read the rows better than the form.

Cross-cutting questions of this amendment:

- R1: Does not apply: no regional value; the chart draws the rows' values.
- R2: Does not apply: no regional value.
- R3: `chart` is a closed universal set (bar, column, line, area, pie); the form id keeps its pattern.
- R4: Does not apply: no extension point.
- R5: Does not apply: the series names are the existing head keys; the chart's own words come from Slotted `messages` in the active locale.
- R6: Ticks, tooltips and labels go through `valueText` with the active locale.
- C1: Values stay integers of minor units or basis points; the chart receives them as numbers and formats them back through their unit.
- C2: A series holds one unit; money columns of different currencies never share a chart (V23).
- C3: The currency of a series is the currency of its values in the rows.
- C4: Every amount passes through `useMoneyFormat()` inside `useValueFormat`.
- T1: Does not apply: no new date; labels are the rows' dates and months.
- T2: Does not apply: no business-day count.
- B1: Does not apply: no table; `plot` lives in the stored payload of `assistant_view`.
- B2: Does not apply: no operation.
- B3: Does not apply: no setting.
- D1: Does not apply: no table.
- D2: Does not apply: no schema change; the payload is JSON.
- D3: Does not apply: no recorded fact changes.
- D4: Does not apply: no write.
- D5: Does not apply: no diagnostic field.
- S1: No operation; `AssistantViewPayload` gains `plot`. `show` is chat only.
- S2: The chart takes the width of the view at 390 px; Slotted draws it at size `sm`.
- S3: The guide article of the assistant gains one sentence: a view can be asked as bars, columns, a line, an area or a pie.
- S4: `show` gains `select.chart`; the prompt gains V26.
- X1: Does not apply: no domain scenario; `internal/assistant` tests a chart through the turn API.
- X2: Does not apply: no regional value; `PlotOf` tests a table with two currencies.

## 11. Amendment of 2026-11-21: a chart of any read (V27 to V36; replaces V22 to V26)

Owner, 2026-11-21: "monte um gráfico dos meus rendimentos nos meses desse ano, conta 'Algum dinheiro'" got no view: `get_account_history` has no form, and V22 only redraws rows a form already built. The owner asked for the most versatile solution that stays safe, with the user's experience first. The model now describes a chart over the output of any read of the turn; the server extracts, filters, groups and aggregates the records with exact integer maths, and the client draws the result. The model never states a figure: it names fields, an aggregation and a drawing.

- V27. `select.chart` (V22) is removed, with `view.PlotOf` (V23). The form `chart` is open to every read tool: `show {source: 1 to 4 handles of one tool, form: "chart", chart: Spec, next?}`.
- V28. Spec: `title` (1 to 60 runes), `items` (the dot path of an array in the output, such as `days`), `where[]` (at most 4 of `{field, op: eq | ne | gt | gte | lt | lte | contains, value}`), `x: {field, bucket?: day | month | year, from?, to?, label?, sort?: x | desc | asc, limit?: 1 to 24}`, `split?: {field, limit?: 2 to 8}`, `series[]` (1 to 6 of `{field?, agg: sum | count | avg | min | max | first | last, sign?: as_is | negate | abs, kind: bar | line | area | pie, label (1 to 40 runes), axis?: start | end, stack?, curve?: linear | monotone | step, tone?: success | danger | warning | info | neutral}`), `orientation?: vertical | horizontal`, `stack_mode?: normal | percent`, `average?: [series index]`. A field is a dot path inside an item. `count` takes no field.
- V29. Pages: each handle is a page of the same read. When every output carries a non-empty `next_cursor`, more records follow and `show` is a tool error that asks for the next pages or a narrower read. A handle given twice is a tool error. At most 2,000 items.
- V30. Typing. An object `{amount, currency}` is money, parsed into minor units of its currency (`view.Amount`). An integer is a count. A string `YYYY-MM-DD` is a date, `YYYY-MM` a month, any other string a text. A fractional number, an array and a missing field are not values: a series field that holds one in a kept item is a tool error; a filter on it drops the item. A money value of `where` compares the amount as an exact decimal.
- V31. Grouping. A date `x` groups by its bucket (`day` when absent): a day keeps its date, a month its `YYYY-MM`, a year its text. When a series sums or counts, every bucket between the first and the last, widened to `x.from` and `x.to`, appears with zero; at most 400 buckets. A text `x` groups by value, sorted by the first series descending unless `sort` says otherwise; `limit` (8 for a pie, 12 otherwise) counts the rows drawn: past it, the first `limit - 1` stay and the rest fold into one row "Outros N" when every series sums or counts, or the rows are cut at `limit` otherwise. Dates sort by `x`.
- V32. Aggregation. `sum`, `min`, `max`, `first`, `last` keep the unit; `avg` of money rounds half to even in minor units; `count` is a count. `sign` applies to each value before aggregation. A sum holds one currency: a series whose values hold two currencies is a tool error (C2).
- V33. `split` turns the only series into one series per value of its field, ranked by the absolute total. `limit` (default 6) counts the columns drawn: past it, the first `limit - 1` stay and the rest fold into one column "Outros" when the series sums or counts, or are cut otherwise. It takes exactly one series and no pie.
- V34. Drawing rules. An axis holds one unit; the series of `end` share a unit different from `start`. A pie is the only series, has no `split`, a text or date `x`, no value below zero and at most 8 rows after folding. `stack` applies to bar and area series of one axis. `average` names series of kind bar, line or area whose aggregation sums or counts; its value is the mean of the rows, rounded half to even.
- V35. The payload: `rows` holds the label column and one column per drawn series; `plot: {label, orientation, stack_mode, series: [{column, kind, axis, stack, curve, tone}], marks: [{kind: average, column, value}]}`. Title `assistantView.chart.title` with `{title}`. Verdict: with a summing or counting first series, `assistantView.chart.verdict_total` with `{total, label, top}` (the row of the largest value), `assistantView.chart.verdict_empty` when every value is zero; otherwise `assistantView.chart.verdict_range` with `{low, high}`. Provenance `assistantView.chart.prov` with `{count}` items read. The window is the first and last date of the buckets, or `x.from` and `x.to`.
- V36. Client: `PlotBody` draws each series with its kind, axis, stack, curve and tone, a second value axis when a series reads `end`, the average as a dashed line labelled with its value, horizontal bars when asked. A record without a value leaves a gap. The legend shows when two or more series or a pie are drawn. The foot's chart/table switch shows the rows.

Prompt (replaces V26): for a chart that no form draws, or a drawing the member asks for, call show with form chart and a chart spec over the fields of the read's output; never type a figure.

Cross-cutting questions of this amendment:

- R1: No regional value. Buckets are calendar days, months and years; no week bucket, since the first weekday varies by locale.
- R2: Does not apply: no regional value.
- R3: The enums of the spec (`op`, `bucket`, `agg`, `kind`, `tone`, `curve`, `sort`, `orientation`, `stack_mode`, `axis`, `sign`) are closed universal sets.
- R4: Does not apply: no extension point.
- R5: Keys `assistantView.chart.title`, `.verdict_total`, `.verdict_range`, `.verdict_empty`, `.prov`, `.rest`, `.none`, `.average`, in pt-BR and en. Series labels and the title are text the model writes in the member's language, as the answer text is.
- R6: Every number and date goes through `valueText` with the active locale.
- C1: Amounts are integers of minor units; averages round half to even with `math/big`.
- C2: A series sums one currency; two currencies in one series are a tool error that names them.
- C3: A series carries the currency of its values; the base currency is not assumed.
- C4: Amounts pass through `useMoneyFormat()` inside `useValueFormat`.
- T1: Dates come from the output; `today` is not read by the chart builder.
- T2: Does not apply: no business-day count.
- B1, B2, B3, D1 to D5: Do not apply: no table, operation, setting or write; the view is stored in `assistant_view` as every view.
- S1: No operation; `AssistantViewPlot` changes shape.
- S2: The chart takes the width of the view at 390 px at size `sm`; horizontal bars for long names.
- S3: The guide article of the assistant states that the assistant draws charts of what it reads, in the drawing the member asks for.
- S4: `show` gains `chart`; the prompt gains the line above.
- X1: Does not apply: no domain scenario; `internal/assistant` tests a chart of `get_account_history` through the turn API.
- X2: `view` tests a series in USD in a BRL book and two currencies in one series.
