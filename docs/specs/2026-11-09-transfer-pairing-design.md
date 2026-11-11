# Transfer pairing between own accounts (amendments A216 to A221)

Issue #30. Amends A29 and A30 (P5b pairing), A148 and A149 of `2026-10-31-reliable-bank-connection-design.md`. Adds one extension point under ADR 016. Scenarios S375 to S384.

## Goal

Exit criterion of issue #30, set by this spec: "A sync line of a transfer between two accounts of the book pairs without the owner when the institution names a holder of the book on both lines, and waits in review with its counterpart otherwise; a line from an account that is not connected waits in review; every pairing made by a sync is listed in its summary with undo; no line pairs with a line whose counterparty is a third party."

## Evidence

Measured on 2026-11-09 over the owner's Pluggy lines in `.claude/progress/backfill/pluggy/` (read only): 921 lines dated 2025-10-15 to 2026-11-06, of the Nubank checking account (208), the Mercado Pago checking account (499) and the Nubank Gold card (214).

| Measure | Result |
|---|---|
| Bank lines with `paymentData` | 707 of 707; card lines: 0 of 214 |
| Bank lines whose own side (payer of a debit, receiver of a credit) is the holder | 707 of 707: the own side carries no information |
| Bank lines with a counterparty document (receiver of a debit, payer of a credit) | 333 of 707, types `CPF` and `CNPJ`, none masked |
| Holder document of the account (Pluggy `taxNumber`) | Both bank accounts, one CPF; absent on the card account |
| Lines whose counterparty is the holder | 73, all Pix, all with Pluggy category "Same person transfer" |
| …with exactly one line of opposite amount in another account within 3 days | 58, forming 29 pairs, every pair on the same day, both lines naming the holder; 0 ambiguous within 1, 2 or 3 days, 4 ambiguous within 5 days |
| …without such a line | 15 credits of Mercado Pago from an account at ISPB 60701190, not connected, monthly on days 3 to 6 (14) and 28 (1); 9 of them carry an account number |
| Pairs by amount and date alone (3 days), neither line naming the holder | 15 pairs |
| …card bill payments (card line `PAGAMENTO_FATURA`) | 13 of the 14 card payment lines, all true: 5 Nubank lines without counterparty, 8 Mercado Pago Pix lines whose receiver is the card issuer's CNPJ |
| …false pairs | 2: a Pix to a third party and a credit from another third party 3 days later; a Pix to a third party and a "payment cancelled" credit of Mercado Pago the same day. One line of each names a third party. |

Facts of the code on 2026-11-09:

- `pairingWindowDays` is 3 (`internal/ledger/internal/app/transfer.go`, A29).
- `PairingCandidates` (`db/queries/ledger/transfer.sql`) selects imported, unvoided transactions with the opposite amount on one target account whose other side is uncategorized or `transfers_in_transit` (A29, A88).
- `completePairing` (`internal/ledger/internal/app/imports.go`) pairs a line only when a rule or a reserve (A76) decided a transfer to one named account (A30). A line without that decision is booked against the uncategorized account.
- Only a rule decides a transfer in classification (`internal/classification/domain/decide.go`).

## Definitions

- A **party identifier** is a scheme and a value that identify a person or a company (a CPF in Brazil). Its **key** is the value in the canonical form of its scheme.
- The **holder** of an external account is the party identifier the aggregator reports as the account's owner.
- The **counterparty** of a line is the party identifier on the other side of the line: the receiver of a debit, the payer of a credit.
- A **pairing line** is a sync line that A216 rule 1 admits.
- A **counterpart** is a candidate of A216 rule 2 or 3 for a pairing line.

## A216 Pairing line and counterparts

1. A sync line is a pairing line when all hold:
   1. it is posted, not pending;
   2. no posting of its own account takes it (zone `new` of A100);
   3. no earlier step holds it: re-identification (A143), repeated payment (A142), group (A168), duplicate (A215), reserve (A76, A212);
   4. no rule of the owner decides it (classification method `rule`).
2. A transaction is a counterpart of the line when all hold:
   1. it is imported and not voided;
   2. it holds a posting on a balance account of the book other than the line's account, in the line's currency, of the opposite amount;
   3. that posting is posted and confirmed by a record;
   4. its date is within `pairingWindowDays` of the line's date;
   5. its other side is the uncategorized account or `transfers_in_transit` (A29, A88);
   6. the ledger accepts the transfer (`Transaction.Transfer`).
