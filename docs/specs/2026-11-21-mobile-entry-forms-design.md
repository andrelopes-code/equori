# Mobile entry forms

Status: approved 2026-11-21 (owner delegated the design decisions of wave 2 in the session of the phone redesign). Wave 2 of the phone redesign, with `docs/specs/2026-11-21-mobile-transaction-detail-design.md`.

Below 600 px the screens that record or correct a transaction (`/transactions/new`, `/transactions/$id/correct`, `/transactions/capture`, `/transactions/queue`) keep their title, their kind and their first field inside the first screen: no header row holds only actions, no control wraps to a row of its own beside an empty one, and no sentence takes two lines above the form. From 600 px nothing changes.

## Rules

| ID | Rule |
|---|---|
| MF1 | The links of the headers of New transaction and Text capture (the help link, Write as text, Use the form, the offline queue) stand in one toolbar (`HeaderToolbar`, `header.actions`) on the title row. The help link never folds; a link the row cannot hold folds into the toolbar's menu as an item that opens the same route. |
| MF2 | The kind picker holds the three frequent kinds as segments across the row (`fullWidth`). Every other kind, the advanced one of a correction included, sits in the menu under them, a ghost button that names the chosen kind. |
| MF3 | The sentence under the title of Text capture and of the offline queue leaves. The day a queued text was written stays. |

The postings editor of a correction keeps its two rows per posting (account and amount, then the note); a category or account name that the field cannot hold is cut by the field.

## Cross-cutting questions

- R1 to R4: Does not apply: no regional value, behaviour, value set or extension point.
- R5: New key `header.actions` in pt-BR and en; the menu items reuse `help.screen`, `capture.useText`, `capture.useForm` and `capture.queue`.
- R6, C1 to C4, T1, T2: Does not apply: no date, number or amount is written by these rules.
- B1 to B3, D1 to D5, S1: Does not apply: no table, operation, setting or data written.
- S2: Phone routes `/transactions/new`, `/transactions/$id/correct`, `/transactions/capture`, `/transactions/queue` (ADR 027 S3), kind "Form" (mobile.md M1).
- S3: Does not apply: what the reader can do on each screen does not change.
- S4, X1, X2: Does not apply.
