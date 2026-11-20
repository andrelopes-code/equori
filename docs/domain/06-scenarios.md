# 6. Scenarios

Status: approved

Each scenario is an executable specification: given a state, when something happens, then exactly these postings exist and these values hold. Every scenario becomes an acceptance test. Amounts follow the sign convention of chapter 2: positive increases assets and expenses; negative increases liabilities, income and equity.

## 6.1 Fixture

| Account | Class / kind | Instrument | Notes |
|---|---|---|---|
| Nubank | asset / checking | BRL | Parent account without postings of its own (5.2.2) |
| Nubank checking | asset / checking | BRL | Child of Nubank |
| Emergency fund | asset / reserve | BRL | Child of Nubank, yield mode `auto` |
| Wallet | asset / cash | BRL | |
| VR | asset / benefit | BRL | Meal voucher |
| Itaú Visa | liability / credit_card | BRL | Closes day 3, due day 10, closing-day purchases to `next`, due date `following` |
| Wise USD | asset / checking | USD | |
| XP | asset / brokerage | — | Parent of XP cash (BRL), XP MXRF11, XP PETR4 |
| Receivable Ana, Receivable Bruno, Receivable Employer | asset / receivable | BRL | |
| Loan to Ana | asset / loan | BRL | |
| Personal loan | liability / loan | BRL | |
| Categories | expense | BRL | Food › Supermarket, Food › Restaurant, Electronics, Travel, Transport, Health, Subscriptions, Housing › Rent, and system roles: Interest, Fees, Taxes › IOF, Taxes › Income tax, Taxes › INSS |
| Categories | income | BRL | Salary, Cashback, Dividends, JCP, Interest income, and system roles: Yield, Discounts, Realized gains |
| Equity | equity | BRL | Opening balances, Adjustments |

Itaú Visa statements used below:

| Statement | Closing date | Due date |
|---|---|---|
| 2026-11 | 2026-11-03 | 2026-11-10 |
| 2026-12 | 2026-12-03 | 2026-12-10 |
| 2027-01 | 2027-01-03 | 2027-01-11 (10th is a Sunday) |

## 6.2 Income and expenses

### S01 Salary (M01)

When the salary of 5,000.00 is credited on 2026-10-05:

| Account | Amount |
|---|---|
| Nubank checking | +5,000.00 |
| Salary | −5,000.00 |

### S02 Payroll breakdown (M28)

When the payslip shows gross 7,000.00, INSS 700.00, income tax 900.00, health plan 200.00 and net 5,200.00:

| Account | Amount |
|---|---|
| Salary | −7,000.00 |
| Taxes › INSS | +700.00 |
| Taxes › Income tax | +900.00 |
| Health | +200.00 |
| Nubank checking | +5,200.00 |

Then the accrual view shows income 7,000.00 and expenses 1,800.00; the checking balance increases by 5,200.00.

### S03 Expenses by payment method (M02)

| Payment | Postings |
|---|---|
| PIX to a restaurant, 120.00 | Nubank checking −120.00; Food › Restaurant +120.00 |
| Boleto, 389.00 | Nubank checking −389.00; Housing +389.00 |
| Meal voucher, 45.90 | VR −45.90; Food › Restaurant +45.90 |
| Cash, 18.00 | Wallet −18.00; Transport +18.00 |
| Debit card on Saturday 2026-10-17, settled Monday 2026-10-19, 80.00 | Nubank checking −80.00 (`settledOn` 2026-10-19); Food › Supermarket +80.00 |

Then the checking balance at 2026-10-18 is 80.00 lower by transaction date and unchanged by settlement date; a balance assertion for 2026-10-18 compares against the settlement-date balance.

### S04 Transfers between own accounts (M03)

| Transfer | Postings |
|---|---|
| Checking to reserve, 1,000.00 | Nubank checking −1,000.00; Emergency fund +1,000.00 |
| Cash withdrawal, 300.00 | Nubank checking −300.00; Wallet +300.00 |

Then no income or expense is recorded, and the Nubank parent balance is unchanged by the first transfer.

## 6.3 Credit card

### S05 Single purchase and statement assignment (M04, T04)

| Purchase | Date | Postings | Billed on |
|---|---|---|---|
| Supermarket, 230.00 | 2026-10-14 | Itaú Visa −230.00; Food › Supermarket +230.00 | 2026-11 |
| Pharmacy, 60.00 | 2026-11-03 (closing date) | Itaú Visa −60.00; Health +60.00 | 2026-12 (closing-day purchases go to `next`) |
| Same pharmacy purchase, card set to `closing` | 2026-11-03 | same | 2026-11 |

### S06 Installment purchase without interest (M05, T07, DM3)

When a laptop of 1,000.00 is bought in 3× on 2026-10-20:

| Account | Amount | Installment | Billed on |
|---|---|---|---|
| Electronics | +1,000.00 | | |
| Itaú Visa | −333.34 | 1/3 | 2026-11 |
| Itaú Visa | −333.33 | 2/3 | 2026-12 |
| Itaú Visa | −333.33 | 3/3 | 2027-01 |

Then: card balance −1,000.00 (available limit reduced by 1,000.00); statement 2026-11 contains 333.34; accrual view: Electronics 1,000.00 in October 2026; committed amount for December 2026: 333.33.

### S07 Installment purchase with interest (M05, DM2)

When a TV of 2,000.00 is bought in 10× of 222.54 (1.99% per month) on 2026-10-25:

| Account | Amount | Billed on |
|---|---|---|
| Electronics | +2,000.00 | |
| Interest | +225.40 | |
| Itaú Visa | −222.54 each, installments 1/10 to 10/10 | 2026-11 to 2027-08 |

Then the card postings sum to −2,225.40 and the transaction balances.

### S08 Refunds (M06, I06)

| Case | Postings | Billed on |
|---|---|---|
| Full refund of the 230.00 supermarket purchase on 2026-10-20 | Itaú Visa +230.00; Food › Supermarket −230.00; link `refund_of` S05 | 2026-11 |
| Partial refund of 50.00 on the laptop on 2026-11-15 | Itaú Visa +50.00; Electronics −50.00; link `refund_of` S06 | 2026-12 |
| Second refund of 960.00 on the laptop | Rejected: refunds would total 1,010.00 > 1,000.00 (I06) | |

### S09 Card charges (M07)

When the annual fee of 40.00 is billed on 2026-11-01: Itaú Visa −40.00 (2026-11); Fees +40.00.

### S10 Statement payment (M08)

Given statement 2026-11 with amount due 1,500.00:

| Case | Postings | Result |
|---|---|---|
| Full payment on 2026-11-10 | Nubank checking −1,500.00; Itaú Visa +1,500.00 (role `payment`, billed on 2026-12, the statement of its cycle; A89) | 2026-11 status `paid` |
| Early payment of 300.00 on 2026-10-28, then 1,200.00 on 2026-11-10 | The first billed on 2026-11 (amount due 1,200.00, early payments 300.00, billed amount 1,500.00), the second on 2026-12 | 2026-11 status `paid` after the second |
| Partial payment of 1,000.00 on 2026-11-10 | Nubank checking −1,000.00; Itaú Visa +1,000.00 (billed on 2026-12) | 2026-11 unpaid 500.00, `partially_paid`; after the due date: `overdue`; 2026-12 opens with 1,500.00 and holds the payment |
| Revolving interest billed by the issuer on 2026-12-01 | Itaú Visa −62.50 (2026-12); Interest +62.50 | Amount due of 2026-12: 1,500.00 + 62.50 − 1,000.00 + new charges |

### S11 Statement financing (M09)

Given statement 2026-11 overdue with 2,000.00 unpaid, when it is financed on 2026-11-12 in 6× of 363.40:

| Account | Amount | Billed on |
|---|---|---|
| Itaú Visa | +2,000.00 (role `payment`) | 2026-11 |
| Itaú Visa | −363.40 each, installments 1/6 to 6/6 | 2026-12 to 2027-05 |
| Interest | +180.40 | |

Then statement 2026-11 is `financed`; the card balance increases its debt by 180.40.

### S12 Cashback (M10)

Itaú Visa +12.30 (2026-12); Cashback −12.30.

### S13 Chargeback (M22)

Given an unrecognized charge of 199.90 billed on 2026-11, when a dispute is opened and later won:

| Step | Postings |
|---|---|
| `DisputeOpened` | None; the original stays in its category, flagged as disputed |
| `DisputeResolved` won, credited on 2026-12 | Itaú Visa +199.90 (2026-12); original category −199.90; link `chargeback_of` |
| `DisputeResolved` lost | None |

### S14 Installment cancellation (M25, T08)

Given the laptop of S06 with installment 1/3 billed on the closed statement 2026-11, when the purchase is cancelled on 2026-11-20 and the issuer credits the billed installment on 2026-12:

| Account | Amount | Billed on |
|---|---|---|
| Itaú Visa | +333.33 (reverses 2/3) | 2026-12 |
| Itaú Visa | +333.33 (reverses 3/3) | 2027-01 |
| Itaú Visa | +333.34 (credits 1/3) | 2026-12 |
| Electronics | −1,000.00 | |

Then the original postings are unchanged; statement 2026-12 nets +333.34; statement 2027-01 nets 0.00; the plan is `cancelled`; Electronics nets 0.00 for the purchase.

### S15 Installment anticipation (M26)

Given the TV of S07, when on 2027-01-15 installments 5/10 to 10/10 (statements 2027-03 to 2027-08, 6 × 222.54 = 1,335.24) are anticipated to statement 2027-02 for 1,260.00:

| Account | Amount | Billed on |
|---|---|---|
| Itaú Visa | +222.54 each (reverses 5/10 to 10/10) | 2027-03 to 2027-08 |
| Itaú Visa | −1,260.00 | 2027-02 |
| Discounts | −75.24 | |

Then statements 2027-03 to 2027-08 net 0.00 for this plan; the plan is `anticipated`.

## 6.4 Currencies

### S16 Foreign purchase on a BRL card (M11)

When a hotel of 100.00 USD is charged at 5.4830 with IOF 3.5% on 2026-10-22:

| Account | Amount | Original amount | Billed on |
|---|---|---|---|
| Travel | +548.30 | 100.00 USD | |
| Taxes › IOF | +19.19 | | |
| Itaú Visa | −548.30 | 100.00 USD | 2026-11 |
| Itaú Visa | −19.19 | | 2026-11 |

### S17 Currency exchange (M12, DM1)

When 1,000.00 USD is bought for 5,483.00 BRL plus a 30.00 BRL fee:

| Account | Amount | Weight (BRL) |
|---|---|---|
| Nubank checking | −5,513.00 BRL | −5,513.00 |
| Fees | +30.00 BRL | +30.00 |
| Wise USD | +1,000.00 USD | +5,483.00 |

Then the weights sum to 0.00; the Wise USD balance is 1,000.00 USD; net worth in BRL on a date with price 5.5000 shows Wise as 5,500.00.

## 6.5 People, reimbursements and loans

### S18 Reimbursement (M13)

| Step | Postings |
|---|---|
| Hotel for work, 800.00 on the card, reimbursable by the employer | Itaú Visa −800.00 (2026-11); Receivable Employer +800.00 |
| Employer pays 700.00 | Nubank checking +700.00; Receivable Employer −700.00; link `reimbursement_of` |
| Owner writes off the remaining 100.00 | Travel +100.00; Receivable Employer −100.00 |

Then the expense is only 100.00, in the month of the write-off.

### S113 Reimbursement of a recorded expense (M13, A117)

| Step | Postings |
|---|---|
| Owner pays 15.00 by PIX on 2026-10-17 | Mercado Pago checking −15.00; Car +15.00 |
| The payee returns 15.00 on 2026-10-20 | Nubank checking +15.00; Uncategorized income −15.00 |
| Owner allocates 15.00 of the expense to the second | Nubank checking +15.00; Car −15.00; link `reimbursement_of` holding 15.00 |

Car totals 0.00 for October. `POST /transactions/{id}/reimbursement` replaces the reimbursements of the incoming transaction with the list of allocations it receives. Tests: `internal/ledger/reimbursement_test.go`.

### S114 Reimbursement allocations (M13, A117)

| Case | Allocations of the incoming transaction |
|---|---|
| Two expenses of 50.00, 100.00 received | 50.00 to each; Car is repaid in full |
| One expense of 200.00, two transfers of 100.00 | Each transfer allocates 100.00 to the expense; a further 1.00 is refused, naming 201.00 and 200.00 |
| One expense of 100.00, 120.00 received | 100.00 to the expense; 20.00 stays on Uncategorized income |
| Replacing the list of a transaction | The amounts held by the other transactions count; the replaced ones do not |
| Empty list | The incoming transaction returns to Uncategorized income; refused when it has no reimbursement |
| Voiding the incoming transaction | The amounts it held are free again |
| An allocation names a category | The expense and its reimbursement move to it |

Recategorizing an expense afterwards leaves the reimbursements on the previous category. Tests: `internal/ledger/reimbursement_test.go`.

### S19 Shared expense (M14)

| Step | Postings |
|---|---|
| Dinner of 300.00 on the card, split in three | Itaú Visa −300.00; Food › Restaurant +100.00; Receivable Ana +100.00; Receivable Bruno +100.00 |
| Ana pays by PIX | Nubank checking +100.00; Receivable Ana −100.00 |

### S20 Loans (M15, M16)

| Step | Postings |
|---|---|
| Loan of 1,000.00 to Ana | Nubank checking −1,000.00; Loan to Ana +1,000.00 |
| Ana repays 1,050.00 | Nubank checking +1,050.00; Loan to Ana −1,000.00; Interest income −50.00 |
| Personal loan of 10,000.00 taken | Nubank checking +10,000.00; Personal loan −10,000.00 |
| Installment of 1,250.00: principal 900.00, interest 350.00 | Nubank checking −1,250.00; Personal loan +900.00; Interest +350.00 |

## 6.6 Investments

### S21 Purchase and sale (M17, D1)

| Step | Account | Amount | Weight (BRL) |
|---|---|---|---|
| Buy 150 MXRF11 at 10.05 + 4.90 fees | XP cash | −1,512.40 BRL | −1,512.40 |
| | XP MXRF11 | +150 MXRF11 | +1,512.40 |
| Sell 50 MXRF11 at 10.80 − 2.10 fees | XP cash | +537.90 BRL | +537.90 |
| | XP MXRF11 | −50 MXRF11 | −504.13 |
| | Realized gains | −33.77 BRL | −33.77 |

Then: average cost 10.0827 (1,512.40 ÷ 150); cost of the 50 sold = 504.13 (half to even); remaining position 100 MXRF11 with cost basis 1,008.27; realized result 33.77 in the sale month.

### S22 Investment income (M18)

| Income | Postings |
|---|---|
| MXRF11 dividend, 100 × 0.10 | XP cash +10.00; Dividends −10.00 |
| PETR4 JCP, gross 45.00, 17.5% withheld (15% before 2026, A235) | XP cash +37.12; Taxes › Income tax +7.88; JCP −45.00 |

## 6.7 Balances, yield and reconciliation

### S23 Opening balances (M19)

| Account | Postings on 2026-01-01 |
|---|---|
| Nubank checking with 1,240.55 | Nubank checking +1,240.55; Opening balances −1,240.55 |
| Itaú Visa with 1,100.00 on the open statement and 3 installments of 400.00 still to bill | Itaú Visa −1,100.00 (2026-01), −400.00 (2026-02), −400.00 (2026-03), −400.00 (2026-04); Opening balances +2,300.00 |

### S24 Yield on a reserve (M23, B04)

Given the Emergency fund with a derived balance of 10,000.00 and a previous assertion on 2026-10-01, when the institution reports 10,083.41 on 2026-10-31:

| Account | Amount |
|---|---|
| Emergency fund | +83.41 |
| Yield | −83.41 |

Then the reserve is reconciled at 2026-10-31. If the report were 9,990.00 (difference −10.00), no yield is recorded and the difference waits for the owner (F6).

### S25 Redemption with tax (M24)

When 2,000.00 is redeemed from the reserve, of which 40.00 is yield held for 45 days (income tax 22.5%, no IOF after 30 days):

| Account | Amount |
|---|---|
| Emergency fund | −2,000.00 |
| Nubank checking | +1,991.00 |
| Taxes › Income tax | +9.00 |

### S26 Balance adjustment (M20)

Given a derived balance of 3,203.27 and an assertion of 3,201.17, when the owner resolves the difference as an adjustment: Nubank checking −2.10; Adjustments +2.10. Then the account is reconciled.

Given a derived balance of 3,203.27 and an assertion of 3,203.37, when the owner resolves the difference as yield: Nubank checking +0.10; Yield −0.10. Then the account is reconciled. A negative difference does not resolve as yield. Tests: `TestYieldResolvesPositiveDifference`, `TestYieldRejectsNegativeDifference`.

## 6.8 Schedules and subscriptions

