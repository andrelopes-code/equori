# Cards widget

The Cards widget of the overview lists the statements that owe something. Today each row holds the card's name, a due date and an amount: a card with a closed and an open statement appears twice, nothing adds up what is due, the closing date and the credit limit are absent, and the face of the card, which the Cards page draws, is not used.

The approved mock is the contract of the form: `docs/specs/assets/2026-11-17-overview-cards-mock/` (owner, 2026-11-17, concept C "wallet"). `design.css` moves to the widget's stylesheet without edits and the markup follows `design.html` element by element.

## 1. Scope

- The widget keeps its reads (`GET /accounts`, `GET /accounts/{id}/statements`) and adds the reads the face needs, which the Cards page already makes (institutions, the logo index, the plastic cards of the account). No operation is added.
- A card without a statement that owes something stays out, as today (`owedStatements`).
- Out of scope: paying a statement from the widget, a card in the wallet that owes nothing, the Cards page, the Upcoming widget.

## 2. Decisions

| ID | Decision |
|---|---|
| CW1 | Order of the questions, confirmed by the owner on 2026-11-17: how much is due and when; the open statement of each card and its closing date; the limit of each card. |
| CW2 | The cards stand as a wallet: one face per card, stacked, each showing the top strip of its face. The chosen card is drawn whole in its place and the faces under it move down. The last face, when it is not the chosen one, ends at the edge of the pocket. |
| CW3 | The choice is a radio group: one radio per card, named by the card, what it owes and its deadline. The arrow keys move the choice; the layout answers the checked radio through `:has()`, with no layout state in React. The detail of every card is rendered and only that of the chosen card is drawn. |
| CW4 | Order of the wallet: by the due date of the oldest owed closed statement, cards with none after them by the due date of their open statement. The first of that order goes last in the wallet and starts chosen: it is the card to pay first. |
| CW5 | A card with a closed statement that owes carries the owed amount at the end of the top strip of its face, in the face's ink. A strip without an amount says the card asks for no payment. `CardFace` gains a `note` slot at the end of its top strip, in the place of the contactless symbol. |
| CW6 | The totals stand beside the wallet, at its top. "To pay, all cards": the sum of `unpaid` of the statements `closed`, `partially_paid` and `overdue` in the base currency, with the count of those statements and the deadline of the most urgent one (an overdue one first, then the nearest due date). Without such a statement it reads "Nothing to pay now". "Open": the sum of `open_amount` of the open statement of each card in the base currency, with the count of those statements; when a card in another currency is left out it reads that the sum holds the base currency only. |
| CW7 | The detail of the chosen card stands beside the wallet at its bottom, and under it in the narrow form. Three facts, each a label, a note and a value ending on one vertical line: to pay (the owed amount of the card and the deadline of its most urgent statement), open statement (its amount and its closing date) and free limit (`available_limit` and the share used, over a meter). The owed and the open amounts are links to their statements. A missing fact reads its reason in words and a dash for its value. |
| CW8 | The deadline of a closed statement: `overdue` reads "overdue {relative}" in the danger tone; due within 3 days reads "due {relative}" in the warning tone; due within 7 days the same words, muted; later, "due {day and month}", muted. The relative words come from `formatRelativeDays`. |
| CW9 | The share used is `round((credit_limit - available_limit) * 100 / credit_limit)`. At 100 or more the note reads "limit reached" in the danger tone and the meter fills in the danger tone. A card without limit data reads "no limit set" and draws no meter. |
| CW10 | At the desk the wallet fills its widget (owner, 2026-11-17). The app measures the room the widget leaves and sets the width of the face and the height of a strip: the face is as wide as the height and the column of the detail allow, between 10rem and 20rem; the strips of the unchosen cards share the height that is left, from 18% of the face (15.5% from four cards) up to the whole face. The default height holds up to six cards without a scroll. Before the measure, and in the narrow form, whose height follows its content, the stylesheet's widths stand: 16.25rem, and 14.75rem, 13rem and 11.5rem from 4, 5 and 6 cards. The geometry is a pure function, `fit-face.ts`, with its test. |
| CW11 | The form follows the width of the widget through a container query at 30rem, not the viewport: the owner resizes the widget on the desk. |
| CW12 | Motion: the slot of a face grows and shrinks with the choice, an unchosen strip lifts under the cursor, the detail enters with a short shift, each face rises once on entry. The entry moves the slots, never the pocket: a moving pocket becomes the containing block of the detail. Every unchosen and chosen face is clipped to its slot, so no face stands over the detail during a change. Everything stops under `prefers-reduced-motion`. |
| CW13 | Own element: the wallet. Families read: `radio-group` (draws a mark and a label per option, not a face), `card` (a surface for content), `carousel` (one item in view, the others off screen), `accordion` (a header and a panel per item, not an overlapping stack). The face is `ui/card-face`, a deliberate element of the app's identity. The wallet is built under `build-own-element`; it is a form of this widget, not a Slotted finding. |
| CW14 | The block keeps its placement: 6 columns and 4 rows, removable. A resize leaves it at 6 columns or more: the wallet and the detail stand side by side from that width. |

