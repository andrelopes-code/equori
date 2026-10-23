# Appendix B: guide articles

Copy each block verbatim to `internal/assistant/internal/guide/articles/<topic>.md`. Bold terms are terms of `docs/domain/02-ubiquitous-language.md` (checked by `TestGuideTermsExistInGlossary`). The screens of each topic come from the navigation map, so articles name screens without paths.

## getting_started

```markdown
equori keeps a double-entry **Ledger** of your money. Every **Account** you own (checking, cash, card, brokerage) and every **Category** of income or expense is an account of the ledger. A **Transaction** moves money between accounts through its **Posting** lines, which always add up to zero.

Start with your accounts and their opening balances on the Accounts screen, then record transactions by hand, by text capture, by importing bank files or by linking a bank. The Overview screen summarizes the month; Transactions lists everything by day.

The assistant reads your data, explains concepts and screens, and prepares changes. Every change it prepares is a proposal you confirm or reject on a card in the conversation; nothing changes before you confirm.
```

## accounts_and_categories

```markdown
An **Account** has an **Account class**: asset and liability accounts hold money you have or owe; income and expense accounts are your categories; equity accounts hold opening balances and adjustments. Asset and liability accounts also have an **Account kind**, such as checking, savings, cash, reserve, brokerage, receivable, loan or credit card.

A **Category** is an income or expense account. Categories form a tree: a **Parent account** sums its children, so Food can hold Supermarket and Restaurant. An **Institution** is the bank or broker that keeps an account.

Create accounts and categories on the New account screen; rename, move, close or reopen them on Edit account. Merging a category moves all its postings into another category and cannot be undone; it is done on the Categories screen. Closing an account keeps its history; reopening brings it back.
```

## transactions_and_postings

```markdown
A **Transaction** has a date, a description, an optional **Payee**, optional tags, and two or more **Posting** lines. The **Sign convention**: a positive amount increases an asset or an expense; a negative amount increases a liability, an income or equity. A purchase of 50 on a checking account posts -50 to checking and +50 to the expense category.

A **Split** gives one transaction several categories. A **Correction** creates a new version of the transaction and keeps the earlier one in its history with the reason. Voiding removes a transaction from balances and reports and keeps it in history.

Record transactions on New transaction or Text capture; open one on Transaction detail; change it on Correct transaction. A transaction waiting for a category shows in Transactions with the uncategorized filter.
```

## capture

```markdown
Text capture records several transactions by typing one per line, such as "lunch 45.90 card yesterday". Each line becomes a draft with date, amount, account and category read from the words you use, the names of your accounts and payees, and your history.

Lines without a known category may receive a suggestion from the language model; you accept or change each suggestion before recording. Nothing is recorded until you confirm the drafts.

Text capture is on the Text capture screen, reached from Transactions.
```

## credit_cards_and_statements

```markdown
A **Card account** is a liability account for a credit card; its **Card** entries are the plastic or virtual cards. The **Billing cycle rule** sets the closing day and the due day; a purchase is **Billed on** the **Statement** its date falls into. The **Credit limit** and the purchases give the available limit.

A **Statement** has a **Statement status**: open, closed, paid, partially paid, overdue or financed. A **Statement payment** moves money from a balance account to the card. **Statement financing** turns the unpaid amount into installments. You can record the total and due date the bank states and confirm the amount due to reconcile the statement.

See cards on Cards, a card's statements and settings on Card, and a statement's lines, payment and financing on Statement.
```

## installments

```markdown
An **Installment purchase** splits a card purchase into an **Installment plan**: each **Installment** is billed on a later **Statement**. A plan can carry interest, and the card issuer's own installment amounts can replace the even split.

Cancelling a plan credits the installments not yet billed. Paying installments early (anticipation) moves chosen installments to one statement, usually with a discount. The **Committed amount** of a month is what installments and expected bills already take from it.

Record an installment purchase on New transaction with the card and the number of installments. Cancel or anticipate a plan on Statement or Card.
```

## foreign_purchases_and_exchange

```markdown
A purchase charged in another **Currency** on a card keeps the original amount and the rate, and adds the card's foreign charge as a separate fee posting when the card has one.

A currency exchange moves money between two of your accounts in different currencies, one of them in your base currency, and may carry a fee. Balances in other currencies are valued with stored prices when a report needs one currency.

Record both on New transaction. The rate is written as a decimal from the charged currency to the card's currency.
```

## refunds_reimbursements_and_disputes

```markdown
A **Refund** credits all or part of a card purchase, linked to it by a **Link**. A **Chargeback** is the refund that follows a dispute you won; opening a dispute keeps the purchase on the statement until it is resolved.

A **Reimbursement** is money someone pays you back for an expense you recorded, such as a **Shared expense**: the incoming transaction is linked to the expenses it repays and reduces them in your reports.

Record refunds and disputes on Statement or Transaction detail; link a reimbursement on Transaction detail of the incoming transaction.
```

## transfers

