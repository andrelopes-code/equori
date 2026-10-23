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

The import flow (F4) is covered by S32–S36; classification (F5) by S37–S44 and S98 (amendment A105); the category tree and its tools by S72–S79 (amendments A73–A84 of `docs/superpowers/specs/2026-10-19-categorization-design.md`); transfers from imports by S45–S50; aggregator sync by S51–S59, S68–S71 and S90; matching by score by S91–S97 (amendments A98–A104); card statements from the institution by S80–S89 (amendments A85–A93); schedules (F7) by S27–S29 and the planning views by S60–S63; currencies and investments (F9) by S16, S17, S21, S22 and S64–S67; reimbursement of recorded expenses by S113 and S114 (amendment A117); text capture and the transaction batch by S99–S112 (amendments A106–A116 of `docs/superpowers/specs/2026-10-21-text-capture-design.md`).

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

## 6.18 Text capture

The scenarios, their fixture and the grammar they exercise are in `docs/superpowers/specs/2026-10-21-text-capture-design.md`, section Scenarios: S99–S110 read text through `POST /capture/preview` (`internal/capture/preview_test.go`); S111 and S112 record through `POST /transaction-batches` (`internal/ledger/transaction_batch_test.go`).

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