## 3. Derivation

- `wallet.ts` holds the pure view model: the cards in wallet order with their owed amount, deadline, open statement and limit share, and the two totals. It holds no text.
- `use-wallet.ts` holds the queries and returns `{ view, loading, error, retry }`.
- One component per file draws the totals, a slot, a detail and a fact. `features/cards` exports the component that draws the face of an account, built from what `CardTile` already computes.

## 4. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: the widget adds no regional value; the logo of an institution comes from the catalogue of its region through the existing logo index. |
| R2 | A card whose institution has no logo draws the face with the brand tile of `CardFace`, as the Cards page does. |
| R3 | Does not apply: no value set is added. |
| R4 | Does not apply: no extension point is added. |
| R5 | New keys with pt-BR and en text: `overview.cards.dueAll`, `.nothingDue`, `.statements`, `.statementsOne`, `.overdue`, `.dueWhen`, `.dueOn`, `.openAll`, `.baseOnly`, `.pay`, `.nothing`, `.bill`, `.closes`, `.noBill`, `.limit`, `.used`, `.full`, `.noLimit`, `.limitLabel`, `.choose`, `.cardOwes`, `.cardClear`. `overview.cards.due` and `.dueOpen` are removed. |
| R6 | Dates through `formatDayMonthNumeric`; relative days through `formatRelativeDays`; the share used through `numberFormatter` with the percent style. |
| C1 | The sums are integers of minor units. |
| C2 | Each total holds the base currency only; a statement in another currency is left out and the open total says so in words. The detail of a card shows its amounts in the card's currency and adds nothing across currencies. No rate is read. |
| C3 | A card in a currency other than the base shows its own currency on its face and in its detail, and stays out of the totals (CW6). |
| C4 | Every amount goes through `useMoneyFormat()` (`MoneyFigure`, `fmt.money` for the accessible names), with the currency of the statement or of the limit. Privacy mode masks the strip, the totals, the detail and the names of the radios. |
| T1 | "Today" comes from `useToday()`; due and closing dates are calendar dates. |
| T2 | Does not apply: the widget shows the due and closing dates the API computed. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | Does not apply: no setting; the chosen card is not kept across visits. |
| D1 | Does not apply: no table. |
| D2 | Does not apply: no schema change. |
| D3 | Does not apply: no recorded fact changes. |
| D4 | Does not apply: no data is written. |
| D5 | Does not apply: the diagnostic file is unchanged. |
| S1 | Does not apply: no operation is added. |
| S2 | The overview is a phone route (ADR 027). At 390 px the widget draws the totals, the wallet centred and the detail under it, as the mock holds. |
| S3 | The widget shows more and offers the same destinations. The article `credit_cards_and_statements` gains one sentence on what the overview shows for the cards. |
| S4 | Does not apply: the assistant reads statements through its own tools. |
| X1 | Does not apply: no acceptance scenario is added. |
| X2 | A test of the view model holds a card in a currency other than the base: its open statement is absent from the open total, the total reports one statement left out, and the card keeps its own amounts. The widget has no regional behavior. |