### S27 Monthly rent with business-day adjustment (M21, T01, T06)

Schedule: rent 2,100.00, monthly on day 5, adjustment `following`.

| Occurrence | Expected date | Reason |
|---|---|---|
| 2026-11 | 2026-11-05 (Thursday) | |
| 2026-12 | 2026-12-07 (Monday) | 2026-12-05 is a Saturday |
| 2027-01 | 2027-01-05 (Tuesday) | |

When a PIX of 2,100.00 to the landlord is recorded on 2026-11-05, the 2026-11 occurrence becomes `realized`.

### S28 Day 31 schedule (T02)

Schedule monthly on day 31 from 2027-01-31: occurrences 2027-01-31, 2027-02-28, 2027-03-31, 2027-04-30.

### S29 Subscription with price change and pause (M27, T09)

Streaming 39.90 monthly on day 12 on the card; price 44.90 effective 2027-01-01; paused from 2027-02-01 to 2027-03-31; ended from 2027-06-01.

| Occurrence | Expected amount | State |
|---|---|---|
| 2026-11-12 | 39.90 | expected |
| 2026-12-12 | 39.90 | expected |
| 2027-01-12 | 44.90 | expected |
| 2027-02-12, 2027-03-12 | | not generated (paused) |
| 2027-04-12, 2027-05-12 | 44.90 | expected |
| 2027-06-12 onward | | not generated (ended) |

### S143 Schedule created after its start

Amendment A127: a schedule's occurrences start at its rule's first date, also when it is created later. On creation, the transactions already recorded on the schedule's account realize the occurrences dated up to today (A51), and an occurrence dated before the creation day that none realizes is skipped, so the past is neither overdue nor projected. On 2026-10-20, with payments of 23.90 recorded on 2026-07-30, 2026-08-30 and 2026-09-29, a subscription of 23.90 monthly on day 30 from 2026-07-30 has 2026-07-30, 2026-08-30 and 2026-09-30 realized by them and 2026-10-30 expected; a salary monthly on day 5 from 2026-09-05 without payments has 2026-09-05 and 2026-10-05 skipped and 2026-11-05 expected. `equori planning backfill` applies the rule to the schedules created before it; a second run changes nothing.

### S283 Schedule renamed in place

Amendment A198: the description of a schedule changes without a new schedule, also after the schedule ended. The new description applies to every occurrence of the schedule, realized, expected and skipped; no occurrence, terms version, pause, end date or matching setting changes. An empty description, or one above 200 characters, is rejected with `validation_failed`. A subscription "Uber One" ended from 2026-12-03 with 2026-11-03 expected is renamed "Uber Moto Flex": 2026-11-03 stays expected under the new name and a transaction recorded afterwards realizes it.

### S284 Schedule started earlier

Amendment A199: the first date of a schedule moves before the current one, on the rhythm of its recurrence, with `starts_on`. The occurrences that exist stay with their identity and take the next sequences; each later terms version keeps its place. A date gained before the first one is inserted: a recorded transaction that fits it realizes it (A51); one dated before today minus the grace days that none realizes is skipped; the others are expected and take a transaction recorded afterwards. A date that is not before the current start, one off the rhythm of the recurrence, and a recurrence with a count are rejected with `validation_failed` on `starts_on`. On 2026-11-04, a subscription of 6.00 monthly on day 3 from 2026-12-03 with 3 grace days is started on 2026-11-03: 2026-11-03 is expected, 2026-12-03 keeps its occurrence as the second, and the charge of 6.00 on 2026-11-03 that the bank synchronizes later realizes the first. Started on 2026-09-03, 2026-09-03 and 2026-10-03 are skipped unless a recorded transaction realizes them.

### S285 Skipped occurrence reopened

Amendment A200: a skipped occurrence becomes expected again, with its identity, its sequence and its date, and its skip reason is cleared. A transaction already recorded on the schedule's account that fits it (A51) realizes it at once. An occurrence that is not skipped is rejected with `occurrence_closed`, one dated on or after the end of the schedule with `schedule_ended`, and one inside a pause with `validation_failed` on `date`. On 2026-11-04, the occurrence of 2026-12-03 of a subscription of 6.00 was skipped by mistake: after the reopen it is expected, and a charge of 6.00 recorded on 2026-12-03 realizes it.

## 6.9 Views

### S30 Accrual and cash views of a card statement (G1)

Given statement 2026-11 contains Supermarket 230.00 (bought 2026-10-14) and laptop installment 1/3 333.34 (laptop bought 2026-10-20 for 1,000.00), amount due 563.34:

| View | October 2026 | November 2026 |
|---|---|---|
| Accrual | Food › Supermarket 230.00; Electronics 1,000.00 | — |
| Cash, statement paid in full on 2026-11-10 | — | Food › Supermarket 230.00; Electronics 333.34 |
| Cash, statement paid 50% (281.67) on 2026-11-10 | — | Food › Supermarket 115.00; Electronics 166.67 |

In the cash view, a payment is distributed over the categories of the statement in proportion to their share of the amount due; the rounding remainder goes to the largest share.

## 6.10 Attachments

### S31 Receipt (M29, D2)

When a 230 KB PDF receipt is attached to the S05 supermarket transaction and the same file to another transaction, the file content is stored once and both transactions list it. A 12 MiB file is rejected (limit 10 MiB).

## 6.11 Import

Import scenarios of phase P4 (chapter 3, F4). Nubank checking and Itaú Visa are the accounts of 6.1.

### S32 OFX import with a match (F4)

The Nubank checking OFX file of October has three lines and `LEDGERBAL` 2,834.10 on 2026-10-31. The owner had entered −45.90 on 2026-10-04.

| Line | Outcome |
|---|---|
| −45.90 on 2026-10-05 | Matches the manual entry (within 3 days, same amount); its posting becomes `cleared` |
| −120.00 on 2026-10-12 | Nubank checking −120.00; Uncategorized expense +120.00 |
| +3,000.00 on 2026-10-15 | Nubank checking +3,000.00; Uncategorized income −3,000.00 |

The file balance is asserted and the account is reconciled at 2026-10-31. Batch: received 3, matched 1, created 2.

### S33 Repeated file (SC2)

Importing the S32 file again: received 3, ignored 3, nothing created or matched.

### S34 Identical lines without an id

A CSV line "07/10/2026; −8,50; Padaria" appears twice in a file: two transactions. Importing the file again creates none; a later file with the line three times creates one.

### S35 Ambiguous match

Manual entries of −50.00 on 2026-10-09 and 2026-10-10 and an OFX line of −50.00 on 2026-10-10: the record waits for review with both candidates. Resolving it as a match to the 2026-10-10 entry links that transaction.

### S36 Card statement file

An OFX credit card statement for Itaú Visa: −230.00 on 2026-10-14 is a `charge` and +230.00 on 2026-10-20 a `credit`, both billed on statement 2026-11.

## 6.12 Coverage

| Transaction kind | Scenarios |
|---|---|
| M01 | S01 |
| M02 | S03 |
| M03 | S04 |
| M04 | S05 |
| M05 | S06, S07 |
| M06 | S08 |
| M07 | S09, S10 |
| M08 | S10, S84, S85 |
| M09 | S11 |
| M10 | S12 |
| M11 | S16 |
| M12 | S17 |
| M13 | S18 |
| M14 | S19 |
| M15, M16 | S20 |
| M17 | S21 |
| M18 | S22 |
| M19 | S23 |
| M20 | S26 |
| M21 | S27, S28 |
| M22 | S13 |
| M23 | S24 |
| M24 | S25 |
| M25 | S14 |
| M26 | S15 |
| M27 | S29 |
| M28 | S02 |
| M29 | S31 |

The import flow (F4) is covered by S32–S36; classification (F5) by S37–S44 and S98 (amendment A105); the category tree and its tools by S72–S79 (amendments A73–A84 of `docs/specs/2026-10-19-categorization-design.md`); transfers from imports by S45–S50; aggregator sync by S51–S59, S68–S71 and S90; matching by score by S91–S97 (amendments A98–A104); card statements from the institution by S80–S89 (amendments A85–A93); schedules (F7) by S27–S29 and the planning views by S60–S63; deleting a budget by S144; the budget plan by S158 to S166 (`docs/specs/2026-10-27-budget-plan-design.md`) and its savings target by S262 to S264 (`docs/specs/2026-11-01-savings-target-design.md`); currencies and investments (F9) by S16, S17, S21, S22 and S64–S67; editing and deleting goals by S119 and S120; goals over brokerage accounts by S121; tax treatment by instrument subtype by S122; editing an instrument by S171; the return of an account tree by S126 and S127, its comparison with a daily index and its real return by S302 to S339 and S349 to S351 (amendment A208) and of a goal by S130; allocation and net worth by S128 and S129; fixed income accrual by S123 to S125; reimbursement of recorded expenses by S113 and S114 (amendment A117); text capture and the transaction batch by S99–S112 and S151–S153 (amendments A106–A116 of `docs/specs/2026-10-21-text-capture-design.md`); the assistant by S131–S142 (section 6.20).

## 6.13 Classification

Classification scenarios of phase P5 (chapter 3, F5; chapter 5, 5.4). The accounts are those of 6.11 and the categories Transport › Ride-hailing, Transport › Fuel, Travel, Food › Delivery, Food › Groceries, Food › Bakery, Cleaning and Salary.

### S37 Rule at import

Rule "description contains `uber`" → Transport › Ride-hailing. An OFX line −23.90 "UBER *TRIP" creates a transaction at version 1 with a Ride-hailing posting of +23.90; its categorization is method `rule` with that rule.

### S38 Alias and payee history

Alias `starts_with` "ifd*" → payee iFood; a manual transaction of 2026-10-01 with payee iFood is categorized as Food › Delivery. An OFX line −45.00 "IFD*IFOOD SAO PAULO" creates a transaction with payee iFood and category Food › Delivery, method `history`.

### S39 Several matching rules

Rule 1 "description contains `posto`" → Transport › Fuel; rule 2 "description contains `shell`" → Travel and tag `car`. "POSTO SHELL" −150.00 gets Fuel and tag `car`, method `rule` with rule 1. After rule 1 gets `stop_processing`, a second line "POSTO SHELL" gets Fuel without the tag.

### S40 Split rule

Rule "payee equals Pão de Açúcar" → split Food › Groceries 80 % and Cleaning remainder. A −99.99 line gets Groceries +79.99 and Cleaning +20.00.

### S41 Manual categorization and running rules

An imported "UBER *TRIP" transaction is categorized by the owner as Travel (method `manual`). A line "UBER *EATS" −31.00 imported before the S37 rule existed is uncategorized; `POST /rules/run` categorizes it as Ride-hailing and leaves the Travel transaction unchanged.

### S42 Rule suggestion

Two imported lines "PADARIA SÃO JOÃO" without payee, categorized by the owner as Food › Bakery, produce one `pending` suggestion (`raw_description equals "padaria sao joao"` → Bakery). Accepting it creates a rule at the last priority; an imported line "PADARIA SAO JOAO" is categorized by that rule.

### S43 Categorizing a reconciled transaction

After Nubank checking is reconciled with the +3,000.00 transaction of S32, the owner categorizes that transaction as Salary: the checking posting stays `reconciled` and the account stays reconciled.

### S44 Categorization statistics (SC5)

October 2026 holds the S41 Travel transaction (manual), the S41 "UBER *EATS" transaction (rule), the S38 seed (manual) and import (history) and one uncategorized line. `GET /categorization-statistics?from=2026-10-01&to=2026-10-31` returns total 5, rule 1, history 1, manual 2, source 0, uncategorized 1.

### S72 Category tree without cycle

Moving Food under Food › Groceries returns 422 on `parent_id`; the tree is unchanged (A73).

### S73 Archived category

Closing Food › Bakery on 2026-10-31 after the S42 transactions returns 200. An imported "PADARIA SAO JOAO" dated 2026-11-02 stays uncategorized although the S42 rule matches. Reopening Bakery and running rules categorizes it. Closing Uncategorized expense returns 422 `system_account` (A74).

### S74 Merge categories

A budget on Travel and none on Transport. Merging Travel into Transport gives the S41 Travel transaction version + 1 with a Transport posting and method `manual`; a rule with `set_category` Travel now names Transport; Travel is closed; the budget names Transport (A75).

### S75 Transactions of a category subtree

`GET /transactions?account_id=<Food>` lists the S38 Delivery, S40 Groceries and S42 Bakery transactions (A76).

### S76 Category totals

`GET /reports/categories?from=2026-10-01&to=2026-10-31&class=expense` returns Travel total 23.90 (S41) and Food `subtree_total` equal to the totals of Food, Delivery, Groceries and Bakery summed (A77).

### S77 Bulk categorization

Three uncategorized transactions, one with a stale `expected_version`, posted to `POST /transactions/categorize` with one category: results `categorized`, `categorized`, `version_conflict` (A78).

### S78 Rule preview

With the S41 data, previewing "description contains `uber`" → Ride-hailing returns `would_categorize` with no transaction and `conflicts` with the Travel transaction (A81).

### S79 Payee merge

Payees "iFood" and "IFOOD SP" merged into "iFood": the S38 alias names the destination, the transactions of "IFOOD SP" get version + 1, `GET /payees` lists one of the two (A82).

### S98 Voided transactions leave the uncategorized queue (A105)

Two checking transactions stand against Uncategorized expense, and the owner voids one of them, as the S47 pairing voids a card transaction. `GET /transactions?uncategorized=true` returns the other alone, and `GET /transactions` returns both.

## 6.14 Transfers from imports

Transfer scenarios of phase P5b (chapter 3, F4 and F5). Itaú Visa closes on day 3 and is due on day 10; its statement 2026-11 holds 1,500.00 of charges.

### S45 Checking file first

Rule "description contains `pagamento fatura`" → transfer to Itaú Visa. A checking OFX line −1,500.00 "PAGAMENTO FATURA ITAU" on 2026-11-10 creates one transaction: checking −1,500.00, Itaú Visa +1,500.00 `payment` billed on statement 2026-11. A card OFX line +1,500.00 "PAGAMENTO RECEBIDO" on 2026-11-11 matches the card posting; no transaction is created; statement 2026-11 is `paid`.

### S46 Card file first

The card file of S45 is imported first: its line creates Itaú Visa +1,500.00 `credit` against `uncategorized_income`; a line its source types as a payment creates a `payment` against `transfers_in_transit` instead, which the pairing replaces the same way (A88). The checking file then completes that transaction: version 2 holds Itaú Visa +1,500.00 `payment` and checking −1,500.00 confirmed by the checking record; there is one transaction and statement 2026-11 is `paid`.

### S47 Pairing by the owner

Both files are imported before the rule exists. `POST /transactions/{checking}/transfer` with Itaú Visa pairs: the checking transaction holds both postings and both records; the card transaction is voided with reason `paired with <checking>`; the card record points to the checking transaction after the event is delivered.

### S48 Several candidates

Two card lines +1,500.00 on 2026-11-09 and 2026-11-11 are candidates: the transfer returns 409 `pairing_ambiguous`; with `pair_with` naming the second it pairs with that one.

### S49 Reimbursable expense

Rule "description contains `hotel`" → mark reimbursable to Receivable Employer. A card line −800.00 "HOTEL IBIS" creates Itaú Visa −800.00 `charge`, Receivable Employer +800.00 (S18 step 1).

### S50 Transfer without counterpart

`POST /transactions/{id}/transfer` to Savings on an imported checking line −500.00 without candidates gives checking −500.00, Savings +500.00; the transaction has no category postings left.

## 6.15 Aggregator sync

A fake Pluggy server serves the data; the clock is 2026-11-12. The owner's item Nubank has a checking account, a credit card and a savings account. The owner's item Mercado Pago has checking "Mercado Pago" (balance 500.05) with reserved balances "Cofrinho Mercado Livre" and "Algum dinheiro".

### S51 Credentials, item and mapping

The owner stores Pluggy credentials, which Pluggy validates (`POST /auth`), adds item "Nubank" and maps its checking account to Nubank checking from 2026-10-01 and its card to Itaú Visa; the savings account stays ignored.

### S52 First sync of a bank account (SC2)

The first sync of Nubank checking with the S32 lines (−45.90 matching a manual entry, −120.00, +3,000.00) and balance 2,834.10 creates one batch (received 3, matched 1, created 2) and an assertion that reconciles the account. Repeated syncs create no transaction and no assertion.

### S53 Pending card charge posted on its bill

A card line +230.00 `PENDING` without a bill becomes a `charge` of −230.00 with a `pending` posting billed by the cycle. The next sync returns it `POSTED` with a bill due 2026-12-10: the posting turns `cleared` on statement 2026-12 and the batch counts it as updated.

### S54 Installments from the aggregator

