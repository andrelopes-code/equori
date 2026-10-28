# Unconfirmed entries: confirmation by line or by balance (amendment A133)

Amends A103 of `2026-10-20-record-matching-design.md`.

## Intent

The overview attention list reports "Registros não confirmados" per account. The owner opens it and cannot tell why an entry is listed or what resolves it. On a card account the item leads to a page without the list.

A measurement on the development database of 2026-10-28 found 19 listed entries on three accounts. All 19 are false positives:

| Account | Entries | Cause |
|---|---|---|
| Algum dinheiro (reserve) | 4 | Transfers from the checking line (S70). Status `reconciled`: the reserve's synced balance confirms them. |
| Cofrinho Mercado Livre (reserve) | 2 | Same cause. |
| Nubank Gold (card) | 1 | Opening balance, `reconciled` by the statement of 2026-06-26. |
| Nubank Gold (card) | 2 | Cancellation credits, `reconciled` by their statement. |
| Nubank Gold (card) | 6 | Installments 3 to 6 of plans, dated on the purchase date (A40) and billed on statements closing from 2026-11-27 to 2027-02-26. |
| Nubank Gold (card) | 3 | Cancellation reversals of unbilled installments (M25), billed on statements closing on 2026-10-29 and 2026-11-27. |

A103 defines an unconfirmed entry by the absence of an external record alone. The glossary defines `reconciled` as "confirmed against an institution statement or balance assertion". A103 contradicts it: a posting the institution's balance confirmed stays listed. A103 also dates every posting by `booked_on`. A card posting cannot receive its line before its statement opens, so the date that governs it is its statement's.

## Rule

A posting is **confirmed** when an institution line links it (it carries an external record) or an institution balance reconciles it (status `reconciled`, set by `ReconcileAccountPostings` or `ReconcileStatementPostings`).

The **expected date** of a posting is the date by which the institution has reported its line:
- a posting with a statement: the statement's closing date. The closed statement is the institution's account of a card cycle, and its total confirms or contradicts every posting on it;
- any other posting: `coalesce(settled_on, booked_on)`.

Two postings **offset** when both are on the same statement and neither carries an external record. They also have opposite amounts, and their transactions are joined by a link of type `cancellation_of` or `anticipation_of`. The pair is a cancelled or anticipated installment and its reversal (M25, M26). The institution reports neither.

A posting is **unconfirmed** when all of the following hold:
1. it is not voided;
2. it is not confirmed;
3. it has no offsetting posting;
4. its account has a feed: a mapped external account or an imported file (unchanged from A103);
5. its expected date is on or after the feed's start and more than `MatchHardLimit` (10) days before the feed's end (window unchanged from A103).

The list keeps one entry per transaction, as A103 does: the transaction's unconfirmed posting with the earliest expected date.

The rule uses only lines, balance assertions and statements. Every source provides these concepts: files of any format, any aggregator, and any country. The rule introduces no regional value and no extension point; `docs/contributing/regions.md` is unchanged.

Consequences that follow from the rule without special cases:
- A feed with balances and no lines (Pluggy `RESERVED_BALANCE`) lists nothing while its balance matches. When its balance differs, the open difference is the signal. The entries after the last reconciled date are then listed as the candidates that explain it.
- Postings created from balance facts are reconciled by the fact that created them. These are opening balances, yields and adjustments, and they need no origin check.
- An installment on a statement that has not closed is never listed. Once the statement closes, one of two things follows. Statement reconciliation confirms the installment. Or the institution sent no line and no matching total, and the installment is listed.
- A reversal whose installment the institution billed anyway has no offsetting posting. It is listed once its statement closes unconfirmed, which signals a cancelled installment the institution still charged.

## Backend

- New sqlc query `ListUnconfirmedPostings` in `db/queries/ledger/import.sql`, applying conditions 1, 2, 3 and 5 with the expected date. `ListUnlinkedPostings` stays unchanged: matching (A98–A100) chooses candidates among postings without a record, including reconciled ones.
- `ledger.Module.UnconfirmedPostings(ctx, userID, accountID, from, to)` returns transaction id, expected date, amount, payee, description and statement id.
- `ingestion` `Service.Unconfirmed` (`internal/ingestion/internal/app/review.go`) calls it instead of `UnlinkedPostings`. The assistant tool view `unconfirmed` (`toolapi/imports.go`) reads the same service and changes with it.
- `api/openapi.yaml`, `UnconfirmedEntry`: `date` becomes the expected date. Add an optional `statement_id` (uuid), present for a card posting. Update the `listUnconfirmed` description to the rule above. No new operation, so `tool_exposure_test.go` needs no new entry.

## Web

Attention item (`features/overview/attention.ts`, `attention-block.tsx`):
- One row per account. When the account has an open difference, the difference row stands alone and carries the unconfirmed count as its line. Otherwise the unconfirmed row stands.
- New pt-BR title: "Lançamentos que o banco não informou". The account name stays as the line.
- Destination, balance account: the reconciliation tab (unchanged).
- Destination, card: the statement page of the earliest `statement_id` among the entries.

Reconciliation tab (`features/accounts/reconciliation-tab.tsx`):
- Replace `reconciliation.unconfirmedNote` with a sentence that states the cause and the resolutions. pt-BR: "Estes lançamentos não têm linha do banco. Um lançamento duplicado ou digitado errado se resolve anulando ou corrigindo a transação. Um lançamento correto se confirma quando o saldo informado pelo banco bate."
- Each row opens the transaction, as today. Void and correction stay on the transaction page.

Statement page (`features/cards/statement-page.tsx`, `statement-lines.tsx`):
- A line whose transaction is in the account's unconfirmed list carries the tag "Sem linha do banco", with the same sentence as its description.

The en catalog receives the equivalent keys.

## Scenarios

| ID | Scenario |
|---|---|
| S167 | The reserves of S70 receive the transfers of 2026-11-11 from the checking lines. The sync of 2026-11-30 reports the reserve balances, which match. Neither reserve lists an entry. |
| S168 | A checking account mapped from 2026-10-01 has a manual entry −30.00 of 2026-10-05 that no line links. The sync of 2026-11-12 reports a balance equal to the derived balance. The entry is reconciled and not listed. |
| S169 | A card purchase in 6 installments of 100.00 of 2026-08-14 is created from the line of installment 1 on a card closing on day 3. On 2026-11-12 the list holds installment 2 (statement 2026-10, closed 2026-10-03) with its `statement_id` and date 2026-10-03. Installments 3 to 6 sit on statements closing from 2026-11-03 and are not listed. |
| S170 | The plan of S169 is cancelled on 2026-09-20. Installments 2 to 6 each offset their reversal and are not listed. Offsetting pairs one posting with one posting: statement 2026-10 holds installment 2 (−100.00), its reversal (+100.00) and the credit of billed installment 1 (+100.00), and only one +100.00 offsets the installment. On 2026-11-12 the list holds one entry: the cancellation transaction, +100.00, dated 2026-10-03. The institution reports that credit as a refund line. |

S97 keeps its assertions: an entry the institution's balance contradicts stays listed. Each new scenario has a test through `internal/apitest` that fails on the current code.

## Non-goals

- No owner action to mark an entry as accepted. A correct entry is confirmed by the next matching balance. An account without balances can receive one through the existing assertion form.
- No change to matching, its window or its scores.
- No change to how imported installments are dated (A40).

## Known problem outside this change

Imported installments on statements that have not opened carry status `cleared` without an external record. The glossary defines `cleared` as "settled by the institution". The rule above does not read `cleared`, so this change neither depends on that status nor corrects it.
