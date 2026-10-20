# Card statements that match the institution

Amendments A85–A93 to chapter 5 (5.2.4, 5.2.5, 5.5) and chapter 6 (S10, S46, S53, S54). New scenarios S80–S89.

## Intent

A card statement in equori shows the figures the institution shows: closing date, due date, amount to pay, what was billed in the cycle, and whether it is paid. A difference that only the owner's comparison with the institution's app finds is a defect.

Institutions differ in how they set closing and due dates, show early payments, bill installments, round installment amounts and apply refunds received after closing. The design names no institution. Each difference is resolved by one of three means, in this order:

1. A fact the institution reports: the line's type and bill, and the bill's dates, total and payments (aggregator), or the owner's entry.
2. A rule the owner configures per card, which projects the statements the institution has not reported yet.
3. A computation that holds for every issuer: the statement amount is the card balance at closing.

## Evidence

Card Nubank Gold, user 3, dev database and Pluggy (`GET /bills`, `GET /v2/transactions`), 2026-10-20.

| Statement (due) | Institution | equori before | Causes |
|---|---|---|---|
| 2026-08 (2026-08-05) | total 773.54; closing 2026-07-29 | 498.69 | C1, C7 |
| 2026-09 (2026-09-08) | total 1,034.75; closing 2026-08-29 (Saturday, effective 2026-08-28); paid by 961.85 on 09-05 and the refund of 72.90 of 08-31 | 759.86 | C1, C2 |
| 2026-10 (2026-10-05) | total 784.65; app: charges 2,281.32, refunds 496.67, early payment 1,000.00, bill 1,784.65 | −188.77, `paid` | C1, C2, C4, C5 |
| 2026-11 (2026-11-05) | app: closes 2026-10-29 | closes 2026-10-28 | C3 |

- C1. "Pagamento recebido" lines (`operationType` `PAGAMENTO_FATURA`, category `05100000` "Credit card payment") are recorded with role `credit` against `uncategorized_income` (`checkCardPosting`, `internal/ledger/internal/domain/transaction.go:323`; S46). They lower the amount due as refunds do, the statement they paid is never paid, and the flows report counts them as income.
- C2. An installment line whose amount differs from the equal split is refused (`ErrAmountMismatch`) and waits in review (Cea 1/3 60.01, Shopee 1/2 86.14 and 82.98, Olx 1/3 496.67). The issuer puts the remainder in installment 1, as 5.2.5 states.
- C3. Statement dates come from a fixed closing day. Pluggy's `billClosingDate` is the nominal due date minus 7 days for all twelve bills (2025-10-29 to 2026-09-28), unshifted (2026-03-29 and 2026-06-28 are Sundays). Lines show the effective cut: 2026-08-28 (Friday) went to the next bill, so a Saturday closing takes effect on the preceding business day. Due dates arrive already shifted (2026-04-06, 2026-07-06, 2026-09-08). `normalize.go` discards `billClosingDate`.
- C4. Shopee 1/2 86.14 was refunded on 2026-08-18 (`ESTORNO` 86.14); its 2/2 86.13 stays `PENDING` dated 09-16 with `billForecastDate` 2026-10 and was never billed. equori bills the projected 2/2 on 2026-10.
- C5. Payment 784.65 of 2026-10-05 is returned twice: `POSTED` with `billId`, and `PENDING` without it. Both are recorded.
- C6. Pluggy bill `totalAmount` is the card balance at closing: 2026-10 = 1,034.75 + 2,281.32 − 569.57 − (961.85 + 1,000.00) = 784.65; 2026-09 = 773.54 + 1,120.89 − 86.14 − 773.54 = 1,034.75. A bill's `payments` are those received after its closing until the next closing (2026-09: 961.85 and 1,000.00).
- C7. The owner's opening balance of 453.53 dated 2026-06-30 does not appear in any bill. The card's balance at the start of the sync (2026-07-01) was the 2026-07 bill (701.48, paid 2026-07-05) plus YouTube 26.90 of 2026-06-30, a line before `sync_from`.

## Goals

- G1. For every statement the institution reports, equori's amount due, closing date, due date and status equal the institution's, and a difference is reported by the sync.
- G2. A line recorded by hand, or imported without a bill, lands on the statement the institution will bill it on.
- G3. Payments are never income or refunds.
- G4. The rules hold for every card and month, including months already imported: the next sync recomputes them.

## Non-goals

- Code paths or switches per institution.
- Interest and fee computation: the issuer bills them as charges.
- Storing derived amounts (DM6 stays).

## Anti-goals

- A change that makes 2026-09 and 2026-10 match while another month or another issuer stops matching.
- Copying the institution's total into the statement: it is compared with the derived amount, never substituted.

## Design

### A85 Statement facts

