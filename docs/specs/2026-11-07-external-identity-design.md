# External identity of aggregators and statements

Amendments A211–A215. Scenarios S340–S348. Amends D4 and A94 of `2026-10-18-pluggy-reserved-balances-design.md`, and S70 and S90 of `docs/domain/06-scenarios.md`.

## 1. Problem

A name a source reports is text the institution or the owner changes at will. Reproduced defects:

| ID | Case | Observed before this spec |
|---|---|---|
| F1 | A bank line moves money into a reserved balance and no reserve is recognized; the amount is within the yield bound | The line becomes an ordinary transaction and the reserve books the same amount as yield. No difference stays open. |
| F2 | A new reserve, pending or ignored, takes the former name of a mapped reserve | The line is booked to the mapped reserve. |
| F3 | The aggregator stops listing a mapped account | The sync stops at that account; the accounts after it read nothing; the connection stays `ok`. |
| F4 | The new external account of that account maps to the same ledger account | 422 until the owner ignores the old one. |
| F5 | A file line returns with another description or another FITID | A second transaction. |
| F6 | A late line names a former name that another mapped reserve now holds | The line follows the current holder or the ordinary pipeline, regardless of its date. |
| F7 | The name differs in case, spacing or Unicode form; an intermediate name was never stored; two reserves share a name | An ordinary transaction, which then falls under F1. |

## 2. Principle

An identifier decides. A name resolves a line only when one candidate exists on the line's date. Any other case waits for the owner and books nothing that a later balance could turn into yield.

## 3. A211: contract of an aggregator

The `Aggregator` port states:

- `ExternalAccount.ExternalID` is stable while the institution keeps the account, and a rename keeps it.
- `Accounts` reports the current name.
- `ReadAccount` returns `ErrAccountGone` for an account the item no longer lists.
- `NormalizedRecord.ReserveMove` is true for a line the source states moves money between a bank account and a reserved balance.
- `NormalizedRecord.ReserveExternalID` is the reserve's external id when the source relays it. `ReserveName` is the name otherwise.

`internal/ingestion/internal/aggregator/aggregatortest` runs these clauses against any aggregator through a `Backend` that each aggregator implements over its fake server. Step 10 of `docs/contributing/regions.md` requires it.

Region-dependent values: the wording and the operation type of a reserve line are the institution's and live only in the adapter of the aggregator (extension point `Aggregator`). `internal/ingestion/internal/app` and `domain` hold no wording. The texts of section 5 and 6 live in the message catalog of each language.

## 4. A212: resolving a reserve line

`domain.ResolveReserve` takes the line and every reserved balance of the connection, mapped or not.

Two names are equal when their keys are equal: NFC form, folded by `platform/textfold`, inner spaces collapsed. The fold has no language parameter, so the key is the same in every region.

An external account stores two dates for its current name:

| Column | Meaning |
|---|---|
| `name_from` | Last date the name was known not to apply: the date of the connection's previous sync. Null when no bound exists (accounts of the first listing and rows older than this migration). |
| `name_on` | Date the name was first listed. Null under the same conditions. |

Candidates of a line naming `N` dated `d`:

1. With `ReserveExternalID`: the reserve holding that id, and no other.
2. A holder: a reserve with current name `N` and `d` on or after its `name_from`.
3. A former holder: a reserve with `N` in `former_names`, when no reserve holds `N` as its current name, or when `d` is on or before the `name_on` of a reserve holding `N`.

Outcome:

| Candidates | Outcome |
|---|---|
| One, mapped, `d` on or after `sync_from` | Transfer to that reserve |
| One, mapped, `d` before `sync_from` | Ordinary line (S70) |
| One, pending or ignored | Ordinary line. The owner does not track that reserve. |
| Two or more, none mapped | Ordinary line |
| Two or more, at least one mapped | Review |
| None, and a mapped reserve has `sync_from` on or before `d` | Review |
| None, and no such reserve | Ordinary line |