```markdown
A transfer moves money between two of your own accounts, such as checking to savings, or checking to a card to pay it. It changes no income or expense.

When an imported line was recorded with a category but was really a transfer, turn it into a transfer: its category side is replaced with the other account, and an existing matching transaction on that account can be paired with it.

Record transfers on New transaction; turn a transaction into a transfer on Transaction detail.
```

## imports_and_bank_connections

```markdown
equori imports OFX and CSV statement files into an account. Each file is an **Import batch**; each line is an **External record** that is matched to an existing transaction, creates a new one, or waits for your review when the match is ambiguous. The **Deduplication key** stops a line from being imported twice.

A bank connection through an aggregator imports lines automatically. Adding the aggregator's credentials and connecting a bank happen on the Links screen and only you can do them; the assistant cannot handle credentials. After connecting, map each bank account to an equori account and sync.

Import a file on Import statement of the account; review a batch on Import batch; manage connections on Links.
```

## categorization_rules_and_payees

```markdown
A **Categorization rule** sets the category, the payee or tags of transactions whose fields match its conditions, such as a description containing "uber". Rules run by priority when transactions are imported or captured, and on request over every uncategorized transaction. equori suggests rules from your repeated manual corrections.

A **Payee** is who you pay or who pays you. A payee alias maps raw bank descriptions to a payee. A **Tag** is a free label on a transaction.

Manage rules on Rules, New rule and Rule; payees and aliases on Payees.
```

## reconciliation

```markdown
A **Balance assertion** records the balance your bank reports for an account at a date. When equori's balance matches, the account is reconciled up to that date: its postings become reconciled. When it differs, the **Difference** stays open until you record the missing transactions, post it as yield, or post it as an adjustment.

**Reconciliation** of a card statement confirms the amount due the bank charges. Unlocking returns reconciled postings from a date to cleared so you can correct them.

Reconcile on the Account screen; statements on Statement.
```

## schedules_and_occurrences

```markdown
A **Schedule** is a recurring bill, income, **Subscription**, transfer or saving with a **Recurrence rule**, such as monthly on day 5. Each expected date is an **Occurrence**; a date that falls on a weekend or holiday moves by the schedule's business-day rule.

When the transaction that pays an occurrence is recorded, it is linked to the occurrence (realized). An occurrence can be skipped or moved. New terms apply from a date; a pause suppresses a period; ending stops future occurrences.

Scheduled occurrences show on Transactions and on the Account screen, where the **Projection** uses them.
```

## budgets

```markdown
A **Budget** sets a monthly amount for an expense category from a month on. Each month shows the planned amount, what was carried from the previous month when rollover is on, what was spent in the category and its subcategories, and what remains available.

Budgets use the **Accrual view**: a card purchase counts in the month of its date, not when the statement is paid.

The app has no budgets screen yet; the assistant creates budgets, changes their amounts and reports their progress.
```

## goals

```markdown
A **Goal** is a target amount to reach by a date over one or more of your balance accounts. Its progress is the current value of those accounts against the target; for investment accounts the value uses stored prices. The goal also shows the return of its accounts over the last 12 months.

Create, change and delete goals on the Goals screen, which also shows what-if values.
```

## investments

```markdown
A brokerage account holds a cash account and one account per **Security**. A trade buys or sells a security for cash of the same brokerage; the **Position** keeps the quantity and the **Cost basis** at **Average cost**. **Investment income**, such as dividends, is paid into the brokerage's cash and may have tax withheld.

The **Market value** of a position uses the latest stored **Price** of its **Instrument**. Instruments and prices are shared by every user of the instance. Fixed income securities can carry terms from which equori accrues a daily price.

Positions show on the Account screen of a brokerage; allocation, return and **Net worth** come from the reports.
```

## reports

```markdown
Reports read your ledger: totals by **Category** for a period, the balance of an account day by day, money in and out of an account, allocation of your assets, return of an investment account and **Net worth**.

The **Accrual view** counts a card purchase on its date; the **Cash view** counts it when the statement is paid.

Category totals are on Categories; an account's balance chart and figures on the Account screen; the month summary on Overview.
```

## privacy_and_the_assistant

```markdown
Privacy mode hides every amount on screen, including the assistant's answers and its proposal cards. Turn it on in Settings, in the account menu or in the command palette.

The assistant sends your question and the data its tools read to the language model provider chosen in Settings. On a free tier that uses submitted content for training, the panel says so before the first message. Daily limits per provider and model are declared in Settings; when they are reached, or the provider's quota runs out, the assistant shows when it returns.

The assistant never changes data by itself: each change is a proposal you confirm. Conversations stay until you delete them.
```

## settings_language_and_region

```markdown
Your language sets the language of the app and of the assistant's answers. Your region sets how numbers and dates are written and which regional rules apply, such as the business-day calendar and tax rules of investments.

The base currency is chosen when your account is created and can change only before the first transaction. Language model providers, the chain of models of each use and daily limits are in the Assistant section of Settings.

Change language and region in Settings, or ask the assistant to do it.
```