A statement holds the facts an institution reported for it: closing date, due date, total and minimum payment. Source `aggregator` (a Pluggy bill) or `owner`. A newer `aggregator` fact replaces the older one; an `owner` fact wins over `aggregator` until the owner removes it.

Each sync of a card hands the ledger the facts of every bill (`GET /bills?accountId=`) whose cycle ends on or after the start of the cycle that holds `sync_from` (A93); the ledger records them on the statement whose due date equals the bill's `dueDate`, creating the statement when absent. The bill's payment list is not stored: line types (A88) already say which lines are payments.

### A86 Statement dates

A statement's dates are, by precedence, the owner's facts, the aggregator's facts and the projection of the billing cycle rule (T05, T06). A reported closing date is shifted by the rule's `closing_adjustment` (A87), because the institution reports it unshifted (C3); a reported due date is used as is. A change of facts re-dates the statement, also after its closing date (replaces "Closed statements keep their dates" in 5.2.4).

The statement of a posting without an explicit statement or bill (T04) is the first stored statement whose closing date is after the posting date (or on it, with assignment `closing`); past the last stored statement, the rule projects. When a statement is re-dated, its card postings that carry neither a bill nor an explicit statement are resolved again. A `reconciled` posting keeps its statement and the change is reported, as A39 does for imported lines.

### A87 Closing relative to the due date

The billing cycle rule gains `closing_mode`: `day` (the current `closing_day`, A1) or `before_due`, with `closing_days_before_due` (1–28) counted back from the nominal due date (before the calendar shift). It also gains `closing_adjustment` (`none`, `preceding`, `following`, default `none`), applied on the rule's calendar to the projected closing date and to a reported one (A86).

Nubank Gold: due day 5, `following`; `before_due` 7, `preceding`. It gives the twelve reported closing dates before the shift and 2026-08-28 after it.

### A88 Card line roles from the source

An imported card line's role comes from the source when the source states it: Pluggy `operationType` `PAGAMENTO_FATURA` is `payment`, `ESTORNO` is `credit`, any other type follows the sign. For sources without a type (OFX, CSV), a classification rule with the action "card payment" sets `payment`. A payment's other posting goes to the new system account `transfers_in_transit` (asset), never to `uncategorized_income`. Pairing with the paying account's line (F4, S45–S47) replaces that posting, as it replaces `uncategorized_income` today.

The next sync re-applies roles to records already imported: the record keeps the line's type among its facts (A36), and a change of type rewrites the transaction (a new version), unless a posting is `reconciled`, in which case `unapplied_change` reports it.

### A89 Statement amount is the card balance at closing

Every card posting, payments included, is billed on the statement of its cycle: the line's bill when the source gives one, otherwise the statement its date falls in (A86). A payment is no longer billed on the statement it pays (replaces "Payments" in 5.2.4 and A5).

