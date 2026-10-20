# Record matching by score

Amendments A98–A104 and scenarios S91–S97 of `docs/domain/06-scenarios.md`.

## Intent

The owner may record a transaction by hand before its line arrives from an aggregator or a file. The line and the manual entry must become one transaction, with the institution's facts and the owner's classification. Reconciliation of balances (A7, A8) and of card statements (A85–A92) rests on this: a missed match is a duplicate, and a wrong match hides a charge.

Matching today (5.7, `ExternalRecordMatched`) links a record to an unlinked posting of the same account with the identical amount within ±3 days; one candidate is linked, several go to review. It misses an entry typed with a different amount (7.00 against 7.12), an entry dated more than 3 days away, and it ignores the description, so two rides of the same amount can swap. A change of amount after the match is only described on the record (A36), and nothing lists manual entries the institution never confirmed.

## Model

Probabilistic record linkage (Fellegi and Sunter, "A Theory for Record Linkage", JASA 1969): each field comparison adds a weight, the log of how much more often the outcome occurs between records of one transaction than between records of two; the sum is compared with two thresholds. At or above the upper one the pair is linked, below the lower one it is not, and between them the pair goes to review. GnuCash's import matcher applies the same rule with integer scores (auto-clear, display and auto-add thresholds, a date threshold and a hard date limit); YNAB links identical amounts within 10 days; Actual Budget searches ±7 days with the identical amount and prefers the same payee.

Weights here are fixed integers, documented and tested, not estimated from data: the dataset of one owner is too small for estimation, and fixed weights keep each decision explainable.

## A98 Blocking

A record is compared only with postings that are on the record's account, carry no external record, belong to a non-voided transaction, have the record's sign, are dated within ±10 days of the record (the hard limit) and whose absolute amount is within 20% of the record's, or within 1.00 of the account's currency for amounts under 5.00.

## A99 Comparison weights

| Field | Outcome | Weight |
|---|---|---|
| Amount | identical | +6 |
| | within 1% | +3 |
| | within the blocking bound | −2 |
| Date | same day | +3 |
| | 1 to 3 days | +2 |
| | 4 to 10 days | −1 |
| Counterparty | same payee | +4 |
| | both have a payee, different | −6 |
| | no payee on one side, description tokens overlap ≥ 0.5 | +2 |
| | no payee on one side, no shared token | 0 |

The record's payee is the one classification resolves for its raw description (payee aliases, A22) before rules. Description tokens are the words of the normalized text (A26) of three or more letters, without digits; overlap is the Jaccard index.

## A100 Decision

| Zone | Condition | Outcome |
|---|---|---|
| Link | best score ≥ 8, amount identical, and no other candidate within 3 points | the record confirms the posting, as today |
| Probable | best score ≥ 4, otherwise | `needs_review` with reason `probable` and the scored candidates |
| Ambiguous | two or more candidates ≥ 8 within 3 points | `needs_review` with reason `ambiguous` |
| New | no candidate ≥ 4 | the pipeline creates a transaction |

An identical amount on the same day with no payee conflict scores 9 and links, so S32 holds; S35 (two identical entries one day apart) is ambiguous. Records of one batch are assigned one to one, highest score first; a posting taken by a higher score is not a candidate of a lower one (I07).

## A101 Review and resolution

A record in review lists its candidates with score and the outcome of each comparison. `POST /external-records/{id}/resolve` with `match` links the chosen candidate as today. When the amount or date differs, the transaction is corrected to the institution's amount and date with reason `matched to the institution's line`, as a new version (A3); the owner's description, payee, categories and tags stay, and category parts are scaled to the new amount, the last part taking the remainder.

## A102 Changes after the match

A later change of amount or date of a linked aggregator line (A36), matched or created, corrects the transaction the same way when none of its postings is reconciled. Otherwise the change stays described on the record (`unapplied_change`) and the record, still linked, carries review reason `changed`: the resolutions of a record in review (match, create, discard) do not apply to a linked one. An installment keeps the amount its plan fixes.

## A103 Unconfirmed entries

A posting on an account with a mapped external account or a file import, without an external record, dated more than 10 days before the account's last synced or imported date and after the mapping's start date, is unconfirmed. `GET /accounts/{id}/unconfirmed` lists them oldest first; the account list reports the count. An unconfirmed entry is not an error: it may be a cash adjustment or a line the institution has not sent.

## A104 Scope

Matching by score applies to file imports and aggregator syncs alike. Pairing of transfers (A29) and realization of schedule occurrences (A51) keep their own rules. A record of a line the institution reports as a reversal (`ESTORNO`) never matches a charge.

## Scenarios

| ID | Scenario |
|---|---|
| S91 | A manual card entry "Uber" −7.12 on 2026-10-20 with payee Uber, and a synced line "Dl *Uberrides" −7.12 of 2026-10-20 whose alias resolves to Uber: score 13, linked; one transaction, the owner's category kept. |
| S92 | A manual entry −7.00 on 2026-10-20 and the line −7.12 of the same day: amount within the bound (−2), same day (+3), same payee (+4) = 5, probable; resolving `match` corrects the entry to −7.12 with a new version and keeps its category. |
| S93 | Manual rides −7.12 on 2026-10-18 and −7.12 on 2026-10-20, both payee Uber, and a line −7.12 of 2026-10-20: scores 12 and 13, within 3 points, ambiguous. |
| S94 | A manual entry −45.90 "Farmácia" with payee Drogasil and a line −45.90 of the same day whose alias resolves to iFood: 6 + 3 − 6 = 3, new transaction. |
| S95 | A manual hotel entry −800.00 on 2026-10-10 and a line −800.00 of 2026-10-17: 6 − 1 + 4 = 9 with the same payee, linked. |
| S96 | A line linked to a manual entry changes from −7.12 to −7.15 on a later sync: the transaction is corrected to −7.15; on a reconciled posting the record returns to review with reason `changed`. |
| S97 | A manual entry −30.00 of 2026-09-20 on a card synced daily since 2026-09-01 that no line confirmed is listed by `GET /accounts/{id}/unconfirmed` on 2026-10-20. |

## Left to the plan

The ledger port that corrects a matched transaction, the shape of the scored candidates in `ExternalRecord`, and the query for unconfirmed entries.

## Sources

- Fellegi, I. P. and Sunter, A. B. (1969). A Theory for Record Linkage. Journal of the American Statistical Association 64(328).
- GnuCash import settings: <https://code.gnucash.org/docs/STABLE/struct__genimportsettings.html>
- YNAB file-based import: <https://support.ynab.com/en_us/file-based-import-a-guide-Bkj4Sszyo.md>
- Actual Budget fuzzy-match window: <https://git.cs.vt.edu/danieljk/actual-vt-capstone/-/commit/d37622162af016373418d881815e8e39fe03a96d.patch>
