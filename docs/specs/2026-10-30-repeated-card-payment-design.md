# Repeated card payment (amendment A142)

Amends A91 of `2026-10-20-card-statements-institution-design.md` and the import decision of `2026-10-20-record-matching-design.md` (A98 to A100).

## Intent

An aggregator can report one card payment under two ids. On 2026-10-29 the owner's Nubank Gold held the payment of 784.65 made on 2026-10-05 twice: the line `PAGAMENTO_FATURA` on the bill it paid (due 2026-10-05, dated at midnight), recorded on 2026-10-18 and paired with the checking transfer; and a second line of the same amount and day, first `PENDING` without a bill and without a type, then `POSTED` as `PAGAMENTO_FATURA` on the next bill (due 2026-11-05). A91 did not drop the second line: it compares lines of one read, and from 2026-10-29 23:56 both lines were posted. The second line created a payment against `transfers_in_transit`, so statement 2026-11 read 454.20 against the institution's 1,238.65.

Every earlier payment of that card came once, so the institution's own data cannot tell which line is the copy. A rule that decides alone would delete a real payment when two equal payments are made; a rule that asks costs the owner one action.

## Rule

On a sync, a card line that matching would create (zone `new`) waits for review with reason `repeated` when it repeats a recorded payment:

- both lines are credits of the card (amount above zero in the card's sign);
- the amounts are equal;
- the dates are at most 3 days apart (`RepeatDays`, the window of A91);
- at least one of the two has kind `payment` (A88).

A recorded line is an aggregator record of the account that is neither withdrawn nor discarded and holds a transaction, or a line the same import links (zone `link`). Each recorded line is repeated at most once. The lines of one import are taken payments first, then by date, then by external id; each takes the nearest recorded line no earlier line took, and a line that repeats nothing counts as recorded for the lines after it. Two payment lines of one first sync therefore record one payment and leave the other in review.

The record waits without candidates: the payment it repeats is linked to its own record, and a match to it returns `already_matched`. The owner creates it (two payments) or discards it (one payment). A sync never decides a record in review again, so a repeat that later turns posted, changes bill or gains its type stays in review.

### Limits

- A refund of exactly the amount of a payment within 3 days also waits for review.
- File imports are out of scope: their lines carry no kind.
- The first stage of 2026-10-29 (the pending copy not dropped at 19:48) is not explained: the read of that sync was not kept. The rule covers it, since the recorded line is a payment.

### Regions

The rule reads only the card sign, the amount, the date and the normalized kind `payment`; the source's word for a payment (`PAGAMENTO_FATURA` at Pluggy) stays in its adapter. A source that reports no kind never triggers it. No regional value and no extension point; `docs/contributing/regions.md` is unchanged.

## Contract

`ExternalRecord.review_reason` adds `repeated`. The review screen shows "Looks like a card payment already recorded. Create it if there were two payments; discard it if it is the same one."

## Scenarios

| ID | Scenario |
|---|---|
| S185 | A synced card payment of 784.65 on 2026-11-05 is recorded. The next sync returns another `PAGAMENTO_FATURA` of 784.65 on 2026-11-05 on another bill: it waits for review as `repeated`, the batch counts one in review and none created, and the card holds one payment; a further sync leaves it there. A first sync that returns both lines records `pay-a` and leaves `pay-b` in review. A posted credit without a type 3 days after a recorded payment of the same amount waits for review. Payments of 500.00 4 days apart, two equal credits without a payment and two equal charges are all created. |