A card line 3/6 of 100.00 (purchase 2026-08-14, bill due 2026-11-10) creates an installment plan of six 100.00 installments, first statement 2026-09, and confirms installment 3; a later line 4/6 confirms installment 4 without a new transaction. The plan is the same whether the bank returns every installment at once, one a month or only the current one.

### S55 Line returned with a new id

A line returned with a new id after its old id disappeared confirms the existing transaction, also when the assertion of the first sync reconciled it; there is one transaction and the old record is `withdrawn`.

### S56 Source category

Pluggy category "Food Delivery" mapped to Food › Delivery categorizes a line without a matching rule; its method is `source`. A rule still wins over the mapped category.

### S57 Blocked item and rejected credentials

An item in `LOGIN_ERROR` is not synced; the connection reports the status and no batch is created. Wrong credentials return 422 `aggregator_unauthorized` on `client_secret` and store nothing.

### S58 Two users

Two users with their own credentials and items sync on the same scheduler tick: each ledger receives only its own lines, and neither user can read, map or sync the other's connection (404). The same item id may be connected by both.

### S59 Two integrations of one user

One user holds two integrations, "Meu Pluggy 1" with five items and "Meu Pluggy 2" with three; each connection syncs with its own integration's API key, and a wrong secret on one integration leaves the other syncing.

### S68 Reserved balance mapped to a reserve

`POST /connections` for Mercado Pago lists three external accounts, all `pending`: the checking account and two with subtype `RESERVED_BALANCE`. Mapping "Cofrinho Mercado Livre" to the checking ledger account fails with 422 `validation_failed` on `account_id`; mapping it to reserve "MP Cofrinho" with `sync_from` 2026-11-11 succeeds. With an opening balance of 1,002.92 dated 2026-11-10 and the item updated on 2026-11-10, the sync creates a batch with `received` 0 and balance `recorded` 1,002.92 on 2026-11-10, and an assertion with source `open_finance` that reconciles the account. A reserved balance added to the item later appears as `pending` after the next sync. A reserved balance that the item stops reporting yields a batch with balance status `none`. Nubank, with `reservedBalances: []`, lists no reserve.

### S69 Bounded reserve yield

After S68, the item updated on 2026-11-11 reports 1,003.52: the difference 0.60 is within `B = floor(100292 × 3 × 1 / 3000) = 100`, so the sync records "Yield 2026-11-11 to 2026-11-11" of 0.60 against Yield and the assertion is reconciled with resolution `yield`. On 2026-11-12 it reports 1,004.53: the difference 1.01 exceeds `B = floor(100352 × 3 / 3000) = 100` and stays open; 1,004.52 (difference 1.00) is booked as yield. A reported amount below the settled balance stays open. A reserve with `yield_mode` `none` books no yield.

### S70 Transfer to and from a reserved balance

With "Cofrinho Mercado Livre" and "Algum dinheiro" mapped from 2026-11-11, checking lines of 2026-11-11 with `operationType` `TRANSFERENCIA_SALDO_RESERVADO`: "Dinheiro reservado Cofrinho Mercado Livre" −200.00 creates a transfer of 200.00 from Mercado Pago to MP Cofrinho; "Dinheiro retirado Algum dinheiro" +100.00 creates a transfer of 100.00 from the "Algum dinheiro" reserve to Mercado Pago. "Dinheiro reservado Cofrinho Mercado Livre" −30.00 dated 2026-11-10 is recorded as an ordinary line. "Dinheiro retirado Aaa" +50.00 waits for review with reason `reserve` (A213).

### S90 Renamed reserved balance (A94)

"Aaa" is mapped from 2026-11-11 to MP Reserva with 100.00. The owner renames it "Algum dinheiro"; the sync of 2026-11-12 lists it under the new name, still mapped, and books "Dinheiro reservado Algum dinheiro" −20.00 of 2026-11-12 and "Dinheiro retirado Aaa" +10.00 of 2026-11-11 as transfers with MP Reserva; the reserve meets the reported 110.00. A reserve later created with a renamed reserve's former name takes the lines dated after its name window (A212, S342).

### S91–S97 Matching by score (A98–A104)

The scenarios of `docs/specs/2026-10-20-record-matching-design.md`: a manual entry linked by identical amount, day and payee (S91); a probable entry corrected to the line's amount on match (S92); two rides of one payee and amount ambiguous (S93); another payee creating a transaction (S94); a hotel entry seven days away linked (S95); a linked line's change corrected or, on a reconciled posting, described (S96); entries no line confirmed listed (S97).

### S167–S170 Unconfirmed entries confirmed by line or balance (A133)

The scenarios of `docs/specs/2026-10-28-unconfirmed-entries-design.md`: reserve transfers confirmed by the reserve's balance (S167); a manual entry confirmed by the account's balance (S168); an installment expected at its statement's closing (S169); cancelled installments offsetting their reversals (S170).

### S172–S175 Plan reversal after anticipation (A135)

The scenarios of `docs/specs/2026-10-28-plan-reversal-after-anticipation-design.md`: a cancellation after an anticipation whose statement is open (S172) or closed (S173) reverses each installment once and returns the discount; an installment already anticipated or a cancelled plan is not anticipated (S174); an anticipation's charge offsets the cancellation that reverses it in the unconfirmed list (S175).

### S71 Synced assertion re-evaluated

Nubank checking mapped from 2026-10-01 with the S52 lines and balance 3,834.10, without an opening balance: the first sync records an assertion with an open difference of 1,000.00. The owner records an opening balance of 1,000.00; the next sync, with the same balance, creates no assertion, and the existing one becomes `reconciled` with resolution `none`. An open synced assertion with a second assertion of the same date and amount created through `POST /accounts/{id}/balance-assertions` is reconciled by the next sync; all assertions are `reconciled`.

## 6.15b Card statements from the institution

Scenarios of amendments A85–A93 (`docs/specs/2026-10-20-card-statements-institution-design.md`). Itaú Visa closes on day 3 and is due on day 10 unless a scenario says otherwise.

### S80 Statement facts from a bill

A Pluggy bill due 2026-11-10, closing 2026-11-02, total 230.00 and its line of 230.00 date statement 2026-11 by the bill and return `institution` with an `amount_difference` of 0.00; the sync reconciles the statement. A total of 240.00 returns −10.00 and leaves it open.

### S81 Closing before the due date

Rule due day 5 `following`, `before_due` 7 `preceding`, calendar `br_banking`: 2026-08 to 2026-11 close on 2026-07-29, 2026-08-28, 2026-09-28, 2026-10-29 and fall due on 2026-08-05, 2026-09-08, 2026-10-05, 2026-11-05; a purchase on 2026-08-28 is billed on 2026-10. A bill reporting closing 2026-08-29 (a Saturday) closes the statement on 2026-08-28.

### S82 Manual purchase after re-dating

A purchase of 2026-11-02 is billed on 2026-11; owner facts closing 2026-11-01 move it to 2026-12; purchases of 2026-10-31 and 2026-11-01 are then billed on 2026-11 and 2026-12; removing the facts moves the first purchase back.

### S83 Payment line from the aggregator

`PAGAMENTO_FATURA` −961.85 becomes a `payment` of +961.85 against `transfers_in_transit`; `ESTORNO` −72.90 a `credit` of +72.90.

### S84 Refund before payment

Statement 2026-11 of 1,034.75; a refund of 72.90 on 2026-11-05 and a payment of 961.85 on 2026-11-08 settle it (`paid`). 2026-12 opens with 1,034.75, holds charges 2,281.32, credits 569.57 (prior credits 72.90), payments 1,961.85 (early payments 1,000.00): amount due 784.65, billed amount 1,784.65; 784.65 paid on 2026-12-09 makes it `paid`.

### S85 Early and partial payments

S10 restated: an early payment of 300.00 gives amount due 1,200.00 and billed amount 1,500.00; a partial payment leaves unpaid 500.00 and 2026-12 opens with 1,500.00.

### S86 Installment remainder

Cea 2/3 59.99 seen first, then 1/3 60.01 and 3/3 59.99 pending: the plan holds 60.01, 59.99, 59.99 (179.99); nothing waits in review.

### S87 Installment on the institution's bill

Shopee 1/2 86.14 on the bill due 2026-09-10 projects 2/2 on 2026-10; 2/2 86.13 on the bill due 2026-11-10 moves it to 2026-11, and the purchase totals 172.27.

### S88 Pending payment superseded

A `PENDING` −784.65 without a bill and a `POSTED` −784.65 with a bill, both 2026-11-05, give one transaction; a pending and a posted charge five days apart stay two.

### S89 Card sync start and opening

Mapping from 2026-07-01 with the bills due 2026-07-06 (closing 2026-06-28, total 701.48) and 2026-08-05 (total 773.54): the line of 2026-06-30 on the second bill is imported, a line on the first is not, an opening balance of 701.48 is billed on 2026-07, and both statements match their bills.

## 6.16 Planning views

Planning scenarios of phase P7 (chapter 3, F7; chapter 5, 5.3). The clock is 2026-11-01 unless a scenario says otherwise; Landlord is a payee. S27 to S29 are tested as `TestS27MonthlyRent`, `TestS28Day31Dates` and `TestS29SubscriptionWithPriceChangeAndPause`; S27 realizes its 2026-11 occurrence with a PIX of −2,100.00 to Landlord on 2026-11-05.

### S60 Budget with rollover

Budget Food 1,800.00 from 2026-10 with rollover; October spends 1,500.00 (Supermarket 1,000.00, Restaurant 500.00), November 2,300.00; 2,000.00 is effective from 2026-12. October: planned 1,800.00, carried 0.00, available 300.00. November: planned 1,800.00, carried 300.00, available −200.00. December: planned 2,000.00, carried −200.00, spent 0.00, available 1,800.00.

### S158 Budget plan figures

Today 2026-12-02. A card closing on day 3 holds a 3-installment purchase of 900.00 on 2026-10-20 and a 2-installment purchase of 400.00 on 2026-12-02; both bill an installment on the 2026-12 statement, so `/commitments` reports 500.00. Income schedules Salary 7,200.00 and Freelance 1,300.00, a savings schedule of 500.00, a rent bill of 2,100.00 and a Rent budget of 2,100.00 from 2026-12. The plan of 2026-12: source `expected_income`, expected income 8,500.00 in two items, reference 8,500.00, installments 300.00 (the October purchase only), savings 500.00, planned 2,100.00, unassigned 5,600.00. The bill is not subtracted.

### S159 Average income

Today 2026-12-01. Salary of 6,000.00 on 2026-09-05, 2026-10-05 and 2026-11-05: average income 6,000.00 over 3 months. With only 2026-11-05: 6,000.00 over 1 month. With no posting, no average.

### S160 Nested budgets in the plan

Budgets Food 1,800.00 and Supermarket 1,000.00, a child of Food, from 2026-11: planned 1,800.00; the Supermarket row is not counted.

### S161 A plan save replaces the version of its month

Today 2026-11-10. Food 1,800.00 from 2026-11 and 2,000.00 from 2027-01. Saving the plan of 2026-11 with Food 1,500.00 leaves the versions 2026-11 1,500.00 and 2027-01 2,000.00, and the row reports its next change in 2027-01; the same save twice changes nothing more. Saving 2026-12 with 1,600.00 adds a version between them.

### S162 A plan save creates budgets

Pets 210.00 and Gifts 0.00, neither with a budget: Pets gets a budget without rollover from 2026-11; Gifts gets none.

### S163 A plan save is checked before anything is written

Each is a 422 that names its field and writes nothing: a month before the current one (`month`); a category listed twice (`amounts[1].category_id`); a category of another user, an income category or a closed category (`amounts[0].category_id`); a negative amount (`amounts[0].amount`); an amount in another currency (`amounts[0].amount.currency`); the fixed source without an amount, with a negative one (`fixed`) or in another currency (`fixed.currency`).

### S164 Reference choice

Without postings, schedules or a stored choice the source is `fixed` with no reference and no unassigned amount. After a salary of 6,000.00 on 2026-11-05, the source is `average_income` and the reference 6,000.00. Saving a plan with the fixed source of 6,000.00 stores the choice for every month.

### S165 The plan through the assistant

Today 2026-12-01, a salary of 6,000.00 on 2026-11-05 and a Rent budget of 2,100.00 from 2026-12: `get_budgets_and_goals` with kind `plan` returns source `average_income`, reference 6,000.00, planned 2,100.00 and unassigned 3,900.00, the figures of `GET /budget-plan`.

### S166 Saving a plan through the assistant

`manage_budget_or_goal` with `save_plan` for 2026-11, source `fixed` 8,500.00, Food 1,500.00 (from 1,800.00) and Rent 2,100.00 (no budget) previews the date, the source, the reference and each budget with its amount before and after, and writes nothing; running it leaves planned 3,600.00 and unassigned 4,900.00. Without `amounts` it is an argument error.

### S144 Delete a budget

A budget of Food 1,800.00 from 2026-10, with 50.00 booked on Food on 2026-11-10: `DELETE /budgets/{id}` returns 204 and removes its amounts; the budget then reads as 404 from `GET` and from a second `DELETE`, and the list no longer holds it. Another user's budget is a 404. The category and its postings stay, and the category takes a new budget of 1,500.00 from 2026-11 whose progress in 2026-11 is planned 1,500.00, carried 0.00, spent 50.00, available 1,450.00. Through the assistant, `manage_budget_or_goal` with `delete_budget` previews the deletion as destructive before it runs.

### S61 Goal progress

Goal "Emergency" of 30,000.00 due 2027-06-30 over Emergency fund, whose balance is 10,083.41: current 10,083.41, remaining 19,916.59, progress 3361 basis points.

### S62 Projection

Nubank checking holds 5,000.00 on 2026-11-01, with the rent of S27 and a salary of 5,000.00 on the 5th business day of each month. The projection to 2026-12-31 has the points 2026-11-05 −2,100.00 (2,900.00), 2026-11-09 +5,000.00 (7,900.00; 2026-11-02 is a holiday), 2026-12-07 −2,100.00 (5,800.00) and 2026-12-07 +5,000.00 (10,800.00); the closing balance is 10,800.00.

### S63 Committed amount

With the laptop of S06, the rent of S27, the streaming of S29 and the salary of S62, `GET /commitments?month=2026-12` returns installments 333.33, occurrences 2,139.90 (rent 2,100.00, streaming 39.90) and total 2,473.23; the salary is not counted.

## 6.17 Prices and positions

Scenarios of phase P8 (chapter 3, F9; chapter 5, 5.6). The clock is 2026-11-01 unless a scenario says otherwise; S21 buys on 2026-10-05 and sells on 2026-10-20, S22 is dated 2026-10-26. S16, S17, S21 and S22 are tested as `TestS16ForeignPurchase` (`POST /foreign-purchases`, IOF 350 bp on Taxes › IOF), `TestS17CurrencyExchange` (`POST /exchanges` on 2026-10-14), `TestS21PurchaseAndSale` (`POST /trades`) and `TestS22InvestmentIncome` (`POST /investment-income`, the JCP without `withheld`). In S17, a `manual` USD/BRL price of 5.5000 and a `bcb_ptax` price of 5.4950 on 2026-10-30 give the valued balance of Wise USD on 2026-11-01: 5,500.00 with the manual price.

### S64 Position and realized result

After S21, a `b3_cotahist` price of MXRF11 of 9.36 on 2026-10-29: `GET /positions?date=2026-11-01` returns XP MXRF11 with quantity 100, cost basis 1,008.27, average cost 10.0827, price 9.36 and market value 936.00; `GET /realized-results?year=2026` returns one result of 33.77 in 2026-10.

### S65 Income events

After S22, `GET /income-events?year=2026` returns the dividend of 10.00, `exempt`, withheld 0.00, and the JCP of 45.00, `exclusive`, withheld 7.88.

### S66 Committed amount in another currency

A subscription of 9.99 USD per month on Wise USD, Subscriptions, from 2026-12-10, with USD/BRL 5.5000 on 2026-10-30: `GET /commitments?month=2026-12` counts it as 54.94 (54.945 rounded half to even) and lists the price.

### S67 Goal in another currency

Goal "Trip" of 2,000.00 USD over Wise USD (1,000.00 USD) and Nubank checking (2,750.00 BRL) with USD/BRL 5.5000: current 1,500.00 USD, remaining 500.00 USD, progress 7500 basis points.

### S119 Edit a goal

Goal "Emergency" of 30,000.00 over Emergency fund (10,083.41), edited with `PATCH /goals/{id}` to name "Reserve" and target 20,166.82: current 10,083.41, remaining 10,083.41, progress 5000 basis points. A second edit sets the due date 2028-01-31 and the accounts Emergency fund and Nubank checking, which net to zero: current 0.00, progress 0; the name stays "Reserve". A name used by another goal, a target of zero, an account that is not a balance account and an empty body are rejected; another user's goal is a 404. A goal that cannot be measured, such as a target in a currency without a stored price, is not stored by either `POST` or `PATCH`.

### S120 Delete a goal

