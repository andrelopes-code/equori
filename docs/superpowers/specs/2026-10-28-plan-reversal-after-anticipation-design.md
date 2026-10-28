# Plan reversal after anticipation (amendment A135)

Amends M25 (S14) and M26 (S15) of `docs/domain/06-scenarios.md`, and the offsetting rule of A133 (`2026-10-28-unconfirmed-entries-design.md`).

## Intent

`CancelPlan` reversed every installment of a plan, including installments a prior anticipation had already reversed. Each anticipated installment was credited twice, and the statements of the anticipated installments ended with a credit balance the institution never grants. `AnticipatePlan` accepted an installment already anticipated and a cancelled plan, with the same double credit.

## Rule

Each installment is reversed at most once, by one non-voided cancellation or anticipation.

Cancellation of a plan on date D:
- an installment on a statement an anticipation credited is not reversed again;
- each charge of a non-voided anticipation is treated as an installment: reversed on its statement when that statement closes after D, otherwise added to the billed credit;
- the billed credit, the sum of every billed installment and anticipation charge, is credited on the credit statement, as before;
- the categories lose the whole charged total, as before; the `discounts` system account receives the discount the anticipations granted, so the purchase and its discount net zero.

Anticipation rejects with `validation_failed` on `from_installment`:
- a cancelled plan;
- an installment on a statement a non-voided anticipation already credited.

The refund ceiling (I06) is the charged total less the anticipations' discount. A refund or a cancellation never credits more than what the owner pays.

A133 offsetting groups postings by purchase: the purchase's transaction and every transaction linked to it by `cancellation_of` or `anticipation_of`. An anticipation's charge and the cancellation's reversal of it offset on their statement.

## Scenarios

| ID | Scenario |
|---|---|
| S172 | The TV of S15 anticipated, then cancelled on 2027-01-20, before statement 2027-02 closes. Installment 4/10 and the 1,260.00 charge are reversed on 2027-02; 1/10 to 3/10 (667.62) are credited on 2027-02; statements 2027-03 to 2027-08 net 0.00; the categories receive −2,225.40 and Discounts +75.24. |
| S173 | The same anticipation, cancelled on 2027-02-20, after 2027-02 closed. 1/10 to 4/10 and the 1,260.00 charge (2,150.16) are credited on 2027-03; statements 2027-05 to 2027-08 net 0.00; categories and Discounts as in S172. |
| S174 | After the S15 anticipation, anticipating 4/10 to 6/10 is 422 `validation_failed` on `from_installment`; after a cancellation, anticipating 4/10 is the same problem. |
| S175 | The plan of S169 anticipated (3 to 6 on statement 2026-10 for 380.00 on 2026-09-20), then cancelled on 2026-09-25. The anticipation's −380.00 offsets the cancellation's +380.00 on 2026-10; the list holds one entry: the cancellation, +100.00, dated 2026-10-03. |