A row older than this migration has null dates, so a current holder excludes a former holder as under A94.

## 5. A213: a line that waits

A line with outcome review that the matching pipeline would create waits with `review_reason` `reserve`. A line the pipeline links to an entry links as before: the owner's entry already holds the movement.

While a line of the connection waits with reason `reserve`, a reserve of that connection asserts its balance without yield: the difference stays open. A later sync with no such line decides the open assertion again (A77).

`create` records the line, and `POST /transactions/{id}/transfer` turns it into a transfer (S47). `discard` leaves it out. A waiting line is not re-resolved when a later sync lists more names.

English: "This line moves money to a set-aside balance that could not be identified with certainty. Create it and turn it into a transfer to the right balance, or discard it."

Portuguese: "Esta linha movimenta um saldo separado que não foi identificado com certeza. Crie e transforme em transferência para o saldo certo, ou descarte."

## 6. A214: an account the institution stopped listing

`gone_since` on the external account is the date a listing first lacked it. A later listing that holds it clears the column.

A sync skips a mapped account with `gone_since` that is not a reserved balance, and a read that returns `ErrAccountGone` is treated the same way. The other accounts sync and the connection ends without a last error. A reserved balance keeps D2: it syncs without a balance. `translate` of the Pluggy port returns `ErrAccountGone` unchanged, so its message is not "did not answer".

`MapAccount` to a ledger account held by a gone external account of the same connection ignores the old one and maps the new one in one database transaction. A ledger account held by a listed external account keeps the 422.

`ExternalAccount.gone_since` is in the API. The accounts table of a connection shows it:

English: "No longer listed by the institution". Portuguese: "A instituição não lista mais esta conta".

## 7. A215: a line that may repeat a stored one

A line the pipeline would create waits with `review_reason` `duplicate` when a stored record of the same account has the same date and amount, is `created` or `matched`, and its key was not claimed by the same read. Each stored record holds back one line, in line order. A stored record whose line returns in the same read proves the new line is another line.

Scope: a file import considers every stored record. A sync considers only records of file batches, because a sync already withdraws an aggregator line it stopped returning (A38).

`create` keeps the line as a new transaction; `discard` drops it. A record already linked cannot be matched twice, so the line offers no candidate.

English: "A transaction with this date and amount is already recorded under another name or id. Discard this line if it is the same; create it if there were two."

Portuguese: "Já existe um lançamento com esta data e valor, com outro nome ou identificador. Descarte se for o mesmo; crie se foram dois."

## 8. Schema and archive

Migration `00091`: columns `name_from`, `name_on` and `gone_since` on `ingestion_external_account`; reasons `reserve` and `duplicate` in the check of `review_reason`. Archive version 11: the step writes null into the three columns (ADR 021, V2).

## 9. Scenarios

| ID | Scenario |
|---|---|
| S340 | A reserve line naming a mapped reserve with another case, spacing or Unicode form books a transfer (F7). |
| S341 | A new pending or ignored reserve holds the former name of a mapped reserve: a line inside its window waits, a line after its window is ordinary, and the mapped reserve receives neither (F2). |
| S342 | A line dated before the new holder's `name_from` goes to the former holder; a line inside the window waits; a line after `name_on` goes to the holder (F6). |
| S343 | An unrecognized reserve line within the yield bound waits; the reserve books no yield and the difference stays open; after `create`, the transfer and a later sync, the assertion reconciles (F1). |
| S344 | An account no longer listed does not stop the others; the connection has no last error; `gone_since` is set and a later listing clears it (F3). |
| S345 | Mapping the new external account to the ledger account of a gone one replaces it; a reread line creates no second transaction (F4). |
| S346 | A file line with another description, another FITID or a FITID it lacked waits with reason `duplicate`; two distinct lines of one file both create (F5). |
| S347 | A sync line repeating a line of a file batch waits with reason `duplicate` (A215). |
| S348 | The conformance suite passes for each aggregator (A211). |
