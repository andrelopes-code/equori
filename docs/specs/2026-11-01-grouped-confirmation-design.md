# Grouped confirmation (amendments A167 to A172)

Phase P12 of `docs/domain/09-roadmap.md`, section 9.4.2. Amends A98 to A101 of `2026-10-20-record-matching-design.md`, the statement amount of A89 and invariant I07 (P5b amendment A27). Scenarios S234 to S240.

## Goal

An entry the owner records before its sync is confirmed by the institution's lines even when the institution reports it as several lines. The exit criterion of P12 gains: "an entry recorded before its sync that the institution reports as several lines ends with no duplicate".

An **entry** is a transaction without an external record. A **line** is an external record. A **group** is two or three lines that together confirm one entry.

A100 assigns lines to postings one to one. No rule joins one posting to several lines.

## Evidence

Measured on the owner's development database on 2026-11-01 (Nubank Gold card, synced through Meu Pluggy):

| Fact | Value |
|---|---|
| Entry recorded by the owner on 2026-10-30 at 18:12 UTC | `Assinatura Anthropic Claude`, −118.40, origin `manual`, no external record |
| Lines created by the sync of 2026-10-31 at 19:16 UTC | `Anthropic* Claude Sub` −114.40 dated 2026-10-30, `IOF gerado por compra em moeda estrangeira` −4.00 dated 2026-10-31, both pending |
| Score of the entry against the first line (A99) | amount within the blocking bound −2, same day +3, description overlap +2: 3, below the review threshold 4 (A100) |
| Decision of A100 | zone New: both lines were created |
| Statement due 2026-12-07 | 657.47 in equori; 539.07 at the institution; difference 118.40, the entry |
| Postings without a line, of transactions with origin `manual`, on accounts that have lines | 1288 |
| Of those, postings equal to the sum of two created lines of the same account (lines at most 3 days apart, posting at most 10 days from the first line) | 1, the entry above |

## Owner decisions of 2026-11-01

| Question | Choice |
|---|---|
| A group links without review | Never. A group always waits in review. |
| Scope of the first version | One entry confirmed by two or three lines. Several entries confirmed by one line are out of scope. |

## A167 Group

Matching looks for a group when a line of the batch reaches zone New (A100). The group is a set of two or three lines that meets all of these conditions with one entry:

1. The lines are on the entry's account and carry the entry's sign.
2. The sum of the lines' `amount` equals the entry's posting amount exactly. `original_amount` is never read.
3. Each line is within `MatchHardLimit` days of the entry's date.
4. No two lines are more than 3 days apart (the band "1 to 3 days" of A99).
5. At least one line, the **anchor**, is within the blocking bound of A98 of the entry's amount.
6. At least one line is a line of the batch in zone New. The others are lines of the batch in zone New or lines whose record is `created`, whose transaction has version 1 and is not reconciled.

The entry meets the conditions of A98 for a posting: its account, no external record, a non-voided transaction. Only entries of an account with a feed (A103, condition 4) are considered.

## A168 Decision

| Groups found | Outcome |
|---|---|
| One group for the entry, and no other group contains one of its lines | Each line of the batch in the group takes state `needs_review`, reason `group`, and lists the entry's transaction as its candidate. No transaction is created for it. |
| Two or more groups for the entry, or a line in groups of two entries | No group is proposed. The lines follow A100 zone New. |
| More than 40 lines pass conditions 1 and 3 for the entry | No group is searched for the entry. The lines follow A100 zone New. |

The limit of 40 lines is a constant of package `domain`. The search is bounded by 40 over 3, 9880 combinations, per entry.

A line of the batch outside a group keeps the decision A100 gives it.

A group never links an entry in the sync. The review is the only way to confirm one.

## A169 Resolution

`POST /external-records/{id}/resolve` on a line in review `group`:

- `match`: the group is confirmed in one database transaction.
  - The entry's transaction gets a new version (A3) with reason `matched to the institution's lines`.
  - The entry's account posting is replaced by one posting per line, with the line's amount and the line's `external_record_id`. A posting is pending when its line is pending. The transaction takes the date of the earliest line; a transaction has one date. Each posting takes the statement of its line's bill (A36, A136).
  - The entry's other postings stay. The sum of the new postings equals the replaced one, so no category part changes. The owner's description, payee, categories and tags stay.
  - Each line already `created` is re-pointed to its new posting and its created transaction is voided with reason `grouped with the owner's entry`. Every other line of the group becomes `matched`.
- `create`: every line of the group is created as its own transaction. The entry stays unconfirmed.
- `discard`: the chosen line is discarded. Every other line of the group is created.

A resolution of one line applies to the whole group. The record of a line `created` before the review keeps its state until a `match`.

## A170 Confirmed and awaiting amounts

