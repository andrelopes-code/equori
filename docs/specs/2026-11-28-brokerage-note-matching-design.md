# Brokerage note matching: one bank line confirms the trades of a note

Status: accepted, 2026-11-28 (amendment A273; withdraws A272, `docs/specs/2026-11-28-brokerage-note-settlement-design.md`).

## 1. Intent

The trades of a note debit the bank account one by one, on the trade date, as the owner records them. The bank debits the note in one line ("Débito B3 - Nota Bov 26/11/2026", −360.04 for B5P211 −230.66 and LFTB11 −129.38). That line is the bank confirming trades already recorded; it is never a new expense. The owner does nothing about the settlement.

Today a line confirms one posting (A98 to A100) and a unique index enforces it (`ledger_posting_external_record_idx`). A line that pays several trades finds no candidate and creates a second debit.

Evidence in the owner's book on 2026-11-28: four B3 lines; the three of a one-order note linked; the one of a two-order note duplicated. Amounts agree to the cent. Each submission of the note form is one note of the bank: the two notes of 2026-11-26 were recorded 9 seconds apart and debited on different days.

## 2. Goals, non-goals, anti-goals

| ID | Statement |
|---|---|
| G1 | A bank line equal to the sum of a note's trades confirms every trade of the note, with no new transaction. |
| G2 | A bank line that may pay trades the ledger cannot group waits for review, where the owner picks the trades. It never becomes an expense by itself. |
| G3 | Each trade stays one transaction that debits the bank account on its trade date, as before A272. |
| NG1 | Learning the real settlement cycle of each instrument (the B3 settled the fixed-income ETFs D+1 on 2026-11-27; IO7 computes D+2). Matching tolerates the gap (A98, 10 days). |
| NG2 | Grouping trades by inference (same day, same settlement date) for an automatic link. |
| AG1 | An account, a transaction or a posting the bank does not have (A272's settlement). |
| AG2 | A rule that falls back to the old behavior in silence. |
| AG3 | A search over sums of unrelated postings. |

## 3. Constraints

- One record confirms one posting today: `ledger_posting_external_record_idx` (unique), `TransactionByExternalRecord` (`:one`), `ingestion_external_record.transaction_id` (one transaction).
- A note records its orders in one database transaction (IO20), so its trades share `ledger_transaction.created_at` to the microsecond. Trades of separate requests never do.
- Matching blocks a pair by amount within 20% and 10 days (A98) and links only an identical amount with a margin of 3 over rivals (A100).

## 4. Approaches

| Approach | Trade-off | Decision |
|---|---|---|
| A272: the trades pay a cash account of the brokerage; one settlement transaction moves the total from the bank | Keeps one record per posting. Adds a movement the bank does not have; needs an open cash account at the brokerage and falls back in silence without one (the owner's was closed). | Withdrawn (AG1, AG2). |
| Sum search over unlinked postings | No schema change. Matches unrelated debits by coincidence; fails by cents. | Rejected (AG3). |
| **Note identity plus review** | Deterministic: the owner's form submission is the group. Changes the one-record-one-posting rule and adds a multi-trade resolution. | **Chosen.** |

## 5. Rules

### 5.1 Note identity

| ID | Rule |
|---|---|
| NM1 | `ledger_trade.note_id uuid NULL`. `POST /brokerage-notes` (and the tool `record_brokerage_note`) gives every trade of the note one new id. `POST /trades` gives none. Correcting a trade (`PUT /trades/{id}`) keeps its `note_id`. |
| NM2 | The migration sets one `note_id` on each set of two or more trades with the same `books_id`, `ledger_transaction.created_at`, transaction date and cash account. |

### 5.2 Matching a note

| ID | Rule |
|---|---|
| NM3 | Among the candidates of a bank account, a note whose trades have two or more cash postings on the account that no record confirms is one candidate: amount = sum of those postings (buys negative, sales positive), date = note date, description = the first trade's. Those trades are not candidates one by one. Score, A100 and review apply unchanged. |
| NM4 | A record linked to a note confirms every cash posting of the candidate: each posting carries the record, with the status a one-posting link gives. `ingestion_external_record.transaction_id` names the first trade in note order. The unique index of `external_record_id` becomes a plain index; a record confirms one or more postings of one account (I07 as amended). The resolution `match` of a note candidate requires the sum to equal the line, else 422 `match_amount` with the difference, and changes no trade: A101 (the institution's amount and date win) applies to a one-posting candidate only. |
| NM5 | Undo of `linked` (A148) releases every posting of the record; the record returns to review (probable) with the note as candidate. |
| NM6 | A bank change of amount or date of a record linked to several postings is not followed: the record goes to review (changed). |
| NM7 | A correction or void of a trade whose cash posting a record confirms follows the rule of a confirmed posting today, posting by posting. |

### 5.3 Review of a line that may pay trades

| ID | Rule |
|---|---|
| NM8 | A line in zone New on an account that holds, within 10 days of the line, a trade cash posting of the line's sign that no record confirms, goes to review (probable, reason `unlinked_trades`) instead of being created. |
| NM9 | The resolution `match` takes `transaction_ids` (1 to 50) as an alternative to one candidate. Each transaction has a posting on the record's account that no record confirms; their sum equals the line's amount, else 422 `match_amount` with the difference. The postings link as NM4. |
| NM10 | The review of such a line lists the unconfirmed postings of the account within 10 days, with a checkbox each, the running total and the line's amount; confirmation is enabled when they are equal. |

### 5.4 Withdrawal of A272 and repair of the owner's book

| ID | Rule |
|---|---|
| NM11 | Commits `6b13272c8` and `85fe028da` are reverted by new commits: code, wording `NoteSettlement`, guide text. The A272 spec is marked withdrawn. S701 to S703 are withdrawn with it. |
| NM12 | After NM1 to NM7 ship, the owner's book returns to the bank's facts: the six trades of 2026-11-26 pay Banco Inter again (settlement dates kept: 2026-11-27 for B5P211 and LFTB11, 2026-11-30 for the others); the settlement of −627.69 (`01a2204d-dc4d…`) is voided; the line of −360.04 is released from `01a21f52-eb36…`, which is voided, and confirms the two trades; the account Caixa is closed again on 2026-11-22. Each step goes through the API; a step the API does not cover runs as one reviewed SQL transaction listed in the plan. The final check: one posting per trade on Banco Inter, the record confirming both trades, Caixa with no live posting. |

## 6. Scenarios

| ID | Rules | Scenario |
|---|---|---|
| S704 | NM1, NM3, NM4 | The note of S427 paid from a checking account of the brokerage's institution, then a statement line of −6007.51 two days later: the import matches 1 and creates 0; both cash postings carry the record. |
| S705 | NM3 | Two notes of the same day (−6007.51 and −1000.00) and two lines: each line confirms its note. |
| S706 | NM3 | A note with a buy of −3000.00 and a sale of +1200.00: a line of −1800.00 confirms both. |
| S707 | NM5 | Undo of S704's link: both postings released; the record in review with the note as its candidate. |
| S708 | NM8, NM9 | Two trades recorded by `POST /trades` (−300.00, −200.00) and a line of −500.00: review, reason `unlinked_trades`, created 0. `match` with both ids links them; with one id, 422 `match_amount`. |
| S709 | NM8 | A line of −45.90 on an account with no unconfirmed trade within 10 days: created, as today. |
| S710 | NM2 | The migration gives one `note_id` to two trades of one `created_at`, date and cash account, and none to a trade alone. |
| S711 | NM3, NM4 | A note of −6007.51 and a line of −6007.53: review (probable) with the note as candidate; `match` is 422 `match_amount` (difference −0.02) and both trades keep their amounts. |
| S712 | NM6 | The bank changes the amount of S704's line: the record goes to review (changed); no trade changes. |

## 7. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | No regional value: matching reads no text of the line. |
| R2 | Any region: the rules are the same. |
| R3 | `unlinked_trades` is a value of the review reason, `^[a-z0-9_]{2,40}$`. |
| R4 | Does not apply: no extension point. |
| R5 | NM10 adds review texts: the reason, the running total, the difference. Each one has a catalog key in pt-BR and en. |
| R6 | The amounts of NM10 go through `useMoneyFormat()`; dates through `Intl`. |
| C1 | Sums are integers of minor units of the account's currency. |
| C2 | One account per sum, so one currency. |
| C3 | A foreign-currency account sums in its own currency; the trades' weights are not summed. |
| C4 | Amounts on screen from the records, through `useMoneyFormat()`. |
| T1 | Line, trade and note dates are calendar dates of the book. |
| T2 | Does not apply: no business-day count added. |
| B1 | Does not apply: no table. |
| B2 | `resolveExternalRecord` keeps `write`; an HTTP test covers `transaction_ids` for each role. |
| B3 | Does not apply: no setting. |
| D1 | `ledger_trade.note_id` enters the export; the archive version rises if the archive test requires it. |
| D2 | One goose migration: the column, its backfill (NM2), the plain index replacing the unique one. |
| D3 | A link is an automatic decision with its undo (NM5); a manual `match` is recorded as today. |
| D4 | Automatic link only for a note the owner recorded (NM3) under A100; any other case waits for review (NM8). Importing the same file twice creates nothing (dedup unchanged). |
| D5 | Does not apply: no diagnostic field. |
| S1 | `transaction_ids` in `RecordResolution` and `match_amount` change `api/openapi.yaml`; `tool_exposure_test.go` and the review tool follow; `match_amount` has an HTTP test (S708). |
| S2 | The review of NM10 follows the phone scope of the review screen. |
| S3 | The guide article of the review screen and `investment_operations` state NM3 and NM10. |
| S4 | The review tool of the assistant takes `transaction_ids`. |
| X1 | S704 to S712 through `internal/apitest`. |
| X2 | S704 runs once more in a book of `apitest.Neutral`; the rules read no regional value. |

## 8. Left to the builder

- The order of the work: NM11 first; NM1 to NM7 (S704 to S707, S710 to S712); NM8 to NM10 (S708, S709); NM12 last.
- Where the note candidate is built: in `ListUnlinkedPostings` or in `app.unlinked`, as long as the trades of a note are never also single candidates.
- The rule of NM7 as the code holds it today, read before the change and kept.