`DELETE /goals/{id}` returns 204; the goal then reads as 404 from `GET` and from a second `DELETE`, the list no longer holds it, and its accounts stay. Another user's goal is a 404. The name is free for a new goal.

### S121 Goal over a brokerage

Amendment A120: a goal sums the value of an account and of its sub-accounts, each instrument at its stored price, so a brokerage parent holding cash and securities is a valid goal account. XP cash holds 500.00, XP MXRF11 holds 10 shares and MXRF11/BRL is 10.5 on 2026-10-30: a goal of 1,000.00 over XP shows current 605.00, progress 6050 basis points, and lists the price. Without the price the goal is refused with `price_missing` and not stored. A goal that holds an account and one of its sub-accounts is refused with `validation_failed` on `account_ids`. The goal lists what current is made of (amendment A121): XP cash 500.00 (value 500.00) and 10 MXRF11 (value 105.00), one part per goal account and instrument with a non-zero quantity. A projection of the brokerage parent stays refused (`currency_unsupported`).

### S122 Tax treatment by subtype

Amendment A122: an instrument has an optional subtype, an identifier of 2 to 40 lowercase letters, digits and underscores. The jurisdiction of the owner derives the tax class from type, subtype and exchange. For `br`, a coupon of a `fixed_income` instrument with subtype `cri` reads `tax_treatment` `exempt` in `GET /income-events`; with `cdb`, with no subtype, or on a `stock` with an unknown subtype it reads `exclusive`, as before. `GET /instrument-subtypes?type=fixed_income` lists `cdb`, `cra`, `cri`, `debenture_incentivada`, `lca`, `lci`, `rdb`, `tesouro`; `type=fund` lists `equity_fund`, `fixed_income_fund`, `multimarket`; a type without subtypes, and any type for an owner without a jurisdiction, lists none. A subtype outside the identifier pattern is a 400.

### S171 Editing an instrument

Amendment A134 (type: A224): `PATCH /instruments/{code}` replaces the name, the exchange and the subtype of a security; an exchange or subtype absent from the body is cleared. Code, type, scale and quote currency stay as defined (A59). MXRF11 (`reit`, `BVMF`, no subtype) edited to name "Maxi Renda FII", exchange absent and subtype `fii_papel` reads back with that name, no exchange and that subtype, and its manual price of 2026-10-22 is unchanged. A blank name is 422 `validation_failed` on `name`; a currency is 422 `validation_failed` on `code`; an unknown code is 404.

### S126 Return of a brokerage

Amendment A123: `GET /reports/return?account_id=&from=&to=&value_in=` returns the money-weighted annual return of an account and its sub-accounts over at most 366 days. XP cash receives 1,000.00 from checking on 2025-10-15 and a dividend of 50.00 arrives on 2026-10-26: over 2025-11-01 to 2026-10-31 the opening is 1,000.00, the closing 1,050.00, there is no flow and `annual_bp` is 500. A further contribution of 1,000.00 on 2026-04-30 gives the flow list with that date and amount, a closing of 2,050.00 and `annual_bp` 333. Valued in USD with a constant price the rate is the same; without a price the request is 422 `price_missing`.

### S127 Return undefined

A period in which the opening value and every contribution are zero returns 422 `return_undefined`. A period over 366 days and `from` after `to` are 400 on `to`; an unknown account is 404.

### S130 Trailing return of a goal

Amendment A124: a goal reads `trailing_return` (`period_months`, `annual_bp`), the money-weighted return of its accounts taken as one tree over the last 12 months, valued in the goal currency. On 2026-11-12, Emergency fund receives 1,000.00 on 2025-10-15 and on 2026-04-30 and 50.00 of income on 2026-10-26, and moves 30,000 to Reserve B on 2026-06-10: a goal over both accounts has opening 1,000.00 on 2025-11-11, one flow of 1,000.00, closing 2,050.00, `period_months` 12 and `annual_bp` 326; the transfer between its accounts is not a flow. A goal whose accounts have no posting, only two months of postings, or no flow in the window has no `trailing_return`.

### S128 Allocation of the assets

Amendment A125: `GET /reports/allocation?date=&by=&value_in=` groups the value of the asset accounts at a date, each account counting its own balance valued with the stored prices of the date. Checking 500.00, XP cash 400.00 and 10 MXRF11 at 10.50 (105.00): by `type` the groups are `currency` 900.00 (8955 basis points) and `reit` 105.00 (1045), the total 1,005.00; by `currency` one group `BRL` of 10000; by `institution` XP 505.00 (5024) and the account without institution, key empty, 500.00 (4976). Groups are ordered by value, largest first, shares are rounded down and the last group takes the remainder. A `by` outside type, currency and institution is 400 on `by`; a value currency without a price is 422 `price_missing`; a date before any posting has total 0.00 and no group.

### S129 Net worth

`GET /reports/net-worth?date=&value_in=` returns the assets, the liabilities as a positive amount and their difference. With the accounts of S128 and a loan of 1,200.00 received into checking: assets 2,205.00, liabilities 1,200.00, net 1,005.00.

### S123 Accrued CDB

Amendment A126: a `fixed_income` instrument with terms gets a price a business day with source `accrual`. A CDB of 1,000.00 at 110% of the CDI issued on 2026-01-02, with the CDI at 0.055131% a day on the five following business days, is priced 1,000.00 on the issue date, then 1,000.606441, 1,001.213249770686, 1,001.820426535091, 1,002.427971516379 and 1,003.035884937853. A manual price of the same day wins over the accrued one. New terms delete the accrued prices; the next tick accrues them again (face value 2,000.00 prices 2,006.071769875707 on 2026-01-09). After maturity nothing is priced.

### S124 Accrued Tesouro IPCA+

A security issued on 2026-01-01 with a spread of 600 basis points over the IPCA, with the monthly IPCA of 0.42% (January) and -0.30% (February), is priced 1,004.640317564163 on 2026-01-30 (only the spread accrues), 1,009.343088309557 on 2026-02-02 (January applied from the day after its last day) and 1,010.823298922241 on 2026-03-02.

### S125 Terms

`PUT /instruments/{code}/terms` stores the face value, the issue and maturity dates, the index, its percent in basis points, the annual spread and the day count of a `fixed_income` instrument. Terms on another type are refused (`validation_failed` on `code`), as are a maturity not after the issue, `bus252` without the `cdi` index and values outside the contract.

## 6.18 Text capture

The scenarios, their fixture and the grammar they exercise are in `docs/specs/2026-10-21-text-capture-design.md`, section Scenarios: S99–S110 read text through `POST /capture/preview` (`internal/capture/preview_test.go`); S111 and S112 record through `POST /transaction-batches` (`internal/ledger/transaction_batch_test.go`). S151–S153 read text against a reference date (amendment A128, `TestPreviewReferenceDate`).

## 6.19 Daily flows

Amendment A119 of `docs/specs/2026-10-21-account-card-design.md`: `GET /reports/flows` returns the booked inflow and outflow of one account per day. Tests in `internal/reporting/flows_test.go`.

### S115 Inflow and outflow of a checking account

On 2026-10-05, Nubank checking receives a salary of 1,000.00, pays a purchase of 25.00 and transfers 100.00 to savings; on 2026-10-07 it pays 8.00. Flows of October: 2026-10-05 inflow 1,000.00 and outflow 125.00; 2026-10-07 outflow 8.00. Savings: 2026-10-05 inflow 100.00.

### S116 Flows of a credit card

Purchases of 30.00 and 20.00 on 2026-10-12, a refund of 10.00 and a statement payment of 40.00 on 2026-10-13: outflow 50.00 on 2026-10-12, inflow 50.00 on 2026-10-13.

### S117 Day with a zero net delta

An income of 7.00 and a purchase of 7.00 on the same day are listed as inflow 7.00 and outflow 7.00, and the balance series is unchanged.

### S118 Flow problems

A voided transaction has no flow. `to` before `from`, or a range longer than 366 days, returns 400 `invalid_request` on `to`; another user's account returns 404 `not_found`.

## 6.20 Assistant

`docs/specs/2026-10-23-assistant-chat-design.md`, section 16, and ADR 020. A scripted `llmtest` provider stands in for the language model. Tests in `internal/assistant`.

### S131 Read question

The model calls `get_balances`; the stream sends `turn`, `step` `get_balances` and `answer`, and the answer is stored with outcome `answered`. Test: `TestTurnRead`.

### S132 Write proposal

The model calls a write tool; a pending proposal exists and nothing is written until confirmation. Test: `TestProposeStoresPending`.

### S133 Confirmation executes once

The first confirm answers 200 `executed` and writes once; a second confirm answers 409 `proposal_closed`. Tests: `TestConfirmExecutesOnce`, `TestConfirmConcurrent`.

### S134 Expiry

A proposal confirmed 15 minutes after its creation answers 409 `proposal_expired`. Test: `TestConfirmExpired`.

### S135 Stale proposal

A proposal whose previewed data changed before confirmation answers 409 `proposal_stale`. Test: `TestConfirmStale`.

### S136 Isolation

User B gets 404 for user A's conversation and proposal, and A's IDs passed to B's tools return not found. Tests: `TestProposalOtherUser`, `TestTurnOtherUserConversation` and the `OtherUser` test of each tool.

### S137 Exhausted

With every target cooling down, the turn answers 429 `assistant_exhausted` with `retry_at` and sends no request. Test: `TestTurnExhausted`.

### S138 Declared limit

A target over its declared requests per day is skipped; with no other target the call fails as exhausted, and another user is not affected. Test: `TestDailyLimitS138`.

### S139 Fallback within a turn

The first target answers a tool call, then fails for quota; the turn restarts on the next target and answers once. Test: `TestTurnFallback`.

### S140 Step limit

A model that keeps calling tools gets tool choice none on step 6; that step's answer is stored with outcome `step_limit`. Test: `TestTurnStepLimit`.

### S141 Deletion

Deleting a conversation deletes its messages and proposals; deleting all leaves the user with none and another user's conversations untouched. Tests: `TestConversationListAndDelete`, `TestConversationDeleteAll`.

### S142 Injection

A payee named with an instruction to void transactions reaches the model only inside a tool result; the scripted void stays a pending proposal, and a rejection leaves the transaction intact. Test: `TestInjectedPayeeNeedsConfirmation`.

## 6.21 Cash view and statement analytics

Scenarios of phase P9 (`docs/plans/2026-10-26-p9-cash-view.md`, CV1 to CV6). Itaú Visa closes on day 3 and is due on day 10; amounts are BRL; `GET /reports/categories?class=expense&view=cash` reads one month.

### S145 Statement paid in two parts

Statement 2026-11 holds Supermarket 230.00 (2026-10-14) and laptop installment 1/3 333.34 (S06), amount due 563.34. Payments of 200.00 on 2026-11-10 and 363.34 on 2026-12-05. Cash view: November 2026 Food › Supermarket 81.65, Electronics 118.35 (20,000 × 23,000 / 56,334 = 8,165.58 cents, floor 8,165; 11,834 plus the cent left, the largest share); December 2026 Food › Supermarket 148.35, Electronics 214.99.

### S146 Refund on the statement

Statement 2026-11 holds Supermarket 230.00, laptop installment 1/3 333.34 and a refund of 30.00 of the supermarket purchase dated 2026-10-25, amount due 533.34, paid in full on 2026-11-10. Cash view of November 2026: Food › Supermarket 200.00, Electronics 333.34. Accrual view of October 2026: Food › Supermarket 200.00 (230.00 − 30.00), Electronics 1,000.00.

### S147 Anticipated installments

On 2026-11-15 laptop installments 2/3 and 3/3 (666.66) are anticipated to statement 2026-12 for 640.00 (Discounts 26.66). Statement 2026-12 holds installment 2/3 333.33, its reversal −333.33 and the anticipation 640.00; statement 2027-01 nets 0.00. Statement 2026-11 is paid in full on 2026-11-10 and statement 2026-12, 640.00, on 2026-12-10. Cash view of December 2026: Electronics 666.66 (expense) and Discounts 26.66 (income).

### S148 Analysis of a statement

Statement 2026-12 holds laptop installment 2/3 333.33 (bought 2026-10-20), a Food › Supermarket purchase of 150.00 on 2026-11-20, the annual fee of 40.00 on Fees on 2026-12-01 and a refund of 20.00 of that purchase on 2026-11-25. `GET /statements/{id}/analytics`: Electronics installments 333.33; Food › Supermarket purchases 150.00 and credits −20.00, total 130.00; Fees charges 40.00; totals purchases 150.00, installments 333.33, charges 40.00, credits −20.00, total 503.33.

### S149 Financed statement

Statement 2026-11 of S145, amount due 563.34, receives a payment of 163.34 on 2026-11-10: November 2026 Food › Supermarket 66.68, Electronics 96.66. On 2026-11-12 the unpaid 400.00 (Supermarket 163.32, Electronics 236.68) is financed in 3 installments of 140.00 on statements 2026-12 to 2027-02, Interest 20.00 (CV7). Installment 1 carries Supermarket 54.44, Electronics 78.90 and Interest 6.66 (14,000 × 23,668 / 42,000 = 7,889.33, floor 7,889, plus the cent left); installments 2 and 3 carry Supermarket 54.44, Electronics 78.89 and Interest 6.67. The financing is not a payment: November 2026 keeps 66.68 and 96.66. Statements 2026-12 (laptop 2/3 333.33 and installment 1) and 2027-01 (laptop 3/3 and installment 2) are paid in full, 473.33 each, on the 10th, and 2027-02 (140.00) on 2027-02-10. Cash view: December 2026 Food › Supermarket 54.44, Electronics 412.23, Interest 6.66; January 2027 Food › Supermarket 54.44, Electronics 412.22, Interest 6.67; February 2027 Food › Supermarket 54.44, Electronics 78.89, Interest 6.67. `listCategoryCashPayments` of Interest in December 2026 returns one amount of 6.66 naming statement 2026-12 and the payment of 2026-12-10 (N20). Two reads of the same period return the same totals, and the amounts of `listCategoryCashPayments` of each category sum to its total.

### S150 Revolving credit

Statement 2026-11 of S145 receives 263.34 on 2026-11-10: November 2026 Food › Supermarket 107.51, Electronics 155.83. The unpaid 300.00 revolves; the issuer bills revolving interest of 45.00 on 2026-12-01 on statement 2026-12, beside laptop 2/3 333.33 (CV9). A payment of 500.00 on 2026-12-10 pays the 300.00 left of 2026-11 (Supermarket 122.49, Electronics 177.51), then 200.00 of 2026-12 (Electronics 176.22, Interest 23.78: 20,000 × 4,500 / 37,833 = 2,378.86, floor). A payment of 178.33 on 2027-01-05 pays the rest of 2026-12. Cash view: December 2026 Food › Supermarket 122.49, Electronics 353.73, Interest 23.78; January 2027 Electronics 157.11, Interest 21.22.

### S157 Index history for calculators

| Step | Expected |
|---|---|
| `br_cdi` and `br_ipca` enabled, today 2026-03-15, no security follows them, one feed tick | CDI requested from 2006-03-15 in windows of at most 1,826 days; IPCA from 2006-03-15 |
| `GET /indexes` | `cdi` with period `day`, `ipca` with period `month`, each with its first and last stored date |
| `GET /indexes/ipca/rates?from=2026-01-01&to=2026-02-28` | the two stored months, oldest first, rates as decimal fractions |
| `GET /indexes/selic/rates?...` | 404 `not_found` |
| range of 7,321 days | 422 `validation_failed` on `to` |

## 6.22 Financial indicators

`GET /reports/indicators?month=` (`docs/specs/2026-10-26-analytics-design.md`, section 4) returns 12 month entries, oldest first, the last one the month asked. Ratios are basis points truncated toward zero.

### S154 Indicators of a month

Today 2026-10-20, base BRL. Every month from 2026-04 to 2026-10: salary 5,000.00 on the 5th, rent 1,500.00 on the 10th, food 1,000.00 on the 15th, all on Checking. A personal loan of 10,000.00 enters Checking on 2026-06-01; installments of 1,250.00 (principal 900.00, interest 350.00 on the system category Interest) leave Checking on the 20th from 2026-07 to 2026-10. Checking moves 3,000.00 to Savings on 2026-08-01, 4,000.00 to Locked CDB (savings, `excluded_from_liquidity`) on 2026-08-02, 600.00 to Meal card (benefit) on 2026-10-01, and exchanges 500.00 for 100.00 USD into Dollars (wallet, USD) on 2026-10-01; USD is priced 5 BRL on 2026-10-20. A subscription of 50.00 to Streaming is expected on 2026-10-25.

Month 2026-10: income 5,000.00; expense 2,850.00; committed 50.00; debt service 1,250.00; liquid balance 17,900.00 (Checking 14,400.00, Savings 3,000.00, Dollars 500.00); liabilities 6,400.00; mean income 5,000.00 and mean expense 2,675.00 over 2026-04 to 2026-09. Savings rate 4300; trailing savings rate 4650; liquidity 66915; committed share 100; debt service share 2500.

