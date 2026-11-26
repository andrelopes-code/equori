# Cards widget: the deck

The Cards widget of the overview draws the cards as a wallet (`docs/specs/2026-11-17-overview-cards-design.md`). This spec replaces the wallet with a deck: the real faces stacked in depth, the chosen card in front, the open cycle of that card on a rail and the twelve months of its statements engraved on its face. The spec of 2026-11-17 keeps every decision this one does not replace.

The approved mock is the contract of the form: `docs/superpowers/mocks/2026-11-26-overview-cards-deck-mock/` (local, owner, 2026-11-26, concept A "Carteira em profundidade"). `design.css` moves to the widget's stylesheet without edits and the markup follows `design.html` element by element.

## 1. Scope

- The widget keeps its reads: `GET /accounts`, `GET /accounts/{id}/statements` from twelve months back, and the reads of the face. No operation is added.
- Out of scope: paying a statement from the widget, a swipe between cards, the Cards page.

## 2. Decisions

| ID | Decision |
|---|---|
| CD1 | Order of the questions (owner delegated the order on 2026-11-26): how much is due and when; the open cycle of each card; the limit; the history of twelve months as evidence. |
| CD2 | The cards stand as a deck: one real face per card, in the order of CW4, the card to pay first in front and chosen. A card behind the front one shows the top strip of its face, one strip (19% of the face) above the card in front of it, scaled down 4.5% and darkened 12% per step of depth. The chosen card leaves its place and comes to the front; the cards behind it close the gap. |
| CD3 | The choice stays a radio group (CW3). A card is chosen by its strip; the arrow keys move the choice. The radio of the chosen card takes no pointer event, so the pointer reaches the face and the face follows it (`useFaceTilt`). |
| CD4 | The face width follows the number of cards: 18.5rem for one or two, 15.5rem for three, 13.5rem for four, 12rem for five, 10.5rem for six, at every width of the widget. The measured fit of CW10 (`fit-face.ts`, `use-wallet-fit.ts`) is removed. |
| CD5 | The face of every card carries the twelve months of its statements, right of the chip: one bar per closed statement (`billed_amount`) and one bar for the open statement (`open_amount`), the last twelve closed ones in reference order. The closed bars take 34% of the face's ink, the open bar the full ink, a dashed line the mean of the closed bars. The tallest of the bars and the mean is the full height. A card without a closed statement draws no bars. `CardFace` gains an `inset` slot drawn inside the face, under the glare. The bars are hidden from screen readers; the panel holds their values in words. |
| CD6 | The panel beside the deck (under it in the narrow form) shows the chosen card: the rail of its open cycle, then the three facts of CW7 without the card's name, which the face carries. |
| CD7 | The rail runs from the closing date of the statement before the open one to the due date of the open one. Without a statement before it, the rail starts one month before the closing date. It draws the days gone up to today in the card's ink, a mark at the closing date and a hatch from the closing to the due date. Above it: "closes in {n} days" ("closes today" on the day) in the card's ink and "due {day/month}" muted. Under it: the start date and the closing date, at their places. A card without an open statement reads "no open statement" in the rail's place, at the rail's height. |
| CD8 | The ink of the rail is the face colour with its OKLCH lightness at most 0.62 in the light scheme and at least 0.66 in the dark scheme, so a dark brand colour holds 3:1 against the panel. |
| CD9 | The light of the chosen card: a blurred ellipse in the face colour under the deck, which changes colour with the choice. Hidden under forced colours. |
| CD10 | Motion. Entry: the cards rise from below turned 40° on X, back card first, 90 ms apart, on a spring of 900 ms; the totals roll up. On each choice (and on entry for the first one): the chosen card flies to the front on the spring (700 ms) and lands from 92%; a band of light crosses its face once (1.1 s); its bars rise in a wave (40 ms apart); the rows of the panel rise 90 ms apart; the rail draws the days gone, the dot of today lands and sends one ripple; the limit meter fills. A card behind lifts under the pointer. Each animation is bound to the chosen state, so it starts again on every choice without a script. Everything stops under `prefers-reduced-motion`. |
| CD11 | Own element: the deck, the rail and the engraved bars. Families read: `radio-group`, `card`, `carousel`, `accordion` (CW13), `progress` (a meter of one value, not a span of days with two marks), `chart` (a chart with axes and its own surface, not marks engraved on an object). They are forms of this widget and of the face, equori's visual identity; not a Slotted finding. The spring easing has no theme token: a Slotted finding (`token`). |
| CD12 | The block keeps its placement (CW14). |

## 3. Derivation

- `wallet.ts` gains, per card, `cycle` (start, closing, due, days left, days gone, the places of today and of the closing on the rail, in percent with one decimal) and `history` (the bars with their reference, amount and height in percent, and the mean). Both are pure and tested with values derived by hand.
- `use-wallet.ts` passes every statement of a card to `walletView`.
- One component per file: the deck card (`deck-card.tsx`), the rail (`cycle-rail.tsx`), the engraved bars (`face-trend.tsx`). `cards-block.tsx` draws the totals and the deck. `wallet-slot.tsx`, `wallet-detail.tsx`, `fit-face.ts` and `use-wallet-fit.ts` are removed.

## 4. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: the widget adds no regional value. |
| R2 | Does not apply: no regional behaviour. |
| R3 | Does not apply: no value set. |
| R4 | Does not apply: no extension point. |
| R5 | New keys with pt-BR and en text: `overview.cards.closesIn`, `.closesToday`, `.railLabel`, `.trendLabel`. `overview.cards.noBill` and `.dueOn` are reused. |
| R6 | Dates through `formatDayMonthNumeric`, days through `formatRelativeDays`, months of the history label through `formatMonthShort`. |
| C1 | The bars and the mean are integers of minor units; heights are shares of the tallest. |
| C2 | The bars of one card hold the card's currency only; no sum crosses cards. The totals keep CW6. |
| C3 | A card in another currency draws its bars and its rail in its own currency (C3 of 2026-11-17). |
| C4 | Every amount in words goes through `useMoneyFormat()`; privacy mode masks the amounts of the panel and the names. The bars show no amount. |
| T1 | "Today" comes from `useToday()`; dates are calendar dates. |
| T2 | Does not apply: the rail shows the closing and due dates the API computed. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | Does not apply: no setting; the chosen card is not kept across visits. |
| D1 | Does not apply: no table. |
| D2 | Does not apply: no schema change. |
| D3 | Does not apply: no recorded fact changes. |
| D4 | Does not apply: no data is written. |
| D5 | Does not apply: the diagnostic file is unchanged. |
| S1 | Does not apply: no operation. |
| S2 | The overview is a phone route (ADR 027). At 390 px the widget draws the totals, the deck centred and the panel under it, as the mock holds. |
| S3 | The widget shows more and offers the same destinations. The article `credit_cards_and_statements` states what the overview shows for the cards. |
| S4 | Does not apply: the assistant reads statements through its own tools. |
| X1 | Does not apply: no acceptance scenario. |
| X2 | A test of the view model holds a card in a currency other than the base: its bars and rail keep its own currency. |
