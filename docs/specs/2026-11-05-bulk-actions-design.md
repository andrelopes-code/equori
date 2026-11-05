# Bulk actions

Status: approved by the owner on 2026-11-05 ("siga com tudo pertinente"). Amendments A201 to A203, scenarios S289 to S294.

## 1. Problem

Three screens settle records one at a time.

| Screen | Today | Cost |
|---|---|---|
| Import batch, review queue (`review-record.tsx`) | One `POST /external-records/{id}/resolve` per line, three buttons per line | One import with 40 lines in review takes at least 80 clicks |
| Account, reconciliation tab (`unconfirmed-table.tsx`) | The entries no institution line confirmed are listed, with no action | Each entry is opened and voided from the transaction panel |
| Transactions list (`selection-bar.tsx`) | A selection categorizes or asks for suggestions | Voiding a selection is one dialog per transaction |

Reconciliation itself is already a bulk act: a resolved balance assertion reconciles every posting settled up to its date (chapter 5, 5.2.6), and a card statement reconciles when its total matches (A7, A92). A per-posting reconciliation checkbox contradicts that model and is not built.

## 2. Decisions

| # | Question | Choice | Reason |
|---|---|---|---|
| D1 | Server or client loop | One server operation per command, at most 200 items, each item decided on its own | A78 set the form for categorization; one request keeps the lock and the counts of each record in the existing `Resolve` and `VoidTransaction` |
| D2 | Atomic or per item | Per item. An item that fails reports its status and leaves the others applied. An error outside the listed statuses ends the request with 500; the items before it stay applied | Conflicts (`record_resolved`, `already_matched`) are expected between a reading and a write; one stale line must not refuse forty |
| D3 | Item status names | The problem code the single operation returns for the same failure, and `resolved` or `voided` on success | A78 names statuses the same way; the client already holds the texts |
| D4 | Repeated id in one request | 422 `validation_failed` on `items`, before any item runs | Same as A78 |
| D5 | Which lines a bulk match takes | Only a line in review for `probable`, matched to its first scored candidate. `ambiguous`, `changed` and `repeated` lines take create or discard in bulk, and a match one at a time | `probable` has one candidate above the threshold; the other reasons exist because matching could not choose (A100, A102, A142) |
| D6 | Group lines (A168) | Not selectable | A group confirms one entry with two or three lines; its review is the group as a whole (`2026-11-01-grouped-confirmation-design.md`) |
| D7 | Confirmation before writing | Discard and void open a dialog with the count and the sum; void asks the reason, as the single void does. Create and match write at once | A discard returns by Reopen (A140) and a void is final; a created or matched line returns by undo or void |
| D8 | Report of the outcome | A `FormNotice` in the region: the count written, the count refused, and one line per refused record with its description and reason (Slotted FM-10). No toast | FM-10 is MUST; a toast leaves the page before the reader finds the refused rows |
| D9 | Where the selection bar stands | Import batch and transactions list: an `ActionBar` in the page footer (LP-03), as the transactions list does. Reconciliation tab: an `ActionBar` under the table, inside the section | The tab is one section of the account page; a page footer there would act on a region the reader may have scrolled past |
| D10 | Selection on a link row | A `Checkbox` in `ListItemActions` | `ListItemStart` is inside the row box, which is the link; interactive content may not nest in an anchor (list-item rules). The gap is a Slotted finding (section 6) |
| D11 | Assistant tools | No new tool. `resolveExternalRecords` maps to `manage_imports`, `voidTransactions` to `void_transaction` in `tool_exposure_test.go` | The tools already cover the same effect one item at a time (ADR 012) |
| D12 | Selection scope | The loaded rows of the list. The selection clears when the filter changes and after each bulk command | A selection over rows not loaded is a query decision the review queue does not offer |

## 3. Amendments

A201: `POST /external-records/resolve` settles several lines in review. Each item names a line, an action (`match`, `create`, `discard`) and, for `match`, a transaction; it runs as `POST /external-records/{id}/resolve` would. The result lists one status per item in request order: `resolved`, or the problem code of the failure (`validation_failed`, `not_found`, `record_resolved`, `group_changed`, `already_matched`, `transaction_voided`, `posting_reconciled`). A request with a repeated line is refused with `validation_failed` on `items`.

A202: `POST /transactions/void` voids several transactions with one reason. Each item runs as `POST /transactions/{id}/void` would. The result lists one status per item in request order: `voided`, `not_found`, `transaction_voided`, `posting_reconciled` or `later_sale_exists`. A request with a repeated transaction is refused with `validation_failed` on `items`.

A203: the review queue of an import batch, the unconfirmed entries of an account and the transactions list take a selection. The review queue confirms the suggestion of the selected `probable` lines, creates or discards the selected lines; group lines are not selectable. The unconfirmed entries and the transactions list void the selection. Each command reports the count written, the count refused and each refused record with its reason.

## 4. Scenarios

| ID | Scenario | Test |
|---|---|---|
| S289 | A line in review matched to its candidate and an unknown line in one request: `resolved`, `not_found`. The same line sent again: `record_resolved` | `internal/ingestion/bulk_resolve_test.go` |
| S290 | A request that names one line twice: 422 `validation_failed` on `items`, the line stays in review | `internal/ingestion/bulk_resolve_test.go` |
| S291 | A plain transaction, a voided one, a reconciled one and an unknown id voided in one request: `voided`, `transaction_voided`, `posting_reconciled`, `not_found` | `internal/ledger/bulk_void_test.go` |
| S292 | A request that names one transaction twice: 422 `validation_failed` on `items`, the transaction stays | `internal/ledger/bulk_void_test.go` |
| S293 | A queue with a `probable`, an `ambiguous` and a `group` line: the group line has no checkbox; with both others selected, "Confirm suggestions (1)" sends one `match` on the first scored candidate | `web/src/features/accounts/review-selection.test.ts`, `batch-page.test.tsx` |
| S294 | A bulk command with one refused item: the notice states "1 resolved, 1 refused" and names the refused line with its reason | `web/src/features/accounts/batch-page.test.tsx`, `web/src/features/transactions/transactions-page` test |

## 5. Out of scope

- Bulk tag, bulk transfer pairing, bulk reimbursement.
- Selection by filter beyond the loaded rows.
- Moving the bulk categorization report from a toast to a `FormNotice`.
- Undo of a bulk command as one step.
- Bulk acceptance of rule suggestions.

## 6. Slotted finding

A selectable row that is also a link has no documented place for its checkbox: the family says the selection is announced by a `Checkbox` in `ListItemStart`, and `ListItemStart` lives inside the box, which is the anchor. The finding is reported as `andrelopes-code/slotted#79` (area `family`); the workaround (D10) cites it.