Savings rate by month from 2025-11: `no_income` five times, then 5000 (2026-04 to 2026-06), then 4300 (2026-07 to 2026-10). Trailing savings rate: `insufficient_history` from 2025-11 to 2026-06, then 5000, 4825, 4720, 4650.

### S155 Books without history

Today 2026-10-20. The owner has no posting; another user records a salary of 5,000.00 in 2026-10. The owner's 2026-10: every amount 0.00, no mean, savings rate `no_income`, the four other ratios `insufficient_history`.

### S156 Income without expense

Today 2026-10-20. Salary 5,000.00 on the 5th of 2026-07 to 2026-10, nothing else. Month 2026-10: savings rate 10000; trailing savings rate 10000; liquidity `no_expense`; committed share 0; debt service share 0.

### S280 Spending pace of the month

Overview widget of `docs/specs/2026-11-04-spending-pace-design.md`. Today 2026-10-17, base BRL. Expenses: Food 400.00 on 2026-09-05, Rent 1,000.00 on 2026-09-12, Leisure 300.00 on 2026-09-20, Food 500.00 on 2026-10-05, Rent 1,000.00 on 2026-10-12, and Travel, a USD category, 50.00 USD on 2026-10-10. Current range 2026-10-01 to 2026-10-17: 1,500.00, Travel left out. Previous range 2026-09-01 to 2026-09-17: 1,400.00. The widget shows 1,500.00, a delta of +7.1% and the previous 1,400.00.

### S281 Previous month shorter than today's day

Today 2026-03-31, base BRL. Food 800.00 on 2026-02-27 and Food 1,000.00 on 2026-03-30. Previous range 2026-02-01 to 2026-02-28: 800.00. The widget shows 1,000.00, a delta of +25% and the previous 800.00.

### S282 No spending in the previous range

Today 2026-10-17, base BRL. No expense in 2026-09; Food 500.00 on 2026-10-05. The widget shows 500.00, no delta, and states that the same days of the previous month hold no spending.

### S278 Card statement in the forecast of the month

Today 2026-11-04, base BRL. A card statement due on 2026-11-05 owes 1,200.00, and a subscription on the card is expected on 2026-11-30. The forecast of the Available accounts on 2026-11-05 is 1,200.00 below the forecast on 2026-11-04; the balance chart marks the statement on 5 November and draws no line on 30 November (`docs/specs/2026-11-04-balance-forecast-design.md`, B1).

### S279 Every occurrence ahead marked on the balance chart

Four occurrences ahead fall within eight days of each other. The balance chart draws four lines, with priorities that follow their absolute amounts (B5).

### S283 Net worth at the end of each day

Checking holds 1,000.00 on 2026-10-19. A loan pays an expense of 300.00 on 2026-10-20. `getNetWorthDays` from 2026-10-19 to 2026-10-21 answers three days with net worth 1,000.00, 700.00 and 700.00 (`docs/specs/2026-11-04-net-worth-days-design.md`, D1).

### S284 Range of the daily net worth

`getNetWorthDays` with `from` after `to`, or with a range of more than 62 days, answers 400 `invalid_request` on `to` (D2).

### S286 Net worth forecast to the month's end

Today 2026-10-17, base BRL, net worth 1,005.00. Food spends 10.00 a day from 2026-06-01, no occurrence realized, so July to September are the history months; a rent of 2,000.00 from checking is expected on 2026-10-25. The card "Net worth by day · October 2026" draws the forecast 935.00 on 24 October and −1,135.00 on 31 October, and states that it reads the schedules and the last 3 months (`docs/specs/2026-11-05-net-worth-forecast-design.md`, F2 to F7, F10).

### S287 No forecast for a past month

The same book with September 2026 picked: the card draws no forecast and no forecast sentence (F1).

### S288 Tooltip of a forecast day

A forecast day of 500.00 with a likely range of 400.00 to 525.00, the rent of −2,000.00, an estimate "Family (estimated)" of −400.00 and an estimated day-to-day amount of −10.00 states "Forecast R$500.00", "Likely range R$400 to R$525", and under "On this day" "Rent −R$2,000.00", "Family (estimated) −R$400.00" and "Estimated day-to-day −R$10.00"; a day nothing moves states no "On this day"; today states "Net" and no range. Privacy mode masks the amounts (F9, F12).

### S486 Net worth forecast of the next month

The book of S286 with the rent of 2,000.00 expected on 2026-11-25 and the picked month November 2026 (the month after the current one). The card draws no "Net" line, draws the forecast from 2026-11-01 to 2026-11-30 starting from the value of 2026-10-31 (−1,135.00), and states "Dashed: forecast from the schedules and the last 3 months" and the sentence that it starts from the forecast for the end of October 2026 (`docs/specs/2026-11-05-net-worth-forecast-design.md`, F13 to F18).

### S487 The month control stops after the next month

On the card of S486 the next step of the month control is disabled and the previous step is enabled (F19).

### S176–S181, S184 Card billing certainty (A136–A139, A141)

The scenarios of `docs/specs/2026-10-29-card-billing-certainty-design.md`: a reviewed match moves a manual charge to the bill its line states (S176); a closed statement that differs from the institution's total proposes the provisional postings that explain it (S177); a statement the owner chose stays (S178); a difference no posting explains shows as a possible rounding difference of the source (S179); an open statement leaves out the previous statement's unpaid amount until it is overdue (S180); a statement is reconciled as soon as a later entry closes its difference with the institution's total (S181); a pending line stays on its statement whatever the reported total, and moves only by its bill (S184).

### S182–S183 Review keeps up with the ledger (A140)

The scenarios of `docs/specs/2026-10-29-review-reopen-design.md`: the review offers an entry recorded after the import (S182); a discarded line can be reopened and matched (S183).

### S185 Repeated card payment (A142)

The scenario of `docs/specs/2026-10-30-repeated-card-payment-design.md`: a card payment the source returns under a second id waits for review instead of paying the card twice (S185).

### S186–S191 Shared books and setting levels (ADR 029)

The scenarios of `docs/specs/2026-10-30-shared-books-design.md`, section 7: setup creates a book, its `owner` membership and its ledger settings (S186); two members see only the rows of their own book (S187); "today" follows the time zone of the book (S188); appearance follows the member across sessions (S189); only an admin changes the sync interval of the instance (S190); a deleted membership ends its session (S191).

### S192–S198 Households (P11)

The scenarios of `docs/specs/2026-10-30-households-access-design.md`, section 6: each book role reaches the operations of its rank and no other (S192); a book without membership is 404 (S193); an invitation creates a new member (S194) or adds a book to an existing one (S195); a book keeps its last owner (S196); a demoted member's token stops writing (S197); a conversation is visible only to its member (S198).

### S199–S202 Second factor (P11)

The scenarios of `docs/specs/2026-10-30-households-access-design.md`, section 6: a login finishes with a TOTP code once (S199), with a passkey (S200) or with a recovery code once (S201); five wrong values end the pending login (S202).

### S214–S221 Protected data (A154–A159)

The scenarios of `docs/specs/2026-10-31-protected-data-design.md`, section "Scenarios": external mode backs up before a migration and a failed backup stops it (S214); a periodic backup writes an encrypted copy and keeps seven (S215); a copy restored into an empty database reproduces every row, balance and net worth (S216); a folder that cannot be written marks the copy late (S217); a member gets 403 on every operation of the module (S218); the diagnostic file holds no seeded name, description or amount (S219); the version check runs only with consent and on a release binary (S220); "Back up now" writes a backup and a copy (S221).

### S222–S233 Installation (A160–A166)

The scenarios of `docs/specs/2026-10-31-installation-design.md`, section "Scenarios": an invalid configuration is reported in one block without the value of a secret (S222, S223); an unknown variable logs a warning (S224); a failed database connection or listen names its variable (S225, S226); the installation script installs, runs again, takes a free port and stops without Docker (S227 to S230); the first access names the book and its time zone (S231) and preselects the region of the browser (S232); the owner checks macOS and Windows (S233).

### S241–S252, S265–S267 First use and help (A173–A177, A191)

The scenarios of `docs/specs/2026-11-01-first-use-help-design.md`, section "Scenarios": setup opens the walkthrough and an invitation does not (S241, S242); the walkthrough creates accounts and offers the entry choices (S243 to S245); the first steps list points to it (S246); the overview notices due statements and budgets over their amount (S247, S248); the help pages cover installation, connecting a bank and troubleshooting (S249, S250); a person reaches the first transaction without a typed address (S251); the owner checks the walkthrough and the help pages in the review (S252). The walkthrough resumes where it was left and starts empty after its last step (S265 to S267, A191).

### S253–S261 Test and release (A178–A186)

The scenarios of `docs/specs/2026-11-01-test-release-design.md`, section "Scenarios": an archive that names a row of another book is refused and writes nothing (S253, S254); the institution catalogue finds an entry by trade name and lists prefix matches first (S255, S256); the walkthrough institution reads as required (S257); a pt-BR count of 0 reads "Nenhum resultado" (S258); the exit criteria of P10 to P15 are checked (S259); testers record their first transactions without outside help (S260); real accounts of three banks for two weeks end with no open defect of data loss, duplication or exposure (S261).

### S268–S272 Update flow (A192–A197)

The scenarios of `docs/specs/2026-11-03-update-flow-design.md`, section "Scenarios": `equori version` names the archive version (S268); the notice shows the upgrade command of a compose instance and none of a managed one (S269, S270); the script names the version it replaces (S271); the API reports the distribution (S272).

### S289–S294 Bulk actions (A201–A203)

The scenarios of `docs/specs/2026-11-05-bulk-actions-design.md`, section 4: several lines in review are resolved in one request, each with its own status (S289), and a request that names a line twice is refused (S290); several transactions are voided in one request, each with its own status (S291), and a request that names a transaction twice is refused (S292); the review queue leaves group lines out of a selection and confirms the suggestion of probable lines only (S293); a bulk command states what it wrote and names each refused record with its reason (S294).

### S295–S301 CSV reading and column suggestion (A204–A207)

The scenarios of `docs/specs/2026-11-06-csv-reading-and-column-suggestion-design.md`: a file with rows above the header and a total row under the data imports its lines only (S295); a debit marker in a sign column or after the amount makes a matching line negative and keeps any other line as written (S296); a date with one-digit day and month and a date followed by a time import under their layout (S297); a column suggestion returns header names and sends the model no digit and no name of the sample (S298); an answer that fails validation returns 422 `csv_suggestion_unusable` (S299); no target that answers returns 503 `csv_suggestion_unavailable` (S300); a UTF-8 OFX file that declares Windows-1252 keeps its text (S301).

### S262 Rate, target and gap

A fixed reference of 8,000.00 and savings occurrences of 1,200.00 in the month: `GET /budget-plan` returns `savings_rate_bp` 1500. After `PUT` with `savings_target_bp` 2500, the plan returns `savings_target` 2,000.00 and `savings_gap` 800.00. With savings of 2,000.00 or more the gap is 0.00.

### S263 Stored and cleared

Before any save, the plan has no `savings_target_bp`. A `PUT` with 2500 makes `GET` return 2500. A second `PUT` without the field makes `GET` return no target and no `savings_target` or `savings_gap`. A reference of zero returns no rate, target amount or gap, and keeps `savings_target_bp`. A save through `manage_budget_or_goal` with `save_plan` keeps the stored target.

### S264 Invalid target

`PUT` with `savings_target_bp` 10001 and with -1 return 422 on `savings_target_bp` and store nothing. A direct SQL update of the column to 10001 is rejected by the database.

### S302–S339, S349–S351 Return compared with an index (A208)

The scenarios of `docs/specs/2026-11-06-return-index-comparison-design.md`: a savings account of 10,000,000.00 credited each CDI day after the first with the CDI of the days since the previous credit returns, over 2026-01-02 to 2026-01-16, `period_bp` 55 and `benchmark` `cdi` from 2026-01-05 until 2026-01-15, `days` 9, `skipped` 2, `credits` 9, `index_bp` 50, `return_bp` 50, `percent_bp` 10000 and `annual_bp` and `index_annual_bp` 1490 (S302); a deposit of 10,000,000.00 on 2026-01-06 keeps the figures, and a period to 2026-01-20 keeps `until` at 2026-01-15 (S303); `index=ipca`, a monthly index, and `index=sofr`, without an enabled source, are 400 `invalid_request` on `index`, also over a tree that held no money in the period (S304). A first deposit on 2026-01-05 gives `from` 2026-01-06, `days` 8 and `index_bp` 44 (S305). A brokerage holding a stock that falls from 30.00 to 27.00 is a `market` profile with `return_bp` −1000, `excess_bp` −1033 and no rate a year or percent of the CDI (S306). An account emptied on 2026-01-06 and filled again on 2026-01-07 is compared over 8 days, `index_bp` 44, `percent_bp` 10000 (S307). With IPCA 0.50% for November and 0.40% for December 2025, an account opened on 2025-10-01 with a yield recorded on 2025-10-31 has `inflation.index_bp` 90 and `real_bp` −89 (S308). A book of region `US` and a report valued in `USD` carry no comparison, with reasons `no_index_for_region` and `currency_mismatch` (S309). An account whose credits of 2026-01-05 and 2026-01-06 are not recorded is compared from 2026-01-07 over 7 days; with no credit recorded the reason is `no_yield_recorded` (S310). An account of 8,135.94 credited from 2026-01-05 with a deposit on 2026-01-08 has `days` 9, `return_bp` 41, `percent_bp` 8255 and no real return (S311). A brokerage that bought a stock on 2025-11-15 has its real return over December only, `real_bp` −40 (S312). A credit on 2026-01-05, the day before a period that starts on 2026-01-06, is the start of the comparison (S313). A brokerage holding a `fixed_income` instrument whose price rises from 10.00 to 10.10 is compared over 6 days with `return_bp` 100 and `percent_bp` 30106 (S314). An account emptied for the whole of December has a real return over November only, `real_bp` −47 (S315). In a cash tree, a purchase from the savings (S316), a cashback into a custom income root (S317), credits booked outside Yield, with reason `no_yield_recorded` (S318), an equity adjustment and an opening balance (S319) and a tax (S320) are flows, and the `excluded` field lists the income and expense among them; a single credit has reason `single_credit` (S321); a deposit on the day of the first credit keeps `period_bp` (S322); credits every 7 days do not restart the comparison (S323) and monthly credits with a deposit between two of them do, with `restarted` true (S324); the rates compared are those dated in the window from A to before B when the rate changes (S325); a small balance has `percent_error_bp`, and above 500 no percent, reason `too_small` (S326); a brokerage with a dividend keeps section 4.3 (S327); a deposit or a withdrawal on a Saturday moves to the next day with a rate and leaves the percent of the CDI unchanged (S328, S329); a transaction that credits a yield to two accounts counts only the share of the tree (S330), a reversal of yield is not a credit date (S331), a yield booked with a salary keeps the salary as a flow (S332); the bound of the percent counts the tree postings of the credits (S333); an index with no rate in the compared window has reason `no_rate_in_window` (S334); the CDI stored only to 2026-01-12 ends the comparison at the credit of 2026-01-13, the last on or before the day after the last stored rate, with `percent_bp` 10000 over 6 days (S335); the CDI stored to Friday 2026-01-16 with credits to Tuesday 2026-01-20 ends it at the Friday credit (S336); no credit after A within that limit leaves no comparison, reason `no_rate_in_window` (S337); +510,000 to the savings, +90,000 to Taxes and -600,000 to Yield is a credit of 600,000 and an outflow of 90,000 listed in `excluded`, the yield going to the balance accounts that receive it in proportion (S338); a CDI of 0 on one day leaves the percent undefined, reason `percent_undefined` (S339); a monthly credit that leaves one or four compared days has no `percent_bp` or `annual_bp`, reason `too_few_days`, and five compared days show them (S349 to S351).

### S340–S348 External identity (A211–A215)

The scenarios of `docs/specs/2026-11-07-external-identity-design.md`: a reserve line naming a reserve in another case, spacing or Unicode form (S340); an unmapped reserve holding a mapped reserve's former name (S341); the window of a reused name (S342); an unresolved line booking no yield (S343); an account no longer listed (S344); its replacement (S345); a file line repeating a stored one under another name or id (S346); a sync line repeating a line of a file batch (S347); the conformance suite of an aggregator (S348).

### S352–S354 Import that replaces a book

The scenarios of `docs/specs/2026-10-26-export-design.md`, amendment of 2026-11-09: an archive imported with the name of a populated book replaces its content and deletes its assistant conversations and usage (S352); a name that differs from the book's is refused with 422 `confirmation_mismatch` and writes nothing (S353); an archive refused inside the transaction keeps the previous content (S354).

