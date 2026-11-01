# Reliable bank connection (amendments A143 to A153)

Phase P12 of `docs/domain/09-roadmap.md`, section 9.4.2. Amends A36, A38 and A91 (P6 sync), A100 to A102 of `2026-10-20-record-matching-design.md` and A142 of `2026-10-30-repeated-card-payment-design.md`. Scenarios S203 to S213.

## Goal

The exit criterion of P12: "Replays of the October 2026 incidents (repeated payment, late line, amount changed after reconciliation, pending line posted under a new id) end with no duplicate and no unreported change; a connection without update past the spec's limit shows on the overview".

An **unreported change** is a fact the institution changed that equori neither applied nor listed in a sync summary (A149) or in review.

## Evidence

Measured on the owner's development database on 2026-10-31 (the Nubank Gold card and the Mercado Pago account of the owner, synced through Meu Pluggy since 2026-10-18):

| Incident | Data | Cause in code |
|---|---|---|
| Repeated payment | Two `created` records of the card payment of 784.65 dated 2026-10-05, both `POSTED`, kind `payment`, each with its transaction. | A91 compares lines of one read. A142 (delivered 2026-10-30) holds a later copy for review; the two records predate it. |
| Amount or date changed after reconciliation | 39 card records carry `unapplied_change`. 28 read "the aggregator reports the line posted on the bill due 2026-11-05; the posting is reconciled and keeps its status and statement", and the posting of each of the 28 already sits on the statement due 2026-11-05. 11 records in review `changed` report the same amount one day earlier on a reconciled posting. | `update` (`internal/ingestion/internal/app/importer.go`) writes the bill note whenever the ledger refuses a reconciled posting, also when the bill is the posting's own. `followLine` keeps the record's amount and date at the ledger's values, so `update` compares the next read with them and counts the same change in `updated` on every sync. |
| Pending line posted under a new id | No record shows it: the reads of those syncs were not kept. | `withdraw` (`internal/ingestion/internal/app/sync.go`) skips the first and the last day of the window. A pending card line dated on the sync day, replaced the same day by a posted line under a new id, stays linked; the posted line finds no unlinked posting and creates a second transaction. The next sync withdraws the pending line and its transaction stays. |
| Late line | No record shows it: the batches of the database start on 2026-10-18 with the first sync. | `SyncWindow` (`internal/ingestion/internal/domain/connection.go`) starts 30 days before the last synced date. A line the institution first reports with an older date is never read. |

Facts of the Pluggy API, read on 2026-10-31:

- `GET /v2/transactions` filters by `dateFrom`/`dateTo` or by `createdAtFrom` ("transactions created at or after this date"); `dateFrom` and `createdAtFrom` cannot be combined (<https://docs.pluggy.ai/reference/transactions-list-by-cursor>).
- "The field ProviderId is only returned in Regulado connections, consistent with the bank's ID. It would be the same for the same account connected as different items" (same page). Whether `providerId` survives the change from `PENDING` to `POSTED` is not documented.
- Pluggy retrieves up to 12 months of transactions (<https://docs.pluggy.ai/docs/transactions>).
- The item carries `consentExpiresAt`, null when the consent does not expire. After expiry or revocation, "all its data endpoints (accounts, transactions, etc) will return empty data"; the owner renews it by connecting again (<https://docs.pluggy.ai/docs/consents>).

## Owner decisions of 2026-10-31

| Question | Choice |
|---|---|
| Hours without an institution update before a connection shows as stalled | 72 |
| Automatic decisions that the summary offers to undo | Links, followed changes, withdrawals and re-identifications. Creations are listed without undo. |
| Days of notice before a consent expires | 14 |

## A143 Institution line id

The **institution line id** is the identifier the institution itself gives a line, as the aggregator relays it (Pluggy `providerId`). The aggregator line id (Pluggy `id`) stays the external id and the deduplication key (I10).

- `NormalizedRecord` gains `InstitutionID`; the Pluggy adapter fills it from `providerId` and adds it to the raw payload as `provider_id`. A source without it leaves it empty.
- The record stores it. A stored record without it receives it when its external id returns with one.
- In a sync, a line whose external id no record of the account holds is the stored record that carries its institution line id, when:
  1. the stored record is neither discarded nor in review;
  2. the stored record's external id is absent from the read;
  3. no other line of the read carries that institution line id.

  The record takes the line's external id and deduplication key (**re-identification**) and the line goes through the update path (A36, A102, A147). Re-identification runs before withdrawal (A38), so the record is not withdrawn.
- An institution line id carried by two lines of one read identifies neither line. Both go by external id.
- A142 keeps holding a repeated payment for review when the two lines carry different institution line ids or none. A repeat with the institution line id of the recorded payment is that payment, by the rule above.
- File imports are unchanged: an OFX `FITID` is already the institution's id.

Reason: the external id of Pluggy changes from a pending line to its posted line (A38, A91 exist for that case); the institution's own id, when present, joins the two without a score. Keeping the aggregator id as deduplication key leaves every stored key valid: the raw payloads of stored records lack `providerId`, so no backfill exists.

## A144 Late lines

Each sync of an account after its first also reads the lines the aggregator created since the previous read of that account: a second request with `createdAtFrom` set to the start of the previous read minus 1 hour.

- The external account stores the start instant of each read (`last_read_at`).
- A line of the second request dated inside the window repeats the date read and is merged by external id. A line dated before the mapping's start date (`sync_from`) is dropped. Every other line goes through the pipeline of the batch.
- Withdrawal (A38) reads only the lines of the date window.
- An aggregator without a creation filter returns no lines for the second request; A153 then bounds how late a line is read.

Reason: the window of A36 cannot reach a line the institution reports with a date older than its start. The creation filter returns that line on the first sync after the aggregator stores it, whatever its date. The 1-hour margin covers a line created while the previous read ran.

## A145 Window edges

A sync reads one day before the window's start and one day after its end, and withdraws over the whole window, its first and last days included.

Reason: the edge skip of A38 exists because the aggregator filters by its own calendar day. Reading one day beyond each edge covers that calendar shift; withdrawing on the sync day releases a pending line that a posted line replaced under a new id in the same read, so the posted line links its transaction (S207).

## A146 Empty read and expired consent

- A date read that returns no line, for an account that holds records in the withdrawal range, withdraws nothing. The batch records `read_empty`.
- A connection whose consent expiry is past is not synced and reads as `needs_owner`.

Reason: Pluggy returns empty data after a consent expires or is revoked. Without the rule, withdrawal releases every posting of the window.

## A147 Changes counted once, and only real ones

1. The record keeps the institution's last reported amount, date, status and bill (`reported_*`). A line is changed when it differs from that report. The ledger's values no longer take part in the comparison, so a change counts once.
2. A status or bill that the ledger already holds is no change: a reconciled posting already on the statement of the line's bill, or a reconciled posting of a posted line.
3. A change of date alone on a reconciled card posting is applied when the posting keeps its statement (decision `followed`, A148). The amount and every statement total stay as reconciled.
4. Every other change that the ledger does not take puts the linked record in review `changed`: an amount on a reconciled posting, a date that moves a reconciled posting off its statement, a date on a reconciled posting of a bank account, and a payment type the ledger refuses (A88). Today the last case and a reconciled bill change only write a note.

Reason: rule 2 removes the 28 notes measured, which describe no change. Rule 3 applies the 11 measured date shifts, which change no balance and no statement; the institution's date is the fact. A date on a bank account moves the posting relative to its balance assertions, so it waits for the owner.

## A148 Automatic decisions and undo

An **automatic decision** is a sync outcome that joins a line to an existing ledger entry or changes or releases one. Each record stores its last automatic decision, the batch that made it, and the values an undo restores.

| Decision | Made by | Undo |
|---|---|---|
| `linked` | Zone link of A100 | The record releases its posting and returns to review with reason `probable` and fresh candidates (A140). |
| `followed` | A102 correction of an unreconciled posting; A147 rule 3 | The transaction returns to its amount and date before the decision, as a new version (A3). The record waits in review `changed`. |
| `withdrawn` | A38, including a pending line superseded under A91 | The record returns to its state before withdrawal, linked to its posting, and is **kept**: withdrawal skips a kept record. |
| `re_identified` | A143 | The record returns to its previous external id and deduplication key. The line becomes a new record in review with reason `probable` and fresh candidates. |

- An undo applies while the record's last decision is the one undone. A record without an undoable decision returns `no_decision` (409): one already undone, resolved or replaced by a later decision, and one never decided.
- `POST /external-records/{id}/undo`; tool `manage_imports` action `undo_decision`; an entry in `internal/server/tool_exposure_test.go`.
- A created transaction carries no undo (owner decision). The summary lists it; the owner voids a wrong one on its page.

Reason: 9.4.1 states that every automatic decision appears in the sync summary with an undo. A kept withdrawn record follows the owner's statement that the line exists.

## A149 Sync summary

A **sync run** is one call of `sync` for a connection, manual or scheduled; its batches carry one `sync_id`.

- The summary of a sync run lists, per account, the counts of the batch and every record that the run decided (A148), placed in review, or re-identified. A record decided by the run carries its undo.
- The batch counts gain `re_identified`. `matched` keeps counting links.
- `GET /connections/{id}/syncs` returns the last 10 sync runs of the connection that hold a decision, a review or a creation, newest first. The connection page shows them.
- A sync run that changed nothing is not listed.

Reason: the batch counts exist (`ImportCounts`), but no screen lists the records behind them; a record decided by a later sync (A36, A38) belongs to that sync's batch, not to the batch that created it.

## A150 Stalled connection

A connection is **stalled** when the aggregator reports it ready and either the item's last update (`last_item_update_at`) or the last completed sync (`last_synced_at`) is more than 72 hours old (owner decision).

- `Connection.state` adds `stalled`. Precedence: `needs_owner`, `failed`, `stalled`, `consent_expiring`, `ok`.
- The overview attention item `connections` counts every state other than `ok` (`web/src/features/overview/attention.ts`), so a stalled connection shows on the overview. The connection page names the hours since the last update.
- The limit is the constant `StallAfter` of package `domain`.

Reason: the scheduler syncs only an item with data newer than the last sync (A43), so an item that stops updating while ready produces no error and no sign today. A manual sync advances `last_synced_at` without new data; the item's last update stays the measure of the institution's data.

## A151 Expiring consent

- The connection stores the consent expiry the aggregator reports (Pluggy `consentExpiresAt`), null without one, and the API returns it as `consent_expires_at`.
- From 14 days before the expiry (owner decision), the state reads `consent_expiring`. The connection page names the expiry date and the portal where the owner renews the consent (`portal`).
- After the expiry, A146 applies.

## A152 The assistant names stale and unreconciled accounts

The system prompt of each chat turn (`internal/assistant/internal/app/prompt.go`) lists:

- each account whose connection is not `ok`, with its state and the date of the institution's last update;
- each account with an open difference or with unconfirmed entries (A133).

The guide adds one rule: an answer that states a figure of a listed account names the account and the reason in one sentence. Without listed accounts, the block is absent.

- The assistant module declares the port that reads the list; `internal/server` composes it from ingestion and ledger (ADR 002).
- The MCP instructions stay static. An MCP client reads the state through `get_imports` view `connections`, which reports `stalled` and `consent_expiring`.

Reason: the guide forbids figures that no tool returned in the turn. A figure of an account with stale data or an open difference is a returned figure that misleads; the prompt names the condition without a tool call.

## A153 Periodic re-read

Once every 7 days per mapped account, the sync reads from the later of the mapping's start date and 90 days before today, instead of the 30-day window. Update (A36, A147), withdrawal (A38, A145, A146) and re-identification (A143) apply over that window. The external account stores the date of that read (`last_deep_read_on`).

Reason: A144 reads new lines of any date, but not a change or a removal of a line older than 30 days. 90 days covers three card cycles and stays within the 12 months Pluggy keeps. The cost is one longer read per account per week.

## Regions

No rule reads a regional value. `providerId` and `consentExpiresAt` stay in the Pluggy adapter; the domain reads an institution line id and a consent expiry, both optional for any source. The values 72 hours, 14 days, 90 days and 7 days are constants of package `domain`, not regional. `docs/contributing/regions.md` is unchanged.

## Contract

- `ExternalRecord`: `decision` (`linked`, `followed`, `withdrawn`, `re_identified`), optional; `review_reason` unchanged.
- `ImportCounts`: `re_identified`. `ImportBatch`: `sync_id`, `read_empty`.
- `Connection`: `state` adds `stalled` and `consent_expiring`; `consent_expires_at`, optional.
- Operations: `undoExternalRecordDecision` `POST /external-records/{id}/undo`; `listConnectionSyncs` `GET /connections/{id}/syncs`.
- `Problem.code`: `no_decision` (409).
- Review text of `changed`, pt-BR: "O banco mudou esta linha depois da conciliação. Corrija a transação ou mantenha o valor conciliado."

## Scenarios

| ID | Scenario |
|---|---|
| S203 | Repeated payment. A card payment of 784.65 of 2026-10-05 with institution line id `p-1` is recorded. The next sync returns, under a new external id, a payment of 784.65 of 2026-10-05 with `p-1`, and not the first id: the record is re-identified, the batch counts one `re_identified` and none created, the card holds one payment. With institution line id `p-2`, S185 holds: the line waits in review `repeated`. |
| S204 | Late line. A card synced daily; the sync of 2026-10-20 reads the window from 2026-09-19. A line of −120.00 dated 2026-09-01, created by the aggregator after the read of 2026-10-19: the creation read returns it and the batch creates it. The sync of 2026-10-21 counts it ignored. |
| S205 | Amount changed after reconciliation. A reconciled card posting of −50.00 whose line reports −55.00: the record waits in review `changed`, the posting keeps −50.00, the summary lists it. The next sync, still −55.00, counts no update. |
| S206 | Date changed after reconciliation. A reconciled card posting of −7.12 of 2026-10-17 whose line reports 2026-10-16 on the same statement: the posting moves to 2026-10-16, decision `followed`, no review. Undo returns it to 2026-10-17 and the record waits in review `changed`. The same change on a checking account waits in review `changed`. |
| S207 | Pending line posted under a new id. A pending card line of −30.00 of 2026-10-29 is recorded at 10:00. The sync of 23:56 on 2026-10-29 returns only a posted line of −30.00 of 2026-10-29 under a new id, without institution line id: the pending record is withdrawn and the posted line links its transaction. The card holds one transaction. |
| S208 | Spurious bill note. A reconciled card posting on the statement due 2026-11-05 whose line turns posted on the bill due 2026-11-05: no note, no review, `updated` 0. |
| S209 | Empty read. An account with 5 records in the window; the read returns no line: nothing is withdrawn and the batch records `read_empty`. A connection whose consent expired on 2026-10-30 is not synced on 2026-10-31 and reads `needs_owner`. |
| S210 | Stalled connection. Item last update 2026-10-28 09:00, ready; at 2026-10-31 10:00 (73 hours) the connection reads `stalled` and the overview counts it; at 2026-10-31 08:00 (71 hours) it reads `ok`. |
| S211 | Expiring consent. Consent expiry 2026-11-13; on 2026-10-31 (13 days) the connection reads `consent_expiring`; on 2026-10-29 (15 days) it reads `ok`. |
| S212 | Undo. A linked line is undone: it waits in review `probable` with its former posting among the candidates. A withdrawn line is undone: it is linked and kept, and the next sync that misses it leaves it linked. A second undo of either returns `no_decision`. |
| S213 | Periodic re-read. A line of −80.00 dated 60 days ago changes to −85.00. The daily sync does not read it; the weekly re-read does and corrects the unreconciled transaction, decision `followed`. |

Each scenario has a test through `internal/apitest` that fails on the current code; `no_decision` has its own HTTP test.

## Out of scope

- The two repeated records of 784.65 already in the owner's database: the owner voids one.
- A summary block on the overview; the connection page holds the summaries.
- Webhooks of Pluggy (`transactions/created`, `/updated`, `/deleted`): equori serves a self-hosted instance that the aggregator may not reach.
- Matching weights and windows of A98 to A100.

## Left to the plan

The migration columns and their names, the shape of the stored undo values, the port of A152 and its query, the aggregator port change for the creation read, the web components of the summary and of the connection states, and the en catalog text.

## Owner task

None. Both A143 and A145 stay whichever of them joins pending and posted lines at Pluggy; real syncs are checked by S261 (`2026-11-01-test-release-design.md`).
