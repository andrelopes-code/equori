# Assistant conversation: typed operations, decision sheet and receipts

Issue #50. Rules: `docs/contributing/web.md`, section "Assistant conversation". Approved mock: `docs/specs/assets/2026-11-15-assistant-conversation/mock.html` (concept D, owner review of 2026-11-15), open in a browser with `?s=light`, `?s=dark`, `?w=phone`. The mock is the contract except for the two defects the owner named (section 9).

This spec amends `docs/specs/2026-10-26-mcp-agent-design.md`: P5 (section 4.3), P13 (the sheet's footer scrolls into view), P15 (the deadline is shown once per sheet), P17 ("Confirmar todas" becomes the sheet's "Confirmar M" over the marked proposals). P14 and P16 hold inside the sheet and the results.

## 1. Questions the conversation answers

1. What is the answer? The text, with its figures.
2. What will the assistant change, and do I agree? The operations of the answer and one decision.
3. Was it done, and where is it? The outcome of each operation and its record.

## 2. Delivery

| Plan | Content | Depends on |
|---|---|---|
| 1 | Thread (section 3), decision sheet (section 4), results (section 5), pending dock (section 6), from the fields the previews carry today | none |
| 2 | Preview fields of section 7 in the backend, and the typed operation bodies of section 7 that read them | plan 1 |
| 3 | Answer blocks drawn from Markdown tables (section 8) | plan 1 |

## 3. Thread

- **Mark and rail.** Every assistant turn (stored answer, running turn, unanswered turn) is drawn beside a 26 px round mark with the `spark` glyph in the accent tone on the accent surface. A 1 px rail in `--slotted-border-subtle`, fading to transparent, runs from the mark to the end of the turn. The turn's content starts 38 px from the thread's start edge. Mock: `.turn`, `.rail`, `.mark`.
- **Running turn.** While the turn runs, the mark carries a ring of the composer's colours (`--slotted-data-1`, `-3`, `-5`, `-2`) that turns once per `--slotted-duration-loop-slow`. Each source line enters with its icon in a 22 px tile; the current one is in the text colour with its tile edged in the accent, finished ones show a check in the tile. Under `prefers-reduced-motion: reduce` the ring stands still.
- **Sources once.** Each tool appears once, in the order of its last call (amended P5, commit 7928395f). After the answer the list folds into a pill: up to three source icons overlapped by 6 px, the count text (`assistant.activity.summary`), a chevron; the pill opens the list.
- **Source icons.** Each tool maps to one icon of the Lucide grid (table in plan 1, task 1); an unknown tool takes `dot`.
- **Question.** The user's bubble is the Slotted `Bubble` with `variant="soft"` and `tone="accent"`.
- **Answer text.** The answer is 15 px with line height 1.6; the first glyph is not clipped (the current answer clips it at the start edge).

## 4. Decision sheet

The proposals of one answer whose status is `pending`, `waiting` or `executing` form one sheet below the answer. A proposal in any other status is a result (section 5) and is drawn under the sheet, in the proposals' order.

- **Header.** "N alterações para revisar" (`assistant.sheet.title`), and at the end a 16 px ring with the share of time left of the open proposal that expires first, and "até HH:MM" (`assistant.sheet.until`) in the locale's time format. The ring is hidden from assistive technology; the text carries the time.
- **Operation row.** A 52 px row: the Slotted `Checkbox`, a 30 px icon tile of the action, the action title (`actionTitle`), then a `Sugestão` tag when `suggested`, an `Irreversível` tag when `preview.destructive`. The target sits in the body, not in the row.
- **Default marks.** A pending proposal starts marked, except a destructive one, which starts unmarked.
- **Dependent.** A `waiting` proposal whose `waiting_for` names a proposal of the same answer is a 44 px row under that proposal, with a corner glyph, its title and "em seguida" (`assistant.sheet.next`); its checkbox is disabled and follows the parent's mark. It executes as its own row once the server promotes it to `pending`.
- **Body.** Under each row, indented to the title: the target as text, then the typed body of section 7 for its action, or the field rows of today's `ProposalChanges` (one field per row, value at the end, the replaced value struck under it). A suggested proposal adds its reason under an info glyph centred on the first line. A `waiting` proposal without a parent in the answer shows its summary and "Aguarda a confirmação de: …".
- **Footer.** A 64 px footer: "M de N marcadas" (`assistant.sheet.marked`) over a second line that is one of "Inclui 1 irreversível" (`assistant.sheet.irreversible`, danger tone), "K ficam pendentes" (`assistant.sheet.left`) or "Todas serão aplicadas" (`assistant.sheet.all`); then `Rejeitar` (ghost) and `Confirmar M` (solid, accent; danger when a marked proposal is destructive; disabled when M is 0).
- **Confirm.** Confirms the marked pending proposals in order and stops at the first one that does not end `executed` (P17 kept). Rows lock while it runs. A row whose expiry passed is skipped (P15 kept).
- **Reject.** Rejects the marked pending proposals in order.
- **Row states.** While a proposal executes, its row's end shows a 14 px ring and "Executando"; when it ends, the row becomes a result row (section 5) in place, and its body folds.
- **Errors.** A confirm or reject that does not reach the server writes its reason under the row title in the danger tone, with `role="status"`.
- **Reveal.** The footer of the sheet of a new answer scrolls into view (P13 kept).
- **Privacy.** Every amount and text passes `useValueText` as today.