### S355–S374 Market quotes

The scenarios of `docs/specs/2026-11-09-market-quotes-design.md`, section 7 (A222).

### S375–S384 Transfer pairing (A216–A221)

The scenarios of `docs/specs/2026-11-09-transfer-pairing-design.md`, section 6.15: clock 2026-11-12; items Nubank (checking "Nubank", card "Nubank Gold") and Mercado Pago (checking "Mercado Pago"); both checking accounts report the holder `br_cpf` `529.982.247-25`, and a third party is `br_cpf` `111.444.777-35`. A line of −250.00 naming the holder waits in review `transfer`, and the opposite line of the other account pairs both in one transaction, in either sync order (S375); an undo of the pairing restores the two lines and a second undo, or an undo after an edit, returns 409 `no_decision` (S376); a card payment line and a checking line of the same amount wait in review `transfer` with the card transaction as the candidate (S377); a line whose other side is a third party books against Uncategorized and never pairs (S378); a line from an account not connected waits in review `transfer` without candidates and turns into a transfer to a manual account (S379); a masked counterparty is a third party and the review lists its transaction as a candidate (S380); lines without a document wait in review `transfer` with their candidate, in any region (S381); several counterparts wait with every candidate (S382); a rule and a link take precedence over pairing (S383); the window of 3 days, the exact amount and the exclusion of pending lines bound a pairing (S384).

### S385–S386 Instrument removal (A223)

The scenarios of `docs/specs/2026-11-11-instrument-removal-design.md`: removing the security MXRF11 deletes it with its prices and leaves KNRI11 and its price; defining MXRF11 again starts without prices; an unknown code is 404 `not_found` and a currency is 422 `validation_failed` on `code` (S385); a security that an account holds is refused with 409 `instrument_in_use` and keeps its prices (S386).

### S410–S412 Instrument type edit (A224)

Amendment A224 of A134: `PATCH /instruments/{code}` accepts an optional `type`; an absent `type` keeps the stored one. A security changes its type only among `stock`, `etf`, `reit` and `depositary_receipt`, which share scale 0, take no terms and have the same price sources. MXRF11 (`reit`, `BVMF`) edited to `etf` reads back with type `etf`, scale 0 and its manual price unchanged (S410). A change to or from `fund`, `crypto`, `fixed_income` or `currency` is 422 `validation_failed` on `type` and the stored type stays; a value outside the type enumeration is 400 `invalid_request` (S411). After an edit that carries `type`, or that changes the subtype or the exchange, the portfolio rebuilds its derived rows: a realized result of MXRF11 sold on 2026-10-20 has `tax_class` `fii` before the edit to `etf` and `etf` after (S412). The `edit` action of `manage_instrument` takes `type` with the same rule. Tests in `internal/marketdata/instruments_test.go`, `internal/marketdata/market_tool_test.go` and `internal/portfolio/jurisdiction_test.go`.

### S413 Instrument quote trend (A225)

Amendment A225 of A222, IQ13 of `docs/specs/2026-11-12-instrument-quotes-overview-design.md`: each item of `GET /instrument-quotes` holds `trend`, the chosen price on or before each of 31 dates, every 3 days from 90 days before the date of `last` to that date, oldest first, null before the first price. FULL1 with manual prices 10.00 on 2026-08-01, 12.00 on 2026-09-15 and 15.00 on 2026-11-11 reads "10" on the first 11 dates, "12" on the next 19 and "15" on the last. SHORT, first priced on 2026-11-01, reads null on the first 27 dates, "5" on the next 3 and "6" on the last. An instrument without a price has an empty `trend`. Test in `internal/marketdata/quotes_test.go`.

### S414 Type fixes of stored shares (A226)

Amendment A226 of A224: the catalog search states a type from the name when the source answers a share for every security of an exchange (`feed.SecurityType`): on the B3, Yahoo answers `EQUITY` for BOVA11 and for MXRF11, and a name with "fundo de índice" or "classe de índice" is an `etf`, a name with "fundo" and "imobili" is a `reit`; a company of real estate (`S.A.`) stays a `stock`. `equori instruments retype` lists the stored shares whose name says another type and `--apply` edits their type through the rule of A224, then rebuilds the portfolio once. With BOVA11 (name "ISHARES IBOVESPA CLASSE DE ÍNDICE"), MXRF11 (name "Maxi Renda Fundo De Investimento Imobiliaro - FII"), PETR4 and KNRI11 (already `reit`) stored as shares, the list holds BOVA11 `stock` to `etf` and MXRF11 `stock` to `reit`; after the fix BOVA11 reads `etf`, MXRF11 reads `reit`, PETR4 stays `stock` and the list is empty (S414). Tests in `internal/marketdata/feed/classify_test.go`, `internal/marketdata/feed/yahoochart/yahoochart_test.go` and `internal/marketdata/instruments_test.go`.

### S415 Correction of a trade (A227)

Amendment A227 of A69, IC1 to IC8 of `docs/specs/2026-11-13-investment-correction-design.md`: MXRF11 bought on 2026-10-05, 150 units at 10.05 with fees 4.90, corrected through `PUT /trades/{id}` with reason "price" to 10.00: cash −1504.90, the security +150 with weight 1504.90, unit price "10", version 2, and the version row with reason "price" holds unit price "10.05". A sale of 50 units on 2026-10-20 at 10.80 with fees 2.10, corrected to 150 units, reads the 150 units held without its own postings: cost 1504.90, cash +1617.90, realized gains 113.00. The buy corrected after that sale is 409 `later_sale_exists`. Tests in `internal/ledger/trade_correction_test.go` and, through `record_investment`, `internal/ledger/investment_correction_tool_test.go`.

### S416 Correction of an investment income (A227)

A dividend of MXRF11 on 2026-10-26 of gross 12.00, corrected through `PUT /investment-income/{id}` to gross 15.00 and withheld 1.00: cash +14.00, the withheld category +1.00, the income category −15.00, version 2. Tests in `internal/ledger/trade_correction_test.go`.

### S387–S392 Brokerage clarity (BC6)

The scenarios of `docs/specs/2026-11-12-brokerage-clarity-design.md`, rules BC6 and X1: a trade with `brokerage_id` and `instrument` creates the holding and the position (S387); a second trade of the same instrument reuses the holding (S388); a request with both forms or neither is 422 `trade_target_required` (S389); a brokerage with two cash accounts and no `cash_account_id` is 422 `brokerage_cash_ambiguous`, and a brokerage with no cash account in the base currency is 422 `brokerage_cash_missing` (S390); a brokerage created through the form's steps has a cash child that holds its opening balance (S391); an income with `instrument` credits the cash account (S392).

### S447–S455 Fixed income lots (A234)

The scenarios of `docs/specs/2026-11-15-fixed-income-lots-design.md`, section 5, rules FL1 to FL11. With purchases of 10 units at 100.00 on 2026-01-05 and 10 units at 120.00 on 2026-02-05, a sale of a fixed income security in a Brazilian book removes the oldest purchase first: 5 units cost 500.00 (S447), 15 units cost 1,600.00 (S448). A stock keeps the average cost, 550.00 for 5 units (S449), and so does a fixed income security in a neutral-profile book (S450). A custody transfer of 15 units keeps the lots, so the sale of 10 units at the other brokerage removes 1,000.00 and not the average, 1,066.67 (S451). A purchase corrected after a later sale is 409 `later_sale_exists` (S452), and so is a sale corrected after a second sale of its day, for lots and for the average alike (S453). Lots that cannot give up the cost of a sale are a 500 and write nothing (S454). `GET /accounts/{id}/lots` returns the method, the holding and the open lots of a fixed income account for the roles `read` and `write`, no lots under the average method, and 404 for a member of another book (S455). Tests in `internal/ledger/fixed_income_lots_test.go` and `internal/ledger/domain/lots_test.go`.

### S417–S437 Investment operations (A228)

The scenarios of `docs/specs/2026-11-14-investment-operations-design.md`, section 5, rules IO1 to IO31. An order total of 4504.00 for 15 units sends the unit price 300.266666666667, whose gross is 4504.00 (S417). A trade typed with the odd-lot code PIBB11F lands on the holding PIBB11 (S418); defining PIBB11F on BVMF is 422 `odd_lot_code` (S419). A BVMF trade of 2026-11-19 settles its cash on 2026-11-24, past the holiday of 2026-11-20 (S420); an explicit settlement before the date or more than 30 days after it is 422 `settlement_date` (S421); an exchange without a cycle settles on the trade date (S422). In a Brazilian book a sale first closes the purchases of its date at the same brokerage, the first buy with the first sale, then the earlier stock at its average cost (IN RFB 1.585/2015, art. 65): S423 to S425, with the results split into `day_trade` and `swing`; a book of the neutral profile keeps the average cost of A68 (S426). A brokerage note records its orders as trades, buys first, with its costs apportioned by gross and its withheld tax by the gross of the sales (art. 56, §4): S427 to S430. A split, a reverse split and a bonus of one holding keep or add the cost (art. 58), a bonus with a cost per unit is an exempt `bonus_shares` income, and an action before a later sale is 409 `later_sale_exists`: S431 to S435. A custody transfer moves units to another brokerage with their average cost: S436, S437. Tests in `internal/ledger/trades_test.go`, `day_trades_test.go`, `notes_test.go`, `corporate_actions_test.go`, `custody_test.go`, `internal/marketdata/instruments_test.go`, `internal/portfolio/scenarios_test.go`, `internal/portfolio/bonus_test.go`, and the web tests of `web/src/features/transactions`.

### S456–S466 Brazilian fixed income and income support (A235)

The scenarios of `docs/specs/2026-11-16-brazilian-fixed-income-support-design.md`, section 5. A JCP recorded without `withheld` takes 15% when paid up to 2025-12-31 and 17.5% from 2026-01-01 (S456, S457; S22 and S65 read 7.88 for the JCP of 45.00 dated 2026). The distribution of a listed FII reads `exempt` in the income events; the distribution of another class stays `exclusive` (S458). The fixed income subtypes add `debenture`, `lc` and `lf`, each taxed at source (S459). Tests in `internal/ledger/income_test.go`, `internal/portfolio/subtype_test.go` and `internal/portfolio/jurisdiction/br/br_test.go`.

`GET /accounts/{id}/withholding` estimates the income tax and the IOF of a sale of a taxed fixed income security from its lots: a gain of 100.00 after 10 days pays IOF 66.00 and income tax 7.65 (S460); two lots take the rates of their own days (S461); a loss pays nothing (S462); a stock and an exempt security return 422 (S463); the roles `read` and `write` read it and another book gets 404 (S464); the assistant tool `estimate_redemption` returns the same figures (S465). `GET /accounts/{id}/lots` tells whether the account has an estimate: true for a CDB, false for an LCI that sells by lot (S466). Tests in `internal/ledger/withholding_estimate_test.go`.

### S467–S470 Fixed income calendar and liquidity (A236)

A pre-fixed CDB with day_count bus252 and calendar br_banking prices 1009.034910724779 on 2026-01-30 and 1017.236102727987 on 2026-02-27, and carries no price on Carnival 2026-02-16 and 2026-02-17 or on a Saturday (S467; `TestS467PreFixedAccruesOnBusinessDays`, `internal/marketdata/accrual_test.go`; web test "saves a fixed rate on the business days of a calendar (S467)", `web/src/features/instruments/terms/terms.test.tsx`). A CDI security whose terms name a calendar keeps the days the index publishes and does not read the calendar (S468; `TestAccrueDailyIndexIgnoresCalendar`, `internal/marketdata/domain/accrual_test.go`). An unknown calendar and a redeemable_from before the issue date return 422 `validation_failed` on calendar_id and redeemable_from; a pre-fixed rate with a calendar returns 200 (S469; `TestS469TermsRefuseCalendarAndGrace`, `internal/marketdata/terms_test.go`). The calendar weekend, of no region, prices every weekday, Carnival included, and reads 1018.151451061362 on 2026-02-27 (S470; `TestS470WeekendCalendarAccruesEveryWeekday`, `internal/marketdata/accrual_test.go`).

### S471–S478 Book-owned instruments and issuer (A236)

The scenarios of `docs/specs/2026-11-16-fixed-income-complete-design.md`, rules FC1 to FC3. An instrument owned by book A gets, in book B, the response of a code that does not exist, operation by operation (S471; `TestS471AnotherBooksInstrumentIsAbsent`, `internal/marketdata/instruments_test.go`). A book lists the public instruments and its own (S472; `TestS472BookListsPublicAndOwn`, same file). An account or a trade of book B that names the instrument of book A is a field error "is not a known instrument" (S473; `TestS473HoldingOfAnotherBooksInstrument`, `internal/ledger/fixed_income_lots_test.go`). Deleting a book removes its instruments with their prices, terms and history (S474; `TestS474BookDeletionRemovesItsInstruments`, `internal/marketdata/instruments_test.go`). The archive carries the public instruments and the book's own (S475; `TestS475ArchiveCarriesPublicAndOwnInstruments`, `internal/reporting/import_test.go`). The issuer is set on define and edit with a scheme and an identifier; `br_cnpj` accepts the numeric and the alphanumeric CNPJ (S476; `TestS476InstrumentIssuer`, `internal/marketdata/instruments_test.go`). The own code is `RF.<YYMMDD>.<5 Crockford characters>`, derived from the SHA-256 of the 16 bytes of `application_id` (S477; `TestOwnCode`, `internal/marketdata/domain/code_test.go`). A contribution plan of book B that names the instrument of book A is refused as an invalid member (S478; `TestS478ContributionMemberOfAnotherBook`, `internal/portfolio/contribution_test.go`).

### S479–S485 Fixed income application (A236)

The scenarios of `docs/specs/2026-11-16-fixed-income-complete-design.md`, rules FC11 to FC15, through `POST /api/v1/fixed-income-applications` (`internal/ledger/fixed_income_application_test.go`). A new CDB of 110% of the CDI, R$10,000.00 applied on its issue date 2026-03-02, defines the contract `RF.280302.CS3YS` of the book and buys 10000.000000 units at 1.000000000000 (S479; `TestS479NewContract`; through the tool `record_fixed_income`, `TestRecordFixedIncomeS479` in `internal/ledger/fixed_income_tool_test.go`). The same request again answers 200 with the same transaction and records nothing (S480; `TestS480ReplayedApplication`). R$1,000.00 into that contract at the price 1.234567 buys 810.000591 units at 1.234567000458, a gross of R$1,000.00; on a Saturday it takes Friday's price (S481; `TestS481Contribution`). A contribution before any price is 422 `price_missing` (S482; `TestS482ContributionWithoutPrice`). Another book's contract is 404 `not_found` (S483; `TestS483ContractOfAnotherBook`). A maturity before the application is 422 `contract_invalid` on `contract.matures_on`, with no instrument left (S484; `TestS484ContractInvalid`). A brokerage with two cash accounts and no choice is 422 `brokerage_cash_ambiguous`, and the defined contract is deleted (S485; `TestS485CashAmbiguousDiscardsTheContract`).

### S495–S496, S517–S518 Fixed income payments (A236)

The scenarios of `docs/specs/2026-11-16-fixed-income-complete-design.md`, rules FC6 to FC8. Terms with `interest_every_months` 6 from 2026-07-06 store the payments 2026-07-06 and 2027-01-05; with an amortization of 5000 bp on 2026-07-06 the two merge into one date that pays interest and returns half the principal (S517; `TestS517TermsWithInterestEvery`, `internal/marketdata/terms_test.go`). A pre-fixed 12% on the business days of calendar `weekend`, issued on 2026-01-05, is priced 1060.205980713929 on 2026-07-06 (the coupon 60.205980713929 included) and 1000.449818143039 on 2026-07-07 (S518; `TestS518AccrualRestartsAfterInterest`, `internal/marketdata/accrual_test.go`). The archive carries the payments of the book's contracts only (S495; `TestS495ArchiveCarriesPayments`, `internal/reporting/import_test.go`). An application with interest every 6 months from 2026-09-02, maturing on 2028-03-02, stores four payments (S496; `TestS496InterestSchedule`, `internal/ledger/fixed_income_application_test.go`).

### S510–S516 Fixed income events (A236)

The scenarios of `docs/specs/2026-11-16-fixed-income-complete-design.md`, rules FC10, FC17 and FC18, through `GET /api/v1/fixed-income-events` (`internal/portfolio/fixed_income_events_test.go`), for 10 units of a pre-fixed 12% contract issued on 2026-01-05, interest every 6 months, maturing on 2027-01-05. On 2026-06-30 it lists the interest of 2026-07-06 (602.06), the interest of 2027-01-05 (606.83) and the maturity of 2027-01-05 (10000.00), upcoming (S510; `TestS510EventsAhead`). On 2026-07-08 without an income the first interest is due (S511; `TestS511EventDue`); an income of type coupon on 2026-07-09 makes it recorded (S512; `TestS512EventRecorded`). An amortization of 5000 bp on 2026-07-06 sells 5 units for 5000.00 and leaves 303.41 of interest and 5000.00 of principal at maturity (S513; `TestS513EventAmortization`). An index rate not yet published leaves the gross out with rate_missing (S514; `TestS514EventRateMissing`). A range of 401 days is 422 on `to` (S515; `TestS515EventsRangeLimit`). Another book lists none of the first book's events (S516; `TestS516EventsOfAnotherBook`).