| Figure | Definition |
|---|---|
| Opening | The previous statement's amount due; 0 for the card's first statement. |
| Amount due | Opening + charges − credits − payments, all billed on the statement. It is the card balance at closing and the institution's bill total (C6). |
| Settled | Payments and credits billed on the next statement, in date order, up to the amount due, dated on or before today. |
| Unpaid | Amount due − settled (the API keeps the field name `unpaid`; it no longer carries a negative credit). |
| Early payments | Payments billed on the statement beyond what settled the previous statement. |
| Billed amount | Amount due + early payments: the bill total an institution shows before early payments (the Nubank app's "fatura"). |

Status: `open` before the closing date; after it, `paid` when the amount due ≤ 0 or unpaid = 0, `overdue` after the due date with unpaid > 0, `partially_paid` with settled > 0, `closed` otherwise; `financed` as today. Revolving needs no carry rule: an unpaid balance stays in the next opening.

Worked on the evidence: 2026-09 amount due 1,034.75, settled by 72.90 (08-31) and 961.85 (09-05), `paid`. 2026-10: opening 1,034.75, charges 2,281.32, credits 569.57, payments 1,961.85, amount due 784.65; early payments 1,000.00 (961.85 and 72.90 settled 2026-09); billed amount 1,784.65; settled by 784.65 on 10-05, `paid`. An issuer that bills the refund on the next statement and is paid 1,034.75 gives the same amounts due: they are balances, not presentations.

The statement read returns every figure of the table; credits that settled the previous statement are reported apart from the credits of the cycle, so the cycle's refunds read 496.67 as in the institution's app.

### A90 Installment lines set their installment

A line that confirms an installment sets that installment's amount and statement: the amount from the line (5.2.5, "imported data overrides the split"), the statement from the line's bill. The purchase's category posting follows the new total in a new version; a `reconciled` installment refuses the change and the line waits in review, as today. Unconfirmed installments are projected from the latest confirmed one: installment k + j on that installment's statement + j.

A plan created from a line takes `creditCardMetadata.totalAmount` as its total when the source reports it, split by 5.2.5 (remainder to installment 1), and the line's own amount for its installment.

An unconfirmed installment is never billed on a statement that has aggregator facts: it moves to the first statement without them, still projected. A `PENDING` line confirms an installment as `pending` only. C4's 2/2 86.13 therefore leaves 2026-10 and stays a pending projection on the open statement until the aggregator stops returning it (A38) or the owner cancels the plan (S14).

### A91 Provisional lines

A `PENDING` card line without a bill is superseded by a `POSTED` line of the same card, sign and amount, dated within 3 days, returned by the same sync and not claimed by another pending line. The pending record becomes `withdrawn` (A38) and the posted record confirms its transaction (S55 path).

### A92 Statement check

For each statement with facts, the statement read returns the facts and the differences: amount due − total, closing date, due date. The sync reconciles (A7) each statement after its closing date whose differences are zero, and reports the others in the batch. The admin and cards screens show the difference beside the figure.

### A93 Card sync start

A card mapping imports from the start of the cycle that holds `sync_from`: the day after the effective closing of the last bill before `sync_from`. When the card account has no opening balance, the sync records one equal to that bill's total, billed on that bill's statement, as S68 does for reserves. With an opening balance already present, A92 reports the difference.

## Scenarios

- S80 Statement facts from a bill: a bill due 2026-09-08, closing 2026-08-29, total 1,034.75 re-dates statement 2026-09 to close on 2026-08-28 (rule `preceding`) and returns differences zero.
- S81 Closing before the due date: rule due day 5 `following`, `before_due` 7 `preceding`, calendar `br_banking`: 2026-08 to 2026-11 close on 2026-07-29, 2026-08-28, 2026-09-28, 2026-10-29 and fall due on 2026-08-05, 2026-09-08, 2026-10-05, 2026-11-05; a purchase on 2026-08-28 is billed on 2026-10.
- S82 Manual purchase after re-dating: statement 2026-10 re-dated by facts to close on 2026-09-28: a purchase on 2026-09-27 is billed on 2026-10, one on 2026-09-28 on 2026-11.
- S83 Payment line: `PAGAMENTO_FATURA` −961.85 on 2026-09-05 with bill 2026-10 becomes a `payment` of +961.85 against `transfers_in_transit`, billed on 2026-10; the month's income excludes it.
- S84 Refund before payment: the lines of the evidence give the worked example of A89 for 2026-09 and 2026-10.
- S85 Early and partial payments (S10 restated): statement 2026-11 with charges 1,500.00; 300.00 paid on 2026-10-28 (before closing 2026-11-03) gives amount due 1,200.00, billed amount 1,500.00, early payments 300.00; 1,200.00 on 2026-11-10 makes it `paid`. A partial 1,000.00 of 1,500.00 leaves unpaid 500.00, `partially_paid`, then `overdue`, and 2026-12 opens with 1,500.00 and holds the 1,000.00 payment.
- S86 Installment remainder: Cea 2/3 59.99 seen first, then 1/3 60.01 and 3/3 59.99: the plan holds 60.01, 59.99, 59.99 (179.99); nothing waits in review.
- S87 Unbilled installment: a plan projects 2/2 on 2026-10; the bill of 2026-10 arrives without it and a `PENDING` 2/2 line remains: 2/2 is pending on the open statement and 2026-10 matches its total.
- S88 Pending payment superseded: `PENDING` −784.65 and `POSTED` −784.65 with bill, both 2026-10-05: one transaction; the pending record is `withdrawn`.
- S89 Card sync start and opening: mapping from 2026-07-01 with the 2026-07 bill (closing 2026-06-28, total 701.48): lines from 2026-06-29 are imported, an opening balance of 701.48 is billed on 2026-07, and 2026-08 matches 773.54.
- S46 changes: a card line that the source types as a payment is a `payment` against `transfers_in_transit`. S53 and S54 hold.

Each scenario gets a test through the HTTP API (`internal/apitest`) carrying its ID.

## Order of delivery

Each slice is one commit with `make check` green.

1. A88: line roles and `transfers_in_transit` (S83, S46).
2. A89: statement figures and status (S84, S85).
3. A90: installment lines (S86, S87).
4. A91: provisional lines (S88).
5. A85, A86, A92: bill facts, dates, check (S80, S82).
6. A87: closing before due (S81).
7. A93: sync start and opening (S89).
8. The owner's data: void the opening balance of 453.53, re-sync Nubank Gold, compare every statement with its bill. A difference left opens a new cause before the work is done.

## Left to the builder

- Table and column names, the shape of stored bills, the route for owner facts (extend `POST /statements/{id}/reconcile` or add one).
- Where the figures of A89 are computed (SQL or Go), provided the API returns the same figures for any import order.
- The layout of the differences on the admin and cards screens.
