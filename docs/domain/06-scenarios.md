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
| PETR4 JCP, gross 45.00, 15% withheld | XP cash +38.25; Taxes › Income tax +6.75; JCP −45.00 |

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

The import flow (F4) is covered by S32–S36; classification (F5) by S37–S44 and S98 (amendment A105); the category tree and its tools by S72–S79 (amendments A73–A84 of `docs/superpowers/specs/2026-10-19-categorization-design.md`); transfers from imports by S45–S50; aggregator sync by S51–S59, S68–S71 and S90; matching by score by S91–S97 (amendments A98–A104); card statements from the institution by S80–S89 (amendments A85–A93); schedules (F7) by S27–S29 and the planning views by S60–S63; deleting a budget by S144; the budget plan by S158 to S166 (`docs/superpowers/specs/2026-10-27-budget-plan-design.md`); currencies and investments (F9) by S16, S17, S21, S22 and S64–S67; editing and deleting goals by S119 and S120; goals over brokerage accounts by S121; tax treatment by instrument subtype by S122; editing an instrument by S171; the return of an account tree by S126 and S127 and of a goal by S130; allocation and net worth by S128 and S129; fixed income accrual by S123 to S125; reimbursement of recorded expenses by S113 and S114 (amendment A117); text capture and the transaction batch by S99–S112 and S151–S153 (amendments A106–A116 of `docs/superpowers/specs/2026-10-21-text-capture-design.md`); the assistant by S131–S142 (section 6.20).

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

With "Cofrinho Mercado Livre" and "Algum dinheiro" mapped from 2026-11-11, checking lines of 2026-11-11 with `operationType` `TRANSFERENCIA_SALDO_RESERVADO`: "Dinheiro reservado Cofrinho Mercado Livre" −200.00 creates a transfer of 200.00 from Mercado Pago to MP Cofrinho; "Dinheiro retirado Algum dinheiro" +100.00 creates a transfer of 100.00 from the "Algum dinheiro" reserve to Mercado Pago. "Dinheiro retirado Aaa" +50.00, and "Dinheiro reservado Cofrinho Mercado Livre" −30.00 dated 2026-11-10, are recorded as ordinary lines.

### S90 Renamed reserved balance (A94)

"Aaa" is mapped from 2026-11-11 to MP Reserva with 100.00. The owner renames it "Algum dinheiro"; the sync of 2026-11-12 lists it under the new name, still mapped, and books "Dinheiro reservado Algum dinheiro" −20.00 of 2026-11-12 and "Dinheiro retirado Aaa" +10.00 of 2026-11-11 as transfers with MP Reserva; the reserve meets the reported 110.00. A reserve later created with a renamed reserve's former name takes the lines that name it.

### S91–S97 Matching by score (A98–A104)

The scenarios of `docs/superpowers/specs/2026-10-20-record-matching-design.md`: a manual entry linked by identical amount, day and payee (S91); a probable entry corrected to the line's amount on match (S92); two rides of one payee and amount ambiguous (S93); another payee creating a transaction (S94); a hotel entry seven days away linked (S95); a linked line's change corrected or, on a reconciled posting, described (S96); entries no line confirmed listed (S97).

### S167–S170 Unconfirmed entries confirmed by line or balance (A133)

The scenarios of `docs/superpowers/specs/2026-10-28-unconfirmed-entries-design.md`: reserve transfers confirmed by the reserve's balance (S167); a manual entry confirmed by the account's balance (S168); an installment expected at its statement's closing (S169); cancelled installments offsetting their reversals (S170).

### S71 Synced assertion re-evaluated

Nubank checking mapped from 2026-10-01 with the S52 lines and balance 3,834.10, without an opening balance: the first sync records an assertion with an open difference of 1,000.00. The owner records an opening balance of 1,000.00; the next sync, with the same balance, creates no assertion, and the existing one becomes `reconciled` with resolution `none`. An open synced assertion with a second assertion of the same date and amount created through `POST /accounts/{id}/balance-assertions` is reconciled by the next sync; all assertions are `reconciled`.

## 6.15b Card statements from the institution

Scenarios of amendments A85–A93 (`docs/superpowers/specs/2026-10-20-card-statements-institution-design.md`). Itaú Visa closes on day 3 and is due on day 10 unless a scenario says otherwise.

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

After S22, `GET /income-events?year=2026` returns the dividend of 10.00, `exempt`, withheld 0.00, and the JCP of 45.00, `exclusive`, withheld 6.75.

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

Amendment A134: `PATCH /instruments/{code}` replaces the name, the exchange and the subtype of a security; an exchange or subtype absent from the body is cleared. Code, type, scale and quote currency stay as defined (A59). MXRF11 (`reit`, `BVMF`, no subtype) edited to name "Maxi Renda FII", exchange absent and subtype `fii_papel` reads back with that name, no exchange and that subtype, and its manual price of 2026-10-22 is unchanged. A blank name is 422 `validation_failed` on `name`; a currency is 422 `validation_failed` on `code`; an unknown code is 404.

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