### S520–S528 Issuer exposure and value net of tax (A236)

The scenarios of `docs/specs/2026-11-16-fixed-income-complete-design.md`, rules FC21 to FC23, through `GET /api/v1/issuer-exposure` (`internal/portfolio/issuer_exposure_test.go`) and the positions (`internal/portfolio/positions_net_test.go`). A CDB of 200000.00 and an LCI of 100000.00 of Banco X, an LF of 30000.00 of Banco X and a debenture of 50000.00 of Y give Banco X a covered value of 300000.00 and an excess of 50000.00 over the FGC limit of 250000.00 (S520; `TestS520ExposureOfOneIssuer`). Four issuers of 260000.00 each pass the limit of 1000000.00 in 4 years (S521; `TestS521PeriodNote`). A holding without issuer is a group of its own (S522; `TestS522HoldingWithoutIssuer`); one without a price is listed apart (S523; `TestS523HoldingWithoutPrice`); a region without a guarantee shows no limit (S524; `TestS524RegionWithoutGuarantee`); another book shows none of the holdings (S525; `TestS525ExposureOfAnotherBook`). A CDB of 10000 units at 1.10 after 182 days shows an estimated tax of 200.00 and a net of 10800.00 (S526; `TestS526EstimatedNetOfAPosition`); a stock and a region without a withholding table show neither (S527, S528; `TestS527StockHasNoEstimate`, `TestS528RegionWithoutTableHasNoEstimate`).

### S530–S537 Fund unit tax (A236)

The scenarios of `docs/specs/2026-11-16-fixed-income-complete-design.md`, rules FC17, FC25 (amended 2026-11-18) and FC26. A unit tax of 12.500000 of 1000.000000 units and 150.00 leaves 987.500000 units at the cost of 10000.00 and credits 150.00 to Prepaid income tax against Adjustments (S530; `TestS530UnitTaxKeepsTheCostAndCreditsPrepaidTax`, `internal/ledger/unit_tax_test.go`); a later sale makes it 409 `later_sale_exists` (S531; `TestS531UnitTaxBeforeALaterSale`); a stock is 422 on `account_id` (S532; `TestS532UnitTaxOnAStock`); all units, no unit or no amount are 422 (S533; `TestS533UnitTaxQuantityAndAmountBounds`). A fixed income fund lists its unit tax on 2026-05-29 and 2026-11-30, the last business days of `br_banking` (S534; `TestS534UnitTaxDatesOfAFund`, `internal/portfolio/unit_tax_events_test.go`); the unit tax of S530 makes the May one recorded (S535; `TestS535UnitTaxEventRecorded`); an equity fund and a book of region DE list none (S536, S537; `TestS536EquityFundHasNoUnitTax`, `TestS537RegionWithoutUnitTax`).

### S488–S498 Institution indicators (A237)

The scenarios of `docs/specs/2026-11-16-institution-indicators-design.md`. With the feed `br_ifdata` enabled and the period 2026-06-30 stored, the indicators of `br_ispb` `18236120` are those of the conglomerate `NU PAGAMENTOS - PRUDENCIAL`: `basel` "0.1550912564", `principal_capital` "0.1175995987", `fixed_asset` "0.0510180761", `equity` 2334461071736, `net_income` 409304022539 and `currency` `BRL` (S488). A ratio the source leaves null is `null` in the response, never "0" (S489). With the feed disabled the operation is 404 `not_found` (S490), as an identifier without a row and a scheme `bic` (S491). A member reads the same figures and a request without a session is 401 (S492). The feed is listed with `kind` `institution` and `last` 2026-06-30, and is stale from 2027-01-29 (S493). A book of region `US` has the feed listed with `suggested` false (S494). The operation returns the quarters newest first, with `2026-03-31` after `2026-06-30` and a null Basel index kept null in March (S495), and the floors of Resolução CMN 4.958/2021: Basel `minimum` "0.08" and `with_buffer` "0.105", principal capital "0.045" and "0.07" (S496). A second tick reads no stored quarter again and reads the latest one again (S497). The table keeps the eight latest quarters: with nine quarters published, the oldest is not stored and a row of an older period is deleted (S498).

### S538–S539 Goal that counts as savings (A239)

The scenarios of `docs/specs/2026-11-17-goal-savings-design.md`. With 800.00 moved into the account of a goal that counts as savings and 1,000.00 into a savings account, the bucket that takes savings holds 1,800.00 in the history and in the plan of the month and the bucket that takes goals holds nothing; the goal set back leaves 800.00 in the goals bucket and 1,000.00 in the savings bucket (S538; `TestS538GoalCountsAsSavings`, `internal/planning/buckets_test.go`). An account held by a goal that counts as savings and by one that does not counts its 800.00 once, in the goals bucket (S539; `TestS539SharedGoalAccountCountsOnce`).

### S540 Fixed income panel of the Portfolio screen (A236)

The scenario of `docs/specs/2026-11-16-fixed-income-complete-design.md`, rule FC36, on the Portfolio screen (`web/src/features/portfolio/fixed-income/fixed-income-panel.test.tsx`). A book holding a CDB of 200000.00, an LCI of 100000.00 and an LF of 30000.00 of Banco X on the CDI, a debenture of 50000.00 of Y and a Tesouro of 20000.00 on the IPCA and a fixed-rate CDB of 12300.00 of Banco Z reads, in order: the verdict "R$ 50.000,00 acima do FGC no Banco X", the return kinds 330000.00 (80%), 70000.00 (17%) and 12300.00 (3%), six years of maturity, the payments of the next 90 days with the due one linked to its record, and four issuers with +50000.00 at Banco X (S540; "FC36: draws the verdict and the four blocks of the mock, in order"). A book without fixed income draws no panel; a region without a guarantee lists the issuers without limit; a window without payments says so; a payment whose rate is not published names it (the tests "FC36: ..." of the same file).

### S541–S552 Fixed income read from an aggregator (A236)

The scenarios of `docs/specs/2026-11-16-fixed-income-complete-design.md`, rules FC27 and FC28, through the HTTP API (`internal/ingestion/investments_test.go`). A sync of a connection whose item lists one CDB with a purchase and an interest stores one investment and two movements, listed by `GET /connections/{id}/investments` as pending with the proposals `application` and `income` (S541; `TestSyncStoresInvestments_S541`); a second sync with a new balance keeps one investment and two movements and returns the new balance (S542; `TestSyncKeepsInvestmentsOnRepeat_S542`); an aggregator without the reader lists none (S543; `TestSyncInvestmentsWithoutReader_S543`, `internal/ingestion/app/sync_investments_test.go`); the read role lists and another book gets 404 (S544; `TestInvestmentsOfAConnectionByRole_S544`).

Confirming the application of 1000.00 with its brokerage records one purchase of 1000.000000 units at 1.00 and links the investment; a second confirmation is 409 `investment_movement_resolved` and one without a brokerage 422 (S545; `TestConfirmApplication_S545`). A contribution, a sale or an income before the application is 409 `investment_not_applied`; after it, an income of 12.34 with its category records an interest of 12.34, and one without a category is 422 (S546; `TestMovementsBeforeApplication_S546`). A sale of 500.00 with a tax of 3.00 on the next day records one sale with taxes 3.00, and the tax movement follows it (S547; `TestConfirmSaleWithTax_S547`). A dismissal records nothing and its undo returns the movement to pending; the undo of a confirmed income voids its transaction; the undo of the application waits for the later movements and then unlinks the investment (S548; `TestDismissAndUndo_S548`). With no pending movement, a sync with a balance of 1010.00 stores the price 1.010000000000 with the source `pluggy`; with a pending movement it stores none (S549; `TestBalancePrice_S549`). An investment without terms is applied without an index, and one without a maturity is 422 `contract_invalid` (S550; `TestApplicationTerms_S550`). A book in another base currency confirms in the currency of its brokerage, and an investment of an unmapped subtype is 422 `contract_invalid` in BR and DE (S551; `TestForeignBaseAndUnmappedSubtype_S551`). The write role confirms, the read role gets 403 and another book 404 (S552; `TestReviewByRoleAndBook_S552`).

### S553–S559 Indexer comparison data

The scenarios of `docs/specs/2026-11-17-indexer-comparison-design.md`, rule X1, through the HTTP API. With the feed `br_focus_ipca` enabled, the Focus survey of 2026-11-13 stores the points `2026-12-31` "0.051082000000", `2027-12-31` "0.050000000000" and `2028-12-31` "0.040000000000" for `ipca`, and `GET /indexes` marks `ipca` `expected` (S553; `TestS553IPCAExpectations`). `GET /indexes/ipca/expectations` returns the survey date 2026-11-13 and those points (S554; `TestS553IPCAExpectations`). With the feed `br_tesouro` enabled, the file of 2026-11-16 stores 2 points of `br_tesouro_prefixed` and 1 of `br_tesouro_ipca`, and none of a coupon title (S555; `TestS555Curves`). `GET /curves` as a member with the role `read` returns `br_tesouro_prefixed` (kind `nominal`, index null, currency `BRL`, base date 2026-11-16, source `br_tesouro`, points `2028-01-01` "0.131000000000" and `2030-01-01` "0.134000000000") and then `br_tesouro_ipca` (kind `real`, index `ipca`, one point), and without a session 401 (S556; `TestS555Curves`). With the feed disabled the same request returns an empty `items` (S557; `TestS555Curves`). The feed `br_tesouro` has kind `curve` and last 2026-11-16, and is stale on 2026-12-01 but not on 2026-11-17 (S558; `TestS558CurveFeedStale`). A book of region `US` gets `br_tesouro` and `br_focus_ipca` listed with `suggested` false (S559; `TestS559CurveFeedNotSuggestedOutsideBrazil`). The tool `get_market_data` with the view `curves` returns the same two curves (`TestCurvesTool`).

### S591–S597 Fund report data

The scenarios of `docs/specs/2026-11-18-fund-report-design.md`, rules FR1 to FR6 and FR15, through the HTTP API. With the feed `br_cvm_fii` enabled, the file of 2026 stores 2 rows of `HGLG11`, 1 of `XPTO11` and 2 of `ABCD11` marked shared, and the row of `HGLG11` for 2026-09-01 holds the version 2 figures, 613837 holders (S591; `TestS591FundReportTick`). `GET /fund-reports?code=HGLG11` as a member with the role `read` returns one item (source `br_cvm_fii`, exchange `BVMF`, currency `BRL`, identifier `11728688000147`, name `PÁTRIA LOG FII`, segment `Logística`) with the periods 2026-10-01 and 2026-09-01, newest first; `code=XPTO11` returns one period with 10 holders and every other figure null; without a session the status is 401 (S592; `TestS592FundReports`). With the feed disabled the same request returns an empty `items`, as does an unknown code with the feed enabled (S593; `TestS592FundReports`). The two funds that give `ABCD11` are stored shared and the funds without an exchange listing store no row (S594; `TestS591FundReportTick`). The feed `br_cvm_fii` has kind `fund_report` and last 2026-10-01, and is stale on 2026-12-22 but not on 2026-11-18 (S595; `TestS595FundReportFeedStale`). A book of region `US` gets `br_cvm_fii` listed with `suggested` false (S596; `TestS596FundReportFeedNotSuggestedOutsideBrazil`). The tool `get_market_data` with the view `fund_reports` and the code `HGLG11` returns the item of S592 (`TestFundReportsTool`). An instrument `ABCD11` without a symbol gets no item and the candidates `22222222000122` (FUNDO B) and `33333333000133` (FUNDO C), through the API and the tool; after `PATCH /instruments/ABCD11` with the symbol `br_cvm_fii` `33333333000133` it gets the report of FUNDO C for 2026-10-01 and no candidate (S597; `TestS597FundReportLink`).

### S598–S603 Company report data

The scenarios of `docs/specs/2026-11-18-company-report-design.md`, rules CR2 and CR6, through the HTTP API. With the feed `br_cvm_cia` enabled, the files of the CVM store 5 rows (3 of `dfp_2025`, 1 of `itr_2025`, 1 of `itr_2026`) and the listing of `BNCX4`, `INDS3` and `WEGE3` (S598; `TestS598CompanyReportTick`). `GET /company-reports?code=WEGE3` as a member with the role `read` returns one item (source `br_cvm_cia`, identifier `84429695000111`, name `WEG S.A.`, `consolidated` true, plan `standard`, currency `BRL`) with the periods 2026-09-30 (9 months), 2025-12-31 (12) and 2025-09-30 (9); without a session the status is 401; an unknown code and a disabled feed return an empty `items`; the instrument `OTHR3` with the symbol `br_cvm_cia` `11111111000111` returns the item of IND SA with `consolidated` false (S599; `TestS599CompanyReports`). `code=BNCX4` returns plan `other` and one period with `total_assets`, `equity`, `net_income` and `operating_cash_flow` set and every other account null (S600; `TestS600CompanyReportOtherPlan`). The feed `br_cvm_cia` has kind `company_report`, last 2026-09-30 and `symbol_override` true, and is stale on 2027-04-01 but not on 2026-11-18 (S601; `TestS601CompanyReportFeedStale`). A book of region `US` gets `br_cvm_cia` listed with `suggested` false (S602; `TestS602CompanyReportFeedNotSuggestedOutsideBrazil`). The tool `get_market_data` with the view `company_reports` and the code `WEGE3` returns the item of S599, and the `revenue` of IND SA is written as 0 (S603; `TestS603CompanyReportsTool`).

### S604–S609 Contribution questions

The scenarios of `docs/specs/2026-11-18-contribution-questions-design.md`, rules CQ1 to CQ6, through the HTTP API and the tools. The plan holds one group "Questions" of target 10000 with the instruments `QSTA3`, `QSTB3` and `QSTC3`, never traded, so each value is zero. `PUT /contribution-plan` with the questions "Q1", "Q2" and "Q3" and the answers (true, true, false), (true, false, false) and (false, false, false), without `target_bp`, returns 200 with `question_ideals` true, the members' `target_bp` 6667, 3333 and 0 and their `answers`; `GET` returns the same (S604; `TestS604SaveQuestions`). `POST /contribution-plan/preview` of that draft with 1,000.00 returns the member amounts 666.70, 333.30 and 0.00 (S605; `TestS605PreviewQuestions`). With every answer false the save and the preview return `question_ideals` false and no member `target_bp` or amount, and `GET` returns the same (S606; `TestS606EveryAnswerFalse`). A question of 201 characters, a blank question, two questions equal ignoring case and eleven questions return 422 `contribution_question_invalid`; a member with two answers in a group of three questions, a member with `target_bp` in a group with questions and a member with `answers` in a group without questions return 422 `contribution_answers_invalid` (S607; `TestS607InvalidQuestions`). `PUT` as a member with the role `read` returns 403 `book_role_required` (S608; `TestS608ReaderCannotSaveQuestions`). `save_contribution_plan` with the plan of S604 stores it, and `GET` and `get_portfolio` view `contribution` return the same questions, answers and targets (S609; `TestS609SaveQuestionsTool`).

### S567–S590 Planning coherence (A249 to A258)