3. A record in review `transfer` (A219) on another mapped account of the book is a counterpart when its amount is the opposite of the line's, its date is within `pairingWindowDays`, and both it and the line carry counterparty `holder` (A217).
4. A transaction is no counterpart when the line or the counterpart's record carries counterparty `third_party`, unless the line or the transaction is a card payment (A88).

Reason: rules 1 and 2 hold no regional value and decide the core of every region. Rule 3 joins two lines that arrive in syncs of different connections: in the measurement each of the 29 pairs crosses two connections. Rule 4 removes the 2 false pairs measured. The issuer, not the holder, receives a card payment, so rule 4 does not read the counterparty of a card payment; the 13 card payments stay counterparts.

## A217 Counterparty evidence

1. The aggregator reports the holder of each external account and the counterparty of each line, both optional.
2. A **party identifier scheme** is an extension point of ingestion (ADR 016). A scheme returns the key of a value, or no key for a masked or malformed value.
3. The schemes are `br_cpf` and `br_cnpj`. `br_cpf` removes `.` and `-`; 11 digits remain, or the value has no key. `br_cnpj` removes `.`, `/` and `-`, upper-cases letters; 14 characters of `[0-9A-Z]` remain, or the value has no key. A value holding `*` has no key in either scheme.
4. At import, a line's counterparty is:
   - `holder` when its key equals the key of the holder of a mapped external account of the book;
   - `third_party` when it has a key and no mapped external account of the book has that holder;
   - empty otherwise.
5. The value is computed once, at import. A later mapping does not revise it.
6. The Pluggy adapter reads the holder from `taxNumber` (11 digits: `br_cpf`; 14 characters: `br_cnpj`) and the counterparty from `paymentData.receiver` of a debit and `paymentData.payer` of a credit, scheme by `documentNumber.type` (`CPF`, `CNPJ`).

Reason: the core reads no document. A region without a scheme, an aggregator that relays no document, and a file import yield an empty counterparty and follow the core outcomes of A218. A shared book (ADR 029) holds accounts of several holders; comparing with every holder of the book keeps a transfer between two members' accounts a transfer.

## A218 Outcome of a pairing line

| Counterparts | Counterparty of the line and of the one counterpart | Outcome |
|---|---|---|
| One | Both `holder` | Paired by the sync: decision `paired` (A220) |
| One or more | Any other case | Review `transfer` with the transaction counterparts as candidates |
| None | Line `holder` | Review `transfer` without candidates |
| None | Line empty or `third_party` | The pipeline of today: classification, else uncategorized |

1. Pairing makes the counterpart transaction the transfer: its uncategorized or transit posting is replaced by a posting on the line's account that the line's record confirms (A30, `completePairing`). The line creates no transaction.
2. When the counterpart is a record in review (A216 rule 3), the sync first creates that record's transaction against the uncategorized account, without classification. The record is then counted `created` in its batch. Pairing then follows rule 1.
3. Pairing in a sync holds the import lock of both accounts and a lock per book. Two syncs of one book never miss each other's lines.

Reason: in the measurement, the holder on both lines pairs 29 of 29 transfers with no wrong pair; amount and date alone gave 2 false pairs of 15. A pair without evidence on both lines therefore waits for the owner. A line that names the holder and finds no counterpart moves money from an account the book does not sync yet; in review it is neither income nor expense until the owner decides (owner requirement).

## A219 Review `transfer`

1. `ExternalRecord.review_reason` gains `transfer`.
2. Reading the record lists as candidates the transaction counterparts of A216 at read time, as A140 refreshes other reasons. A counterpart recorded after the import is listed.
3. `match` with a candidate pairs the line with it by A218 rule 1. The record turns `matched`. It carries no decision: the owner chose.
4. `create` books the line through classification, as for any record in review.
5. `discard` is unchanged.
6. Review text, pt-BR: "Esta linha parece uma transferência entre contas suas. Escolha a transação da outra conta; sem ela, crie e transforme em transferência para a conta certa, ou descarte." en: "This line looks like a transfer between your own accounts. Choose the other account's transaction; without one, create it and turn it into a transfer to the right account, or discard it."

## A220 Decision `paired` and its undo

1. `DecisionKind` gains `paired`, made by A218 on the pairing line's record.
2. Undo returns the transaction to its version before the pairing, as a new version (A3): the posting on the line's account is removed and the posting it replaced returns. The record releases the posting and waits in review `transfer` with fresh candidates.
3. Undo applies while the transaction keeps the version the pairing gave it and its posting on the line's account is not reconciled. Otherwise, and in the cases of A148, undo returns `no_decision` (409).
4. A record created by A218 rule 2 stays created after the undo. Creations carry no undo (A148, owner decision of 2026-10-31).
5. `ImportCounts` gains `paired`. `matched` keeps counting links.
6. The summary of the sync run (A149) lists the paired record with its undo and the record created by A218 rule 2.
7. Texts: decision `paired`, pt-BR "Pareada como transferência automaticamente", en "Paired as a transfer automatically"; count, pt-BR "Pareadas: {count}", en "Paired: {count}".

