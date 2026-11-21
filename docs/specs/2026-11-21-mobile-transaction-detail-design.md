# Mobile transaction detail

Status: approved 2026-11-21 (owner delegated the design decisions of wave 2 in the session of the phone redesign). Wave 2 of the phone redesign; wave 1 is `docs/specs/2026-11-21-mobile-statement-design.md`.

Below 600 px the page `/transactions/$id` reads as the receipt of a banking app: the amount first, then what it was spent on, then the facts, then the accounts it moved. The pane beside the list (600 px and above) and the desktop page do not change.

## Rules

| ID | Rule |
|---|---|
| MD1 | The detail panel breaks out of the page column (`ContainerBreakout`): it spans the screen, its header's rule reaches both edges, and its own containers keep the page margin of MS1. |
| MD2 | The header holds the title, the date and the accounts as subheading, the voided or pending tag, and one menu with every action of the record (`detail.actions`: correct, mark as transfer, record reimbursement, mark as reimbursement, void). |
| MD3 | The first block of the body is the amount alone on its line, signed and toned as a statement row (MS5), at the `2xl` text size. |
| MD4 | The blocks follow in this order: amount, category, facts, accounts involved, goal, links, scheduled occurrences, attachments, history. The facts take the row layout: the term at the start, the value at the end, one line each. |
| MD5 | The accounts involved draw as statement rows (MS4): the account name; then pending (warning) when pending, the statement month, the installment, the clearing date and the note; the signed amount at the end with the original amount under it. Tapping a row opens `/accounts/$id`. |
| MD6 | A section label does not stick on a phone: the screen's top bar already holds the place, and a stuck label covered the content scrolling under it. |
| MD7 | Loading draws the receipt's shape: the title and subheading, the amount, one category row and six fact rows. |

## Cross-cutting questions

- R1 to R4: Does not apply: no regional value, behaviour, value set or extension point.
- R5: New key `detail.facts` (the facts section) in pt-BR and en; the menu reuses `detail.actions`, the rows reuse `postings.*` and `posting.status.pending`.
- R6: Dates through `formatDate` and `formatReferenceMonth`; amounts through `useMoneyFormat()`.
- C1 to C4: Each amount reads in its posting's currency through `useMoneyFormat()`; nothing is summed.
- T1, T2: Does not apply.
- B1 to B3, D1 to D5, S1: Does not apply: no table, operation, setting or data written.
- S2: Phone route `/transactions/$id` (ADR 027 S3), kind "Record" (mobile.md M1).
- S3: The guide article of the transactions topic states the phone page.
- S4, X1, X2: Does not apply.