The scenarios of `docs/specs/2026-11-17-planning-coherence-design.md`, section 8, through the HTTP API. A schedule of kind `transfer` of 1,000.00 from checking into a brokerage account is `savings` 1,000.00 of the month plan, planned by the bucket that takes savings, with `moves` `spending` to `savings` (S567; `TestS567TransferIntoABrokerageAccountIsSavings`). A schedule of kind `savings` of 500.00 into a goal account is `goal_deposits` 500.00 and `savings` 0.00, and the figures swap when the goal counts as savings (S568; `TestS568SavingsScheduleIntoAGoalAccount`). A schedule of 300.00 from a savings account to checking lowers `savings` by 300.00 and one between two savings accounts counts nothing (S569; `TestS569MovementOutOfAndInsideTheSavingsSet`). `unassigned` is 5,000.00 − 0.00 − 700.00 − 500.00 − 2,000.00 = 1,800.00 (S570; `TestS570UnassignedSubtractsGoalDeposits`). An expense of 5,000.00 paid from a goal account lowers the goals bucket by 5,000.00, as a withdrawal to checking does (S571; `TestS571ExpensePaidFromAGoalAccount`). A salary of 5,000.00 credited to a savings account counts in `received` and in the bucket that takes savings (S572; `TestS572SalaryCreditedToASavingsAccount`). A yield of 300.00 credited to a brokerage account is `retained` 300.00 and no deposit; a yield of 70.00 credited to checking stays in `received` (S573; `TestS573RetainedYield`). A realized loss of 200.00 posted from a brokerage account counts no withdrawal (S574; `TestS574RealizedLossIsNoWithdrawal`). A rollover budget of 200.00 a month with 2,200.00 carried and 2,400.00 spent in one month has `covered` 2,200.00 in its bucket (S575; `TestS575AccumulatedBalanceCoversTheBucket`, verdict in `TestKeptTarget`). A carried amount below zero and a budget without rollover cover nothing (S576; `TestS576OverspentBudgetCoversNothing`). The bucket that takes goals with 500.00 deposited and 5,000.00 withdrawn holds `deposited` 500.00, `withdrawn` 5,000.00 and `real` -4,500.00 (S577; `TestS577GoalsBucketDepositedAndWithdrawn`). An expense of 5,000.00 linked to a goal stays in `real` of its bucket with `goal_paid` 5,000.00, the budget of its category holds `goal_paid` 5,000.00 and `spent` without it, and the goal holds `spent` 5,000.00 (S584; `TestS584LinkedExpense`). A second link of one transaction replaces the first; a voided transaction, one without an expense posting and an unknown one are 422 on `transaction_id` (S585; `TestS585GoalExpenseLinkRules`). An expense paid from an account one goal holds whole is paid by that goal with `direct` true, and from an account two goals hold by none (S586; `TestS586DirectPayment`). A savings account of 30,000.00 allocated to two goals with 20,000.00 and 5,000.00 gives the goals `current` 20,000.00 and 5,000.00 and leaves 5,000.00 `available`; each goal names the other in `shared_with` (S578, S588; `TestS578AccountAllocatedToTwoGoals`). An allocation of 6,000.00 over an `available` of 5,000.00 and a release of 20,000.01 from a goal with 20,000.00 are 422 on `amount` (S579; `TestS579AllocationBounds`). A withdrawal of 10,000.00 from that account marks both goals `over_allocated` 5,000.00 and keeps their `current` (S580; `TestS580OverAllocation`). An account with a whole link and an allocated link, an allocated link on an account with sub-accounts and one on an account of units are 422 (S581; `TestS581AllocatedLinkRules`). A schedule with `goal_id` allocates 500.00 when its occurrence is realized and deletes the allocation when it is unrealized (S582; `TestS582ScheduleAllocatesToItsGoal`). An allocation of 500.00 on a savings account and one of 200.00 on a checking account give the goals bucket 700.00 and the savings bucket -500.00, and the entries of the goals bucket list both without a transaction (S583; `TestS583AllocationInTheBuckets`). The operations of section 5 answer `write` where they write, `read` where they read, 403 to a reader that writes, 401 without a session and 404 for a goal of another book (S589; `TestGoalAllocationRoles`, `TestGoalExpenseRoles`). A book in USD with a goal over an allocated BRL account values an allocation of 500.00 BRL at 100.00 USD at a rate of 5.0000, and the allocation counts in no bucket (S590; `TestS590AllocationInAnotherCurrency`). With installments of 800.00, goal deposits of 500.00, savings of 300.00 in the bucket that takes them and a reference of 10,000.00, the planned amounts of the buckets, the budgets outside the split, the installments, the goal deposits and `unassigned` sum to 10,000.00 (S587; `TestS587PlanSumsToTheReference`, rows in `outsideRows` of `bucket-figures.test.ts`).

### S610–S622 Brazilian product matrix

The rows of `apitest.BRProducts` (`docs/specs/2026-11-18-assistant-parity-and-br-instruments-design.md`, section 5.1), each run through the HTTP API and through the tools by `TestBRProductMatrix`, in this order: S610 F-02 pre-fixed CDB, S611 F-06 RDB, S612 F-09 LC, S613 F-12 LH, S614 F-17 CRI, S615 F-18 CDCA, S616 F-19 redemption within 30 days, S617 T-02 Tesouro Prefixado, S618 F-01 CDB at 100% of the CDI, S619 F-04 CDB at CDI plus 1.5%, S620 T-01 Tesouro Selic, S621 T-04 Tesouro IPCA+, S622 T-08 Tesouro IGPM+ with half-yearly interest. Each reads, on its valuation date, the market value, the income tax, the IOF and the net value of the estimate, and the excess, uncovered and sovereign values of the issuer exposure, and each equals the figure computed from the published source of its row: R$ 753,315.32 at 14.36% grows to R$ 1,000,000.00 in 532 business days and pays R$ 37,002.70 of income tax when taxed; an exempt row has no estimate; 20 days after the application the IOF is R$ 1,726.75 and the income tax R$ 788.81.

### S623–S625 Listed options and write-off

The scenarios of `docs/specs/2026-11-18-listed-options-design.md`, rules O2 to O5 and W1 to W3, through the HTTP API. S623: 100 units of the option PETRK300 bought at 0.50 and written off on their expiry leave the holding with weight −50.00 and post 50.00 to realized losses; `get_tax_year` lists a result of −50.00 with proceeds 0.00 and tax class `option`; a write-off above the units held or with a unit price is refused with `validation_failed`, and the table refuses a write-off with a gross amount. S624: the call PETRK300 exercised into 100 PETR4 for 3,000.00 gives PETR4 a cost of 3,050.00 and takes 3,000.00 from the cash account. S625: 10 subscription rights PETR12 received at no cost and written off leave the holding with one posting of weight zero.

### S626–S627 Progressive rate

The scenarios of `docs/specs/2026-11-18-progressive-rate-design.md`, rules PR1 to PR4, through the HTTP API and the tool `set_rate_steps`. A pre-fixed CDB of 6% a year issued on 2026-01-01 that pays 12% after 31 days held is worth 1,004.640317564163 on 2026-01-30 under both rules. S626 (retroactive): on 2026-02-03 it is worth 1,010.298826697262, the whole period at 12%. S627 (stepped): on 2026-02-03 it is worth 1,005.433705882182, the price at 6% up to the first priced day of the step chained to the growth at 12%. Steps without their rule, or a rule without steps, are refused with `validation_failed`, and the table refuses a rule without steps.

### S628–S629 Monthly tax on variable income

The scenarios of `docs/specs/2026-11-18-monthly-gain-tax-design.md`, rules GT1 to GT5, through the tool `get_tax_year` view `gain_tax` in a book of region BR. S628: 1,000 PETR4 bought at 10.00; 500 sold at 14.00 in January (R$ 7,000.00 of sales) leave an exempt gain of 2,000.00 and a DARF of 0.00; 500 sold at 50.00 in February with 1.25 withheld give a base of 20,000.00, a tax of 3,000.00 and a DARF of 2,998.75. S629: a day trade of March with a gain of 40.00 and 0.40 withheld owes 7.60, below the minimum, and the day trade of April with a gain of 100.00 and 1.00 withheld gives a DARF of 26.60. A book of region DE reads no month.

### S630 Minimum term of an LCI or an LCA

Coverage row F-07, through the HTTP API in a book of region BR. A new LCI on the CDI issued on 2026-03-02 without `redeemable_from` is redeemable from 2026-09-02; an LCI on IPCA issued that day from 2029-03-02; an LCA issued on 2024-06-03 from 2025-03-03 and an LCI from 2025-06-03. A date the user types stays, and a CDB takes none.

### S631 Capital return

Coverage row E-08, through the HTTP API and the tool `record_corporate_action`. 100 PETR4 bought at 10.00 receive a capital return of 200.00 on 2026-11-10: the holding keeps its 100 units at a cost of 800.00 and the cash account receives 200.00; a return of 800.00 or more is refused with `validation_failed` on amount, and the table refuses a capital return of no value.

### S632 Payments of a government bond

Coverage rows T-03 and T-05, through the HTTP API. 2.00 units each of NTNF.20290101, NTNB.20350515 and LTN.20270101 bought on 2026-01-12; the events from 2026-06-01 to 2027-01-31 are the NTNF interest of 97.62 on 2026-07-01 and on 2027-01-04 (2027-01-01 is a holiday), the NTNB interest on 2026-11-16 without an amount, and the LTN maturity of 2,000.00 on 2027-01-04.

### S633 Monthly payments of an RendA+

Coverage rows T-06 and T-07, through the HTTP API. 240.00 units of RENDA.20491215 bought on 2026-01-12; the events from 2030-01-01 to 2030-03-31 are three amortizations on the 15th of 1.00 unit each (one part in 240, 239 and 238 of the units held), without amount while the IPCA of their VNA is not stored.

### S634 Estimate of the come-cotas

Coverage row U-01, through the HTTP API. 1,000 units of a fund bought at 10.00 on 2026-01-05, priced 10.50 on 2026-05-29 and 10.80 on 2026-11-30: a fixed_income_fund has an estimated_tax of 75.00 and 45.00, a short_term_fund of 100.00 and 60.00.

### S635 Estimate of the redemption of an equity fund

Coverage row U-02, through the HTTP API. 10,000 units of an equity_fund bought at 1.00 on 2026-07-01 and priced 1.10 on 2026-07-06: the position has an estimated_tax of 150.00, 15% of the gain, with no IOF in its first 30 days.

### S636 Estimate of a FIP or a FIDC that is an investment entity

Coverage row U-04, through the HTTP API. 10,000 units of a fip, or of a fidc_entity, bought at 1.00 on 2026-01-05 and priced 1.10 on 2026-07-06: the position has an estimated_tax of 150.00, 15% of the gain; a fidc_entity has no come-cotas event.

### S637 Annual tax abroad

Coverage row U-08, through the tool `get_tax_year` view `abroad_tax`. 10 units of an ETF quoted in USD bought for 500.00 BRL each on 2025-03-03 and sold for 600.00 BRL each on 2025-09-01: the year 2025 has a base of 1,000.00, a tax of 150.00 and 150.00 due.

### S638 Custody fee of a Tesouro sale

Coverage row T-09, through the HTTP API. 100 units of a Tesouro bond bought at 10.00 on 2026-01-05 and sold for 1,100.00: an LTN sold on 2026-07-04 deducts a custody fee of 1.08 (0.20% a year over 180 days); an NTNF sold on 2026-08-03 deducts 0.20, the fee since its coupon of 2026-07-01; an LFT sold for 1,100.00 deducts none, below the exemption of R$ 10,000.00.

### S639 Day trade of a future

Coverage row E-12, through the HTTP API and the tool `get_tax_year`. One WINZ26 contract bought for 26,000.00 and sold for 26,100.00 on 2026-10-05 with 1.00 withheld: October has a day_trade line with a tax of 20.00 and a DARF of 19.00.

### S640–S647 Contribution groups by rule

The scenarios of `docs/specs/2026-11-19-contribution-rules-design.md`, rules GR1 to GR8, through the HTTP API. The book holds, in one brokerage, a CDB of 10,000.00 (`rate`, matures 2027), an LCI of 5,000.00 (`rate`, matures 2028, daily liquidity), `NTNB.20350515` of 3,000.00 and BOVA11 of 2,000.00, with the cash funded to the cent. `PUT /contribution-plan` with the plan of GR12 ("Reserva" `{daily_liquidity: true}`, "Pós" `{instrument_type: fixed_income, return_kind: rate}`, "IPCA+" `{return_kind: inflation, matures_from_year: 2031, matures_to_year: 2040}`, "Ações" with the member BOVA11) returns the class values 5,000.00, 10,000.00, 3,000.00 and 2,000.00, `matched` of "Pós" with the CDB at 10,000.00 and a share of 10000, and no outside entry; with "IPCA+" removed, the outside list holds `NTNB.20350515` with `return_kind` `inflation` (S640; `TestS640RuleClassValuesItsContracts`). With an `instrument` member of the CDB in "Ações", the CDB counts in "Ações" and "Pós" has no `matched`; the LCI stays in "Reserva", the first group it meets (S641; `TestS641MemberAndOrderWin`). With `LFT.20290301` held, a group `{return_kind: rate, daily_liquidity: true}` takes it, `NTNB.20350515` is taken by `{return_kind: inflation, matures_from_year: 2035}`, and `{daily_liquidity: true}` leaves `NTNB.20350515` outside (S642; `TestS642GovernmentBondFacts`). A matched contract without a price makes the response `incomplete` with its instrument in `missing` (S643; `TestS643MatchedWithoutPrice`). `GET` of a BR book returns `guarantee_name` `FGC`; a book of region `DE` refuses `{guarantee: covered}` with 422 `contribution_rule_invalid` (S644; `TestS644GuaranteeOutsideBrazil`). A group with members and rules, a rule with no condition, `subtypes` without `instrument_type` and a maturity from 2035 to 2030 return 422 `contribution_rule_invalid`; six rules return 400 `invalid_request` (S645; `TestS645InvalidRules`). `POST /contribution-plan/preview` of the plan of GR12 with 2,000.00 returns the class amounts 0.00, 0.00, 0.00 and 2,000.00; without `amount` it returns 200 with `matched` and no class `amount` (S646; `TestS646PreviewOfRules`). In a book with base `USD`, a BRL contract of 1,000.00 at a stored BRL to USD rate of 0.20 gives its group the value 200.00 (S647; `TestS647RuleClassForeignBase`).

### S640 Coupon of an NTN-B by the IPCA

Coverage row T-05, through the HTTP API. The IPCA numbers of June 2000 (1,614.62) and October 2026 (2,788.33, the months between holding June's): the VNA of 2026-11-15 is 1,726.926459 and the coupon of 2026-11-16 on 2.00 units of NTNB.20350515 is 102.11 (51.053144 a unit), as the example of the Tesouro's methodology.

### S641 Coupon of the NTN-C of 2031 and maturity of an LFT

Coverage rows T-08 and T-01, through the HTTP API. An IGP-M factor of 2.102805518521 from July 2000 to June 2026: the coupon of 2026-07-01 on 2.00 units of NTNC.20310101 is 245.19 (12% a year, 122.594655 a unit). A Selic of 0.07% on each business day of July 2000: 1.00 unit of LFT.20000801 pays 1,014.80 at maturity.

### S642 Custody exemption of the holder's Tesouro Selic

Coverage row T-09, through the HTTP API. 100 units of an LFT bought at 10.00 on 2026-01-05 beside 950 units of another LFT priced 10.00: a sale of the first for 1,100.00 on 2026-07-04 pays a custody fee of 0.06, on its share (62.26) of the 600.00 the 10,600.00 of Tesouro Selic hold above the exemption.

### S643 Custody fee of a sale of an RendA+ or an Educa+

Coverage row T-09, through the HTTP API. 100 units bought at 100.00 on 2026-01-05 and sold for 20,000.00 on 2026-07-04: an RendA+ pays a custody fee of 10.27 (0.10% above 9,726.00, 6 minimum wages of 2026), an Educa+ 13.52 (above 6,484.00, 4 minimum wages).

### S644 Monthly payment of an RendA+ and its custody fee

Coverage rows T-06 and T-09, through the HTTP API. 3,000.00 units of RENDA.20451215 bought on 2026-01-05 and a VNI of 1,726.926459 on 2026-01-15: the payment of that day amortizes 12.50 units for 21,586.58 and carries a custody fee of 11.86.

### S648–S653 Risk history of the portfolio

The scenarios of `docs/specs/2026-11-19-portfolio-risk-design.md`, rules RK1 to RK14, through the HTTP API. 1,000.00 put into the brokerage cash and spent on 100 MXRF11 at 10.00 on 2026-01-02, prices of 10.20, 10.00 and 10.30 at the ends of January to March, none in April, an accrual price of 10.10 on May 31 and an income of 10.00 paid into the cash on February 15: `GET /reports/risk?to=2026-05-31` returns for `reit` 214, −98 and 300 basis points, April `stale`, May −194 over two months; the cash gains nothing; the portfolio returns 214, −98, 297, 0 in April (the cash alone, `excluded_bp` 9904) and 0 in May (the cash alone: the fund spans two months, `excluded_bp` 9902), with no drawdown in April and May; `left_out` names MXRF11 for one month; the fund weighs 9901, its deepest fall is −194, and its accrual share is 10000 (S648; `TestS648MonthlyReturnsByClass`). Thirteen month ends of MXRF11 and PETR4 from January 2025: volatilities of 3893 (stock), 853 (reit) and 2403 (portfolio), a correlation of 9819 over 13 months, risk shares of 8284 and 1716 against weights of 5364 and 4636, and no volatility at the eleventh month; `get_portfolio` view `risk` returns the same summary (S649, S651; `TestS649VolatilityCorrelationAndRiskShare`). A month without any price is `missing` and February spans it with 1035 basis points (S650; `TestS650MissingPrice`). Valued in `USD` at 0.20 and 0.21 a real, the fund returns 0 and 500 (S652; `TestS652RiskInAnotherCurrency`). `value_in=usd` is 400 `invalid_request`; a book without a brokerage returns no month; a reader reads the report; a request without a session is 401 (S653; `TestS653RiskRequests`).