## A221 Storage of party identifiers

1. The external account stores the SHA-256 digest of `<scheme>:<key>` of its holder, or none. The document is not stored.
2. The record stores its counterparty value of A217 rule 4: `holder`, `third_party` or none. The counterparty document is not stored.
3. No party identifier enters the raw payload, a log, the API or a language model prompt.
4. A record imported before this amendment carries no counterparty. It takes part in A216 rules 1 and 2 only.

Reason: equality of keys is the only use of a document. The counterparty of a line is usually a third party, whose document the owner has no reason to keep.

## Regions

| Value | Extension point |
|---|---|
| CPF and CNPJ keys | Party identifier scheme (A217): interface `PartyScheme` in `internal/ingestion/internal/domain/party.go`; entries `br_cpf` and `br_cnpj` of `PartySchemes` in the same file, as `IdentifierSchemes` of ledger; no region default: the aggregator adapter names the scheme of each document |
| `taxNumber`, `paymentData`, `documentNumber.type` | Aggregator (`internal/ingestion/internal/aggregator/pluggy/`) |
| Window of 3 days | None: `pairingWindowDays`, not regional |

`docs/contributing/regions.md` gains the row of the party identifier scheme and a checklist step: a scheme is an entry of `PartySchemes`, and an aggregator that relays documents names the scheme of each. The core rules read no region and no scheme identifier.

## Contract

- `ExternalRecord.review_reason`: `transfer`. `ExternalRecord.decision`: `paired`. `ImportCounts`: `paired`.
- `RecordResolution` unchanged: for review `transfer`, `transaction_id` names a counterpart of another account.
- No new operation, no new `Problem.code`.
- Migration: holder digest on the external account (32 bytes); counterparty on the record, `CHECK` in `holder`, `third_party`; the decision and review reason checks gain `paired` and `transfer` where they exist.
- Aggregator port: `ExternalAccount.Holder` and `NormalizedRecord.Counterparty`, each a scheme and a value, optional; `aggregatortest` covers both.
- Catalog keys `batch.reason.transfer`, `links.decision.paired`, `links.count.paired` with the texts of A219 and A220.
- The guide article of the import review topic names review `transfer` and decision `paired`.

## Scenarios

Setup of section 6.15 of `docs/domain/06-scenarios.md`: clock 2026-11-12; items Nubank (checking "Nubank", card "Nubank Gold") and Mercado Pago (checking "Mercado Pago"). Both checking accounts report holder `br_cpf` `529.982.247-25`. A third party is `br_cpf` `111.444.777-35`.