## 5. Results

- **State label.** A 6 px dot in the state's tone and the state word, at the row's end: `executed` "Feita" (success), `failed` "Falhou" (danger), `expired` "Expirou", `rejected` "Rejeitada", `stale` "Desatualizada", `discarded` "Descartada", `blocked` "Bloqueada" (muted). No circled cross.
- **Receipt.** An executed `record_transaction` is a receipt: a 32 px success tile with a check that draws itself (circle then tick, `--slotted-duration-long`), "Transação registrada" over the decision time (`decided_at`, locale date and time), "Abrir" with an arrow when `proposalScreen` returns a served screen, the amount at 2rem and tabular, then rows Descrição, Categoria (or the destination account), Conta, Data from the preview's fields, a dashed rule above them, and a serrated bottom edge (a radial mask, 6 px teeth every 14 px).
- **Other executed results.** A result block: icon tile, title over target, state label, then the field rows, then "Abrir" when there is a screen.
- **Failed.** The block shows what was not applied: the field rows, then the server's detail in the danger tone on a danger wash, starting "Não aplicado." (`assistant.result.not_applied`). No icon.
- **Expired, stale.** The block is drawn at 50% emphasis (muted text and borders, no opacity on an ancestor of a blurred surface, O11) with the hint of today's catalog (`assistant.proposal.hint.*`).
- **All decided.** When every proposal of an answer is decided, no sheet is drawn, only the results.

## 6. Pending dock

While at least one sheet of the open conversation has a pending proposal and no sheet footer is in view, a 44 px dock sits 8 px above the composer: a pulsing 8 px accent dot (still under reduced motion), "1 folha aguarda sua decisão" or "N folhas aguardam sua decisão" (`assistant.dock.one`, `assistant.dock.many`) and a `Revisar` button that scrolls the first open sheet to the centre. The dock is a blurred material surface (`--slotted-surface-material`, `backdrop-filter`), so no ancestor sets a property of O11.

## 7. Typed operation bodies (plan 2)

| Action | Form | Preview fields it reads | Field the API lacks |
|---|---|---|---|
| `categorize_transactions` | De / Para rows with category chips; the transactions moved below | `category`, `payee` | the transactions (description, date, amount), the categories they leave |
| `manage_rule.create_rule`, `change_rule`, `accept_suggestion` | Quando / Então rows; the pattern in the monospace font | `pattern`, `category`, `rule` | none |
| `void_transaction` | The transaction struck through on a danger wash, the reason under it | `reason` | description, date, account, amount |
| `record_transaction` | Transaction row: description, account and date, signed amount at the end | `description`, `date`, `amount`, `account` | none |
| `manage_schedule.create` | Amount per period, the next six occurrences as month tiles | `amount`, `terms`, `account`, `date` | frequency and day as structured values |
| `record_investment.buy`, `sell` | Quantity × price = total, and the paying account | `quantity`, `price`, `amount`, `account` | none |
| `manage_card.set_credit_limit` | Gauge of the current and the requested limit | `limit` | the current limit |
| `settle_statement.pay` | Source account, amount, statement | `amount`, `account`, `date` | the statement as structured values |

Plan 2 also replaces the English targets the tools write ("Transaction X of 2026-10-12", "Statement … of …", "Schedule …", "Rule …") with structured values the client formats in the reader's language.

## 8. Answer blocks (plan 3)

A GFM table of the answer whose last column holds amounts of one currency is drawn as: two rows, paired bars with the difference as a percentage in words; three or more rows, bars in the table's order, numbered when the order is descending; a first column of dates, a step line with the lowest point marked. Any other table, and every table while privacy is on, stays the Markdown table. Plan 3 states the parsing rules.

## 9. Departures from the mock

- The mock draws circled crosses on failures; the code draws the state label and the danger wash of section 5.
- The mock's spacing defects are fixed by the "Inner space" rule: 12 px inside a block, 16 px inside a sheet, row heights of section 4.

## Cross-cutting questions

- R1: Does not apply: no regional value; amounts, dates and times take the reader's locale through `useValueText` and `Intl`.
- R2: Does not apply: no regional behavior.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: Catalog keys of sections 4 to 6, pt-BR and en, listed in the plan's Contract.
- R6: The expiry time, the decision time, amounts and dates use `Intl` through `useValueText`, `formatDate` and `Intl.DateTimeFormat` with the active tag.
- C1: Does not apply: no amount stored or computed in plan 1; the receipt shows the preview's amount.
- C2: Does not apply: no sum.
- C3: Does not apply: each amount carries its currency.
- C4: From the preview value's currency, through `useMoneyFormat()`.
- T1: Does not apply: no date computed; times come from the server.
- T2: Does not apply.
- B1: Does not apply: no table.
- B2: Does not apply: no operation; confirm and reject keep their roles.
- B3: Does not apply: no setting.
- D1 to D5: Does not apply: no table, schema, fact or diagnostic field.
- S1: Does not apply in plan 1: no operation; plan 2 changes the preview schema and states its exposure.
- S2: The panel is served on a phone today; every form is checked at 390 px.
- S3: The guide has no article for the panel (`features/assistant/README.md`, "Guide topic").
- S4: Does not apply: the assistant's tools do not change.
- X1: Does not apply: no scenario of `docs/domain/06-scenarios.md` changes.
- X2: Does not apply: R1, R2, C2 and C3 do not apply.