The scenarios, their fixture and the grammar they exercise are in `docs/superpowers/specs/2026-10-21-text-capture-design.md`, section Scenarios: S99–S110 read text through `POST /capture/preview` (`internal/capture/preview_test.go`); S111 and S112 record through `POST /transaction-batches` (`internal/ledger/transaction_batch_test.go`). S151–S153 read text against a reference date (amendment A128, `TestPreviewReferenceDate`).

## 6.19 Daily flows

Amendment A119 of `docs/superpowers/specs/2026-10-21-account-card-design.md`: `GET /reports/flows` returns the booked inflow and outflow of one account per day. Tests in `internal/reporting/flows_test.go`.

### S115 Inflow and outflow of a checking account

On 2026-10-05, Nubank checking receives a salary of 1,000.00, pays a purchase of 25.00 and transfers 100.00 to savings; on 2026-10-07 it pays 8.00. Flows of October: 2026-10-05 inflow 1,000.00 and outflow 125.00; 2026-10-07 outflow 8.00. Savings: 2026-10-05 inflow 100.00.

### S116 Flows of a credit card

Purchases of 30.00 and 20.00 on 2026-10-12, a refund of 10.00 and a statement payment of 40.00 on 2026-10-13: outflow 50.00 on 2026-10-12, inflow 50.00 on 2026-10-13.

### S117 Day with a zero net delta

An income of 7.00 and a purchase of 7.00 on the same day are listed as inflow 7.00 and outflow 7.00, and the balance series is unchanged.

### S118 Flow problems

A voided transaction has no flow. `to` before `from`, or a range longer than 366 days, returns 400 `invalid_request` on `to`; another user's account returns 404 `not_found`.

## 6.20 Assistant

`docs/superpowers/specs/2026-10-23-assistant-chat-design.md`, section 16, and ADR 020. A scripted `llmtest` provider stands in for the language model. Tests in `internal/assistant`.

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

Scenarios of phase P9 (`docs/superpowers/plans/2026-10-26-p9-cash-view.md`, CV1 to CV6). Itaú Visa closes on day 3 and is due on day 10; amounts are BRL; `GET /reports/categories?class=expense&view=cash` reads one month.

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

`GET /reports/indicators?month=` (`docs/superpowers/specs/2026-10-26-analytics-design.md`, section 4) returns 12 month entries, oldest first, the last one the month asked. Ratios are basis points truncated toward zero.

### S154 Indicators of a month

Today 2026-10-20, base BRL. Every month from 2026-04 to 2026-10: salary 5,000.00 on the 5th, rent 1,500.00 on the 10th, food 1,000.00 on the 15th, all on Checking. A personal loan of 10,000.00 enters Checking on 2026-06-01; installments of 1,250.00 (principal 900.00, interest 350.00 on the system category Interest) leave Checking on the 20th from 2026-07 to 2026-10. Checking moves 3,000.00 to Savings on 2026-08-01, 4,000.00 to Locked CDB (savings, `excluded_from_liquidity`) on 2026-08-02, 600.00 to Meal card (benefit) on 2026-10-01, and exchanges 500.00 for 100.00 USD into Dollars (wallet, USD) on 2026-10-01; USD is priced 5 BRL on 2026-10-20. A subscription of 50.00 to Streaming is expected on 2026-10-25.

Month 2026-10: income 5,000.00; expense 2,850.00; committed 50.00; debt service 1,250.00; liquid balance 17,900.00 (Checking 14,400.00, Savings 3,000.00, Dollars 500.00); liabilities 6,400.00; mean income 5,000.00 and mean expense 2,675.00 over 2026-04 to 2026-09. Savings rate 4300; trailing savings rate 4650; liquidity 66915; committed share 100; debt service share 2500.

Savings rate by month from 2025-11: `no_income` five times, then 5000 (2026-04 to 2026-06), then 4300 (2026-07 to 2026-10). Trailing savings rate: `insufficient_history` from 2025-11 to 2026-06, then 5000, 4825, 4720, 4650.

### S155 Books without history

Today 2026-10-20. The owner has no posting; another user records a salary of 5,000.00 in 2026-10. The owner's 2026-10: every amount 0.00, no mean, savings rate `no_income`, the four other ratios `insufficient_history`.

### S156 Income without expense

Today 2026-10-20. Salary 5,000.00 on the 5th of 2026-07 to 2026-10, nothing else. Month 2026-10: savings rate 10000; trailing savings rate 10000; liquidity `no_expense`; committed share 0; debt service share 0.
