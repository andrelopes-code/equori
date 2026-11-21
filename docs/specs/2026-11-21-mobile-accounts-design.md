# Mobile destinations

Status: approved 2026-11-21 (owner delegated the design decisions of the phone redesign). Wave 3 of the phone redesign.

Below 600 px the overview `/`, the balance sheet of `/accounts` and the list of `/cards` and the page of a card hold one line per piece of information: the header does not repeat a figure a card holds, and no row of the list wraps its caption.

## Rules

| ID | Rule |
|---|---|
| MA1 | The header of `/accounts` draws no subheading: the net worth card holds the figure, and the subheading repeated it cut by the header's actions. |
| MA2 | A row of folded positions holds one line: the codes cut with an ellipsis before the count of the others (`+23`), which stays whole. An account row's caption (kind and institution) holds one line and cuts with an ellipsis. |
| MA3 | The header of `/cards` draws no subheading: the figures under it hold what it described, and it was cut at the header's action. The dots of a card face's masked number measure whole pixels at every width. |
| MA4 | The overview draws no subheading, and the first steps draw no sentence under their title: the header cut its sentence at its action, the first steps' sentence took three lines beside the progress, and the steps say it. Each figure's trend takes its own row under the figure, so the comparison holds one line. The comparisons and the step hints read in at most 41 characters. |
| MA5 | On the page of a card, a statement row reads its cycle as `Fecha 03/06 · vence 10/06` (`card.cycleLine`, day and month only: the row's title holds the year). The analysis table of the latest statements scrolls sideways in its frame with the statement column pinned at the start. |

Known gaps: the dot of a statement's status measures 5.25 px at a 14 px root (Slotted issue #169). Below 22rem of its own width a list item draws its amount under the name (Slotted issue #168). On a 360 px screen an indented sub-account row is about 290 px wide, so its balance drops under its name; from 390 px it stays beside it.

## Cross-cutting questions

- R5: The texts of `overview.indicators.reserveNote`, `committedNote`, `debtNote`, `firstSteps.transactionsHint` and `categoriesHint` shorten in pt-BR and en; `card.cycleLine` is new.
- R1 to R4, R6, C1 to C4, T1, T2: Does not apply: no regional value, amount or date changes.
- B1 to B3, D1 to D5, S1: Does not apply: no table, operation, setting or data written.
- S2: Phone routes `/`, `/accounts`, `/cards` and `/cards/$accountId` (ADR 027 S3), kind "Overview" (mobile.md M1).
- S3: Does not apply: what the reader can do does not change.
- S4, X1, X2: Does not apply.