The amount of an open statement (A89) gains two parts for an account with a feed (A103, condition 4):

- the **confirmed amount**: the sum of the statement's non-voided postings of the account that carry an external record, a pending line included;
- the **awaiting amount**: the sum of those that carry none.

Their sum equals the statement amount. An account without a feed reports neither part.

The awaiting amount is not an error: an entry recorded a minute ago is awaiting. The attention state of an unconfirmed entry (A103, A133) is unchanged. The institution's reported total, when present, stays authoritative over the sum of the lines, and the residual difference is shown, never absorbed.

pt-BR text of the awaiting amount: "aguardando o banco".

## A171 Order of arrival

Where no group is found, A170 shows the entry as awaiting the institution. The order in which the lines arrive does not change the outcome:

- Both lines in one batch: both wait in review `group`.
- The anchor in an earlier batch, created before the second line existed: the later line waits in review `group` and lists the entry. The earlier line is re-pointed at the `match`. Until then the statement counts both the entry and the created anchor, and A170 shows the entry as awaiting.

## A172 One record per posting

I07 said that a transaction holds at most one record per account. A confirmed group (A169) holds one record per posting on the account. I07 now reads: an external record confirms at most one posting, and a posting is confirmed by at most one record. The partial unique index `ingestion_record_transaction_idx` on `(books_id, transaction_id, account_id)` becomes a non-unique index with the same columns and condition. The column `ledger_posting.external_record_id` and the unique index `ledger_posting_external_record_idx` hold the invariant. The ingestion schema test of the former rule is removed and a ledger schema test violates the new one with direct SQL.

## Regions

No rule reads a regional value. The sum is over `amount`, in minor units of the account's currency. No word, fee name, tax, country or institution is read. The values 3 days and 40 lines are constants of package `domain`, not regional. `docs/contributing/regions.md` is unchanged.

## Contract

- `ExternalRecord.review_reason` adds `group`. `ExternalRecord.group_record_ids`, optional, lists the other lines of the group and appears only with that reason.
- `StatementSummary` and `StatementDetail` gain `confirmed_amount` and `awaiting_amount`, both optional.
- `Problem.code`: none new.
- Review text of `group`, pt-BR: "Este lançamento parece ser a soma destas linhas do banco. Confirme para dividi-lo nas linhas do banco."

## Scenarios

| ID | Scenario |
|---|---|
| S234 | Grouped confirmation. A card entry of −118.40 dated 2026-10-30 with a category. One sync returns −114.40 dated 2026-10-30 and −4.00 dated 2026-10-31. Both lines wait in review `group` with the entry as candidate, no transaction is created, and the statement amount is 118.40. `match` leaves one transaction with two card postings of −114.40 and −4.00, each with its line, the same category and description, and a statement amount of 118.40. |
| S235 | Sum not exact. The entry of S234 and lines of −114.40 and −3.90. No group is proposed and both lines are created. The statement amount is 236.70, the confirmed amount 118.30 and the awaiting amount 118.40. |
| S236 | Lines in two syncs. The entry of S234. The first sync returns −114.40 and creates it. The second returns −4.00: the line waits in review `group` and lists the entry, and the statement amount is 232.80 until `match`. `match` voids the created transaction, re-points its record to the entry's posting and leaves a statement amount of 118.40. |
| S237 | Two groups. Two entries of −118.40 dated 2026-10-30 and the lines of S234. No group is proposed and the lines are created. The confirmed amount is 118.40 and the awaiting amount 236.80. |
| S238 | Group dissolved. The review of S234. `discard` on the −4.00 line creates the −114.40 line as a transaction and leaves the entry awaiting. `create` on either line creates both and leaves the entry awaiting. |
| S239 | Bound. 41 lines within 10 days of an entry of −118.40, among them −114.40 and −4.00. No group is searched and the lines are created. The awaiting amount shows the entry. |
| S240 | Account without a feed. A card with entries and no mapped external account or imported file reports neither `confirmed_amount` nor `awaiting_amount`. |

Each scenario has a test through `internal/apitest` that fails on the current code. The search of A167 has property tests in package `domain`: order of the lines, sign, ties, the limit of 40 and the window of 3 days.

## Out of scope

- Several entries confirmed by one line.
- A group of four or more lines.
- Automatic linking of a group.
- The entry of 118.40 already in the owner's database: the owner voids it.

## Left to the plan

The storage of the group, the port that replaces a posting by several, whether the ledger accepts two postings of one account in one transaction (installments and splits suggest it does; if not, a ledger change comes first), the query of eligible lines, the web components of the group review and of the awaiting amount, and the en catalog text.

## Owner task

After two weeks of syncs, count the lines in review `group` that the owner resolved with `create` or `discard`. Each one is a proposed group that was not an entry's confirmation.