| ID | Scenario |
|---|---|
| S375 | Holder on both lines. Mercado Pago syncs a line −250.00 of 2026-11-10 with receiver the holder: it waits in review `transfer` without candidates and books nothing. Nubank then syncs +250.00 of 2026-11-10 with payer the holder: the Mercado Pago record is created, version 2 of its transaction holds Mercado Pago −250.00 and Nubank +250.00, each confirmed by its record; the Nubank record carries decision `paired`; the Nubank batch counts `paired` 1 and `created` 0; the Mercado Pago batch counts `needs_review` 0 and `created` 1. The summary of the Nubank run lists both records, the paired one with its undo. The same lines synced in the opposite order give one transaction with the same postings, the Mercado Pago record carrying `paired`. |
| S376 | Undo. Undo of the S375 Nubank record: version 3 holds Mercado Pago −250.00 against Uncategorized expense; the Nubank record waits in review `transfer` with that transaction as its one candidate. `match` with it gives version 4, equal in postings to version 2, and no decision. A second undo returns 409 `no_decision`. After the owner edits the description of version 2, undo returns 409 `no_decision`. |
| S377 | Card payment. A Nubank Gold payment line +784.65 of 2026-11-05 is recorded on `transfers_in_transit` (A88). A Nubank line −784.65 of 2026-11-05 without counterparty waits in review `transfer` with the card transaction as its one candidate; `match` makes that transaction hold Nubank −784.65 and the card payment. A Mercado Pago line −784.65 whose receiver is the issuer's `br_cnpj` has the same outcome. |
| S378 | Third party. A Mercado Pago transaction +90.00 of 2026-11-08 from a line without counterparty is uncategorized. A Nubank line −90.00 of 2026-11-08 with receiver the third party is booked against Uncategorized expense, with no review. A Nubank line +60.00 of 2026-11-08 with payer the third party, against a Mercado Pago transaction −60.00 of 2026-11-05, is booked against Uncategorized income. |
| S379 | Account not connected. A Mercado Pago line +1,200.00 of 2026-11-04 with payer the holder and no counterpart waits in review `transfer` without candidates; the next sync keeps it there. `create` books it against Uncategorized income, and `POST /transactions/{id}/transfer` to the manual account "Itaú" gives the transfer of S50. |
| S380 | Masked counterparty. The Mercado Pago line of S375 waits in review. A Nubank line +250.00 of 2026-11-10 with payer `***.982.247-**` is booked against Uncategorized income. Reading the Mercado Pago record lists that transaction as its one candidate; `match` pairs them with no decision. |
| S381 | No document. A Nubank transaction −40.00 of 2026-11-09 from a line without counterparty is uncategorized. A Mercado Pago line +40.00 of 2026-11-10 without counterparty waits in review `transfer` with that transaction as its one candidate. A book of region `US` gives the same outcome. |
| S382 | Several counterparts. Two Nubank transactions −100.00 of 2026-11-09 and 2026-11-11, uncategorized. A Mercado Pago line +100.00 of 2026-11-10 with payer the holder waits in review `transfer` with both candidates; `match` with the second pairs it, and the first stays uncategorized. |
| S383 | Precedence. A rule "description contains `Transferência recebida`" → category Gifts: the Nubank line of S375 is booked against Gifts, and the Mercado Pago record stays in review without candidates. A Nubank line that a posting of Nubank takes by zone `link` (A100) keeps the link. |
| S384 | Bounds. Against the Mercado Pago line of S375 dated 2026-11-07, the Nubank line of 2026-11-10 is paired (3 days). Dated 2026-11-06, the Nubank line waits in review `transfer` without candidates (4 days). A Nubank line +250.01 finds no counterpart. A pending Nubank line +250.00 is not a pairing line. |

Each scenario has a test through `internal/apitest` that fails on the current code.

## Edge cases

| Case | Rule | Covered by |
|---|---|---|
| Both lines in one sync run of one connection | The account read second finds the first account's record or transaction | S375 variant in the plan |
| Two syncs of one book at the same time | A218 rule 3 | Plan test with two concurrent syncs |
| Counterpart record in review for another reason | Not a counterpart (A216 rule 3 names review `transfer` only) | Plan test |
| Counterpart already a transfer, or categorized | Not a counterpart (A216 rule 2.5) | S383 |
| Two equal transfers in the window | Each line finds two counterparts and waits in review | S382 |
| Different currencies, or a fee changing the amount | No counterpart (A216 rule 2.2) | S384 (amount) |
| Reconciled card credit as counterpart | The ledger refuses the transfer; not a counterpart (A216 rule 2.6) | Plan test |
| Holder mapped after the line was imported | Counterparty not revised (A217 rule 5) | Plan test |
| Shared book, transfer between two members' accounts | Each counterparty is the holder of the other's account: `holder` | Plan test |
| Withdrawal of a paired line (A38) | Withdrawal applies as for any linked record; the last decision becomes `withdrawn` | Plan test |
| Card account without holder | Card lines carry no counterparty; card payments follow the core | S377 |
| File import line | Not a pairing line; S45 to S50 unchanged | Existing tests |

## Out of scope

- File imports as pairing lines. A file batch has no sync summary or undo, and its lines carry no counterparty. A file transaction stays a counterpart.
- Automatic pairing of card payments: the card line carries no counterparty.
- The Pluggy category "Same person transfer": it coincides with the 73 lines of the measurement, and the source category mapping (A41) already serves it.
- Identifying the unconnected account by the counterparty's account number: 6 of the 15 credits lack it.
- Transfers across currencies.
- The transfers the owner already made by hand.

## Left to the plan

The migration names, the ports of ingestion and ledger for the book-wide counterpart query and the undo of a pairing, the lock of A218 rule 3, the web components of review `transfer`, the guide article text, and the section S375 to S384 of `docs/domain/06-scenarios.md`.

## Owner task

After delivery, the next syncs of the Nubank and Mercado Pago connections: a Pix between the two accounts shows decision `paired` in the connection page summary, and the monthly credit from the unconnected account waits in review `transfer`.
