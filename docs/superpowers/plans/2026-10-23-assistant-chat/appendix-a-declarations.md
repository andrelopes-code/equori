# Appendix A: tool declarations

Generated from the design catalog. Each tool's `Spec.Name`, `Spec.Description` and input struct are copied verbatim. Ranges stated in a description (limit 1 to 50, installments 2 to 48, days 1 to 31, years 1900 to 2999, scale 0 to 12) are checked in the handler with `tool.InvalidArgument(field, "must be between A and B")`, because schema inference reads only descriptions from tags.

## `list_accounts`

- Module: `ledger`; effect: `read_only`
- Description:

```text
Lists the user's accounts and categories by class and then name, with the IDs the other tools take, each account's institution, and the user's base currency. Income and expense accounts are the categories of transactions; a child account carries its parent. Use it to find the ID of an account or category named by the user. Do not use it for balances: get_balances returns them.
```

```go
type listAccountsClass string

func (listAccountsClass) Values() []string { return []string{"asset", "liability", "equity", "income", "expense"} }

type listAccountsIn struct {
	Class listAccountsClass `json:"class,omitzero" jsonschema:"keep only accounts of this class; income and expense accounts are the categories of transactions"`
	IncludeClosed bool `json:"include_closed,omitzero" jsonschema:"also list closed accounts"`
	tool.PageArgs
}
```

## `get_balances`

- Module: `ledger`; effect: `read_only`
- Description:

```text
Returns the balance of every asset, liability and equity account at a date, by class and then account name; accounts with a zero balance are omitted. Use it for how much is in accounts, cards owed or net position at a date. Do not use it for spending by category: get_category_totals returns it; nor for a balance over time: get_account_history returns it.
```

```go
type getBalancesBasis string

func (getBalancesBasis) Values() []string { return []string{"booked", "settled"} }

type getBalancesClass string

func (getBalancesClass) Values() []string { return []string{"asset", "liability", "equity"} }

type getBalancesIn struct {
	Date tool.Date `json:"date,omitzero" jsonschema:"balances at the end of this date; today when absent"`
	Basis getBalancesBasis `json:"basis,omitzero" jsonschema:"booked places a posting at the transaction date, settled at the institution's settlement date; booked when absent"`
	Class getBalancesClass `json:"class,omitzero" jsonschema:"keep only accounts of this class"`
	tool.PageArgs
}
```

## `search_transactions`

- Module: `ledger`; effect: `read_only`
- Description:

```text
Searches the user's transactions, newest first, with their payee, tags and postings; each posting names its account or category. Use it to find transactions by text, account, category, tag, period or missing category, and to get the transaction_id other tools take. Do not use it for totals by category: get_category_totals adds them up. Filters combine; narrow them instead of reading many pages.
```

```go
type searchTransactionsIn struct {
	Query string `json:"query,omitzero" jsonschema:"case-insensitive text found in the description, the payee name or a posting memo"`
	AccountID string `json:"account_id,omitzero" jsonschema:"keep transactions with a posting on this account or category; IDs come from list_accounts"`
	Tag string `json:"tag,omitzero" jsonschema:"keep transactions with this tag"`
	From tool.Date `json:"from,omitzero" jsonschema:"first date, inclusive"`
	To tool.Date `json:"to,omitzero" jsonschema:"last date, inclusive"`
	Uncategorized bool `json:"uncategorized,omitzero" jsonschema:"keep only transactions still waiting for a category"`
	tool.PageArgs
}
```

## `get_transaction`

- Module: `ledger`; effect: `read_only`
- Description:

```text
Returns one transaction in full: postings, links to refunds and reimbursements, earlier versions with their reasons, attachment names, disputes and, for an installment purchase, its plan. Use it before changing a transaction or to explain its history. Do not use it to find transactions: search_transactions does.
```

```go
type getTransactionIn struct {
	TransactionID string `json:"transaction_id" jsonschema:"ID of the transaction, from search_transactions"`
	IncludeReimbursement bool `json:"include_reimbursement,omitzero" jsonschema:"also list the incoming transactions that can repay this expense, or the expenses this incoming transaction can repay"`
}
```

## `list_payees_and_tags`

- Module: `ledger`; effect: `read_only`
- Description:

```text
Lists the user's payees, the tags in use or the institutions, by name, with IDs. Use it to find the payee_id a write takes or to check whether a payee, tag or institution exists. Do not use it for transactions of a payee: search_transactions with query does that.
```

```go
type listPayeesAndTagsKind string

func (listPayeesAndTagsKind) Values() []string { return []string{"payees", "tags", "institutions"} }

type listPayeesAndTagsIn struct {
	Kind listPayeesAndTagsKind `json:"kind" jsonschema:"what to list"`
	Query string `json:"query,omitzero" jsonschema:"case-insensitive text the name must contain"`
	tool.PageArgs
}
```

## `get_account_details`

- Module: `ledger`; effect: `read_only`
- Description:

```text
Returns one account in depth: reconciliation state and recorded institution balances; for a credit card account, its plastic cards, current credit limit and available limit, billing cycle, statements, the statement a purchase date falls on and the installments already committed to a month. Use it for questions about one account or card. Do not use it for a statement's lines: get_statement returns them.
```

```go
type getAccountDetailsIn struct {
	AccountID string `json:"account_id" jsonschema:"ID of the account, from list_accounts"`
	PurchaseDate tool.Date `json:"purchase_date,omitzero" jsonschema:"for a card: return the statement a purchase on this date is billed on"`
	Month string `json:"month,omitzero" jsonschema:"for a card: return the installments committed to the statement of this month; written YYYY-MM"`
	StatementsFrom string `json:"statements_from,omitzero" jsonschema:"for a card: first statement month to list; the last 6 months when absent; written YYYY-MM"`
}
```

## `get_statement`

- Module: `ledger`; effect: `read_only`
- Description:

```text
Returns one credit card statement with its amounts, status, dates and every line: charges, credits, payments and installments. Use it to explain a statement or check its lines. Do not use it to list statements: get_account_details lists them with their IDs.
```

```go
type getStatementIn struct {
	StatementID string `json:"statement_id" jsonschema:"ID of the statement, from get_account_details"`
}
```

## `record_transaction`

- Module: `ledger`; effect: `write`
- Description:

```text
Proposes a new transaction: money moves from one account or category to another. A purchase moves from a checking, cash or card account to an expense category; income moves from an income category to an asset account; a transfer moves between two own accounts. With installments on a card it records an installment purchase; with original_amount on a card it records a foreign purchase; with to_amount between two currencies it records an exchange. Use it when the user asks to record, add or log a transaction. Do not use it to change an existing transaction: change_transaction does. The user confirms the proposal before anything is recorded.
```

```go
type recordTransactionSplitsItem struct {
	ToAccountID string `json:"to_account_id" jsonschema:"expense category or account receiving this part"`
	Amount string `json:"amount" jsonschema:"positive decimal amount of this part"`
}

type recordTransactionIn struct {
	Date tool.Date `json:"date" jsonschema:"transaction date"`
	Description string `json:"description" jsonschema:"short description, such as the merchant or the purpose"`
	Amount string `json:"amount" jsonschema:"positive decimal amount in the currency of from_account_id, such as 125.90"`
	FromAccountID string `json:"from_account_id" jsonschema:"account or category the money leaves: a checking, cash or card account for a purchase, an income category for income"`
	ToAccountID string `json:"to_account_id,omitzero" jsonschema:"account or category the money reaches: an expense category for a purchase, an asset account for income or a transfer; absent when splits is set"`
	Splits []recordTransactionSplitsItem `json:"splits,omitzero" jsonschema:"several destinations whose amounts add up to amount"`
	PayeeID string `json:"payee_id,omitzero" jsonschema:"payee from list_payees_and_tags"`
	Tags []string `json:"tags,omitzero" jsonschema:"tags of the transaction"`
	Installments int `json:"installments,omitzero" jsonschema:"number of installments, 2 to 48, for a purchase on a credit card account"`
	OriginalAmount string `json:"original_amount,omitzero" jsonschema:"for a foreign purchase on a card: positive amount charged in original_currency"`
	OriginalCurrency string `json:"original_currency,omitzero" jsonschema:"for a foreign purchase on a card: ISO 4217 code of the charged currency"`
	ExchangeRate string `json:"exchange_rate,omitzero" jsonschema:"for a foreign purchase: decimal rate from original_currency to the card's currency, such as 5.4830"`
	ToAmount string `json:"to_amount,omitzero" jsonschema:"for an exchange between accounts in two currencies: positive amount received in the currency of to_account_id"`
}
```

## `change_transaction`

- Module: `ledger`; effect: `write`
- Description:

```text
Proposes a change to an existing transaction: correct its date, description, payee, tags, amount or accounts; turn its category side into a transfer to another own account; or make this incoming transaction the reimbursement of recorded expenses. Use it when the user asks to fix, edit or relink a transaction. Do not use it to set a category: categorize_transactions does; nor to void: void_transaction does; nor for card refunds: handle_card_purchase does. The user confirms before the change applies.
```

```go
type changeTransactionAction string

func (changeTransactionAction) Values() []string { return []string{"correct", "make_transfer", "reimburse"} }

type changeTransactionAllocationsItem struct {
	ExpenseID string `json:"expense_id" jsonschema:"transaction_id of the expense repaid"`
	Amount string `json:"amount" jsonschema:"positive decimal amount allocated to it"`
}

type changeTransactionIn struct {
	TransactionID string `json:"transaction_id" jsonschema:"ID of the transaction, from search_transactions"`
	Action changeTransactionAction `json:"action" jsonschema:"correct changes the fields given; make_transfer replaces the category side with another own account; reimburse links this incoming transaction to the expenses it repays"`
	Reason string `json:"reason,omitzero" jsonschema:"for correct: why the transaction changes, kept in its history"`
	Date tool.Date `json:"date,omitzero" jsonschema:"for correct: new date"`
	Description string `json:"description,omitzero" jsonschema:"for correct: new description"`
	PayeeID string `json:"payee_id,omitzero" jsonschema:"for correct: new payee from list_payees_and_tags"`
	Tags []string `json:"tags,omitzero" jsonschema:"for correct: the complete new list of tags"`
	Amount string `json:"amount,omitzero" jsonschema:"for correct: new positive amount of a transaction with one source and one destination"`
	FromAccountID string `json:"from_account_id,omitzero" jsonschema:"for correct: new source account or category"`
	ToAccountID string `json:"to_account_id,omitzero" jsonschema:"for correct: new destination account or category; for make_transfer: the own account that receives the money"`
	Allocations []changeTransactionAllocationsItem `json:"allocations,omitzero" jsonschema:"for reimburse: the expenses repaid and the part of this transaction each takes"`
}
```

## `categorize_transactions`

- Module: `ledger`; effect: `write`
- Description:

```text
Proposes giving one category to one or more transactions, and optionally a payee. Use it when the user asks to categorize, classify or recategorize transactions, including every uncategorized transaction found by search_transactions. Do not use it to split a transaction among categories: change_transaction does. The user confirms before categories change.
```

```go
type categorizeTransactionsIn struct {
	TransactionIDs []string `json:"transaction_ids" jsonschema:"IDs of the transactions, from search_transactions; at most 50"`
	CategoryID string `json:"category_id" jsonschema:"income or expense category from list_accounts"`
	PayeeID string `json:"payee_id,omitzero" jsonschema:"payee to set on each transaction, from list_payees_and_tags"`
}
```

## `void_transaction`

- Module: `ledger`; effect: `destructive`
- Description:

```text
Proposes voiding a transaction: it stops counting in balances and reports and stays in history with the reason. Use it when the user asks to delete, remove, cancel or void a transaction. Do not use it to change values: change_transaction does. The user confirms before the transaction is voided.
```

```go
type voidTransactionIn struct {
	TransactionID string `json:"transaction_id" jsonschema:"ID of the transaction, from search_transactions"`
	Reason string `json:"reason" jsonschema:"why the transaction is voided, kept in its history"`
}
```

## `manage_accounts_and_payees`

- Module: `ledger`; effect: `destructive`
- Description:

```text
Proposes a change to accounts, categories, payees or institutions: create, rename or move an account or category, close or reopen it, merge a category or payee into another, create or rename a payee, create an institution. Use it when the user asks to organize accounts, categories or payees. Do not use it for card settings: manage_card does. Merging cannot be undone; the user confirms every change.
```

```go
type manageAccountsAndPayeesAction string

func (manageAccountsAndPayeesAction) Values() []string { return []string{"create_account", "update_account", "close_account", "reopen_account", "merge_category", "create_payee", "rename_payee", "merge_payee", "create_institution"} }

type manageAccountsAndPayeesClass string

func (manageAccountsAndPayeesClass) Values() []string { return []string{"asset", "liability", "equity", "income", "expense"} }

type manageAccountsAndPayeesKind string

func (manageAccountsAndPayeesKind) Values() []string { return []string{"checking", "savings", "cash", "wallet", "benefit", "reserve", "brokerage", "receivable", "loan", "credit_card", "other"} }

type manageAccountsAndPayeesIn struct {
	Action manageAccountsAndPayeesAction `json:"action" jsonschema:"operation to propose"`
	AccountID string `json:"account_id,omitzero" jsonschema:"account or category to change or merge, from list_accounts"`
	Name string `json:"name,omitzero" jsonschema:"name of the new or renamed account, category, payee or institution"`
	Class manageAccountsAndPayeesClass `json:"class,omitzero" jsonschema:"for create_account: class of the new account; income and expense create categories"`
	Kind manageAccountsAndPayeesKind `json:"kind,omitzero" jsonschema:"for create_account of an asset or liability: kind of account"`
	Currency string `json:"currency,omitzero" jsonschema:"for create_account: currency or instrument code; the base currency when absent"`
	ParentID string `json:"parent_id,omitzero" jsonschema:"for create_account and update_account: parent account or category"`
	InstitutionID string `json:"institution_id,omitzero" jsonschema:"for create_account and update_account: institution from list_payees_and_tags"`
	Date tool.Date `json:"date,omitzero" jsonschema:"for close_account: closing date; today when absent"`
	IntoID string `json:"into_id,omitzero" jsonschema:"for merge_category and merge_payee: category or payee that remains"`
	PayeeID string `json:"payee_id,omitzero" jsonschema:"for rename_payee and merge_payee: payee to change, from list_payees_and_tags"`
}
```

## `manage_card`

- Module: `ledger`; effect: `write`
- Description:

```text
Proposes a change to a credit card account's setup: add a plastic or virtual card, activate or deactivate one, set a new credit limit or a new billing cycle. Use it when the user changes card details. Do not use it for purchases or statements: handle_card_purchase and settle_statement do. The user confirms every change.
```

```go
type manageCardAction string

func (manageCardAction) Values() []string { return []string{"add_card", "set_card_active", "set_credit_limit", "set_billing_cycle"} }

type manageCardIn struct {
	AccountID string `json:"account_id" jsonschema:"credit card account, from list_accounts"`
	Action manageCardAction `json:"action" jsonschema:"operation to propose"`
	CardID string `json:"card_id,omitzero" jsonschema:"for set_card_active: card from get_account_details"`
	Holder string `json:"holder,omitzero" jsonschema:"for add_card: name printed on the card"`
	LastFour string `json:"last_four,omitzero" jsonschema:"for add_card: last four digits"`
	Virtual bool `json:"virtual,omitzero" jsonschema:"for add_card: the card is virtual"`
	Active bool `json:"active,omitzero" jsonschema:"for set_card_active: true activates, false deactivates"`
	Amount string `json:"amount,omitzero" jsonschema:"for set_credit_limit: positive limit in the card's currency"`
	EffectiveFrom tool.Date `json:"effective_from,omitzero" jsonschema:"for set_credit_limit: first date of the limit; for set_billing_cycle: any date of the first statement month it applies to"`
	ClosingDay int `json:"closing_day,omitzero" jsonschema:"for set_billing_cycle: day of the month the statement closes"`
	DueDay int `json:"due_day,omitzero" jsonschema:"for set_billing_cycle: day of the month the statement is due"`
}
```

## `handle_card_purchase`

- Module: `ledger`; effect: `write`
- Description:

```text
Proposes an event on a card purchase: a full or partial refund, opening or resolving a dispute, cancelling the remaining installments, or paying installments early. Use it when the user reports a refund, a chargeback, a cancelled installment purchase or an early payment of installments. Do not use it to record a new purchase: record_transaction does. The user confirms first.
```

```go
type handleCardPurchaseAction string

func (handleCardPurchaseAction) Values() []string { return []string{"refund", "open_dispute", "resolve_dispute", "cancel_installments", "anticipate_installments"} }

type handleCardPurchaseOutcome string

func (handleCardPurchaseOutcome) Values() []string { return []string{"won", "lost"} }

type handleCardPurchaseIn struct {
	TransactionID string `json:"transaction_id" jsonschema:"the card purchase, from search_transactions"`
	Action handleCardPurchaseAction `json:"action" jsonschema:"operation to propose"`
	Date tool.Date `json:"date,omitzero" jsonschema:"date of the event; today when absent"`
	Amount string `json:"amount,omitzero" jsonschema:"for refund and anticipate_installments: positive amount in the card's currency"`
	Outcome handleCardPurchaseOutcome `json:"outcome,omitzero" jsonschema:"for resolve_dispute: won refunds the remaining charged amount"`
	FromInstallment int `json:"from_installment,omitzero" jsonschema:"for anticipate_installments: first installment number paid early"`
	ToInstallment int `json:"to_installment,omitzero" jsonschema:"for anticipate_installments: last installment number paid early"`
	Statement string `json:"statement,omitzero" jsonschema:"statement month the credit or the anticipated installments go to; the next open statement when absent; written YYYY-MM"`
}
```

## `settle_statement`

- Module: `ledger`; effect: `write`
- Description:

```text
Proposes an action on a credit card statement: pay it from an account, finance its unpaid amount in installments, confirm the amount the institution charges, or record or remove the institution's due date and total. Use it when the user pays a card bill or reports what the bank's statement says. Do not use it for one purchase: handle_card_purchase does. The user confirms first.
```

```go
type settleStatementAction string

func (settleStatementAction) Values() []string { return []string{"pay", "finance", "confirm_amount_due", "set_facts", "remove_facts"} }

type settleStatementIn struct {
	StatementID string `json:"statement_id" jsonschema:"statement from get_account_details"`
	Action settleStatementAction `json:"action" jsonschema:"operation to propose"`
	Date tool.Date `json:"date,omitzero" jsonschema:"for pay and finance: date of the operation; today when absent"`
	Amount string `json:"amount,omitzero" jsonschema:"for pay: amount paid; for confirm_amount_due and set_facts: the institution's total; positive, in the card's currency"`
	FromAccountID string `json:"from_account_id,omitzero" jsonschema:"for pay: account the payment leaves"`
	InstallmentCount int `json:"installment_count,omitzero" jsonschema:"for finance: number of installments"`
	InstallmentAmount string `json:"installment_amount,omitzero" jsonschema:"for finance: positive amount of each installment"`
	DueDate tool.Date `json:"due_date,omitzero" jsonschema:"for set_facts: due date the institution states"`
	ClosingDate tool.Date `json:"closing_date,omitzero" jsonschema:"for set_facts: closing date the institution states"`
}
```

## `reconcile_account`

- Module: `ledger`; effect: `write`
- Description:

```text
Proposes a reconciliation step on an account: record the balance the institution reports at a date, resolve the open difference of a recorded balance, or unlock reconciled postings from a date. Use it when the user says what the bank shows or asks to reconcile. Do not use it to correct a single transaction: change_transaction does. The user confirms first.
```

```go
type reconcileAccountAction string

func (reconcileAccountAction) Values() []string { return []string{"record_balance", "resolve_difference", "unlock"} }

type reconcileAccountResolution string

func (reconcileAccountResolution) Values() []string { return []string{"adjustment", "yield", "transactions_added"} }

type reconcileAccountIn struct {
	AccountID string `json:"account_id" jsonschema:"account from list_accounts"`
	Action reconcileAccountAction `json:"action" jsonschema:"operation to propose"`
	Date tool.Date `json:"date,omitzero" jsonschema:"for record_balance: date of the reported balance; for unlock: first date unlocked"`
	Amount string `json:"amount,omitzero" jsonschema:"for record_balance: decimal balance the institution reports, negative for a debt"`
	Resolution reconcileAccountResolution `json:"resolution,omitzero" jsonschema:"for resolve_difference: adjustment posts the difference to Adjustments, yield to Yield; transactions_added checks again after the user recorded the missing transactions"`
}
```

## `record_investment`

- Module: `ledger`; effect: `write`
- Description:

```text
Proposes an investment transaction in a brokerage: buy or sell a security for cash of the same brokerage at average cost, or record income paid on a security. Use it when the user reports a trade, a dividend or other investment income. Do not use it to define a new security: manage_instrument does. The user confirms first.
```

```go
type recordInvestmentKind string

func (recordInvestmentKind) Values() []string { return []string{"buy", "sell", "income"} }

type recordInvestmentIn struct {
	Kind recordInvestmentKind `json:"kind" jsonschema:"operation to propose"`
	AccountID string `json:"account_id" jsonschema:"security account inside a brokerage, from list_accounts"`
	CashAccountID string `json:"cash_account_id" jsonschema:"cash account of the same brokerage"`
	Date tool.Date `json:"date" jsonschema:"trade or payment date"`
	Quantity string `json:"quantity,omitzero" jsonschema:"for buy and sell: positive quantity of the security"`
	UnitPrice string `json:"unit_price,omitzero" jsonschema:"for buy and sell: decimal price of one unit in the cash account's currency"`
	Fees string `json:"fees,omitzero" jsonschema:"for buy and sell: positive fees charged"`
	Taxes string `json:"taxes,omitzero" jsonschema:"for buy and sell: positive taxes charged"`
	Gross string `json:"gross,omitzero" jsonschema:"for income: positive gross amount paid"`
	Withheld string `json:"withheld,omitzero" jsonschema:"for income: positive tax withheld at source"`
	IncomeType string `json:"income_type,omitzero" jsonschema:"for income: type from get_portfolio with view income_types"`
	CategoryID string `json:"category_id,omitzero" jsonschema:"for income: income category from list_accounts"`
}
```

## `get_category_totals`

- Module: `reporting`; effect: `read_only`
- Description:

```text
Totals the income or expense categories in a period, each with its own total and the total of its subtree, in category name order; only categories with postings and their ancestors are listed. Use it for how much was spent or earned by category. Do not use it for the transactions behind a total: search_transactions with account_id lists them.
```

```go
type getCategoryTotalsClass string

func (getCategoryTotalsClass) Values() []string { return []string{"income", "expense"} }

type getCategoryTotalsIn struct {
	Class getCategoryTotalsClass `json:"class" jsonschema:"expense totals spending, income totals earnings; both are positive"`
	From tool.Date `json:"from" jsonschema:"first date, inclusive"`
	To tool.Date `json:"to" jsonschema:"last date, inclusive; at most 366 days after from"`
	tool.PageArgs
}
```

## `get_account_history`

- Module: `reporting`; effect: `read_only`
- Description:

```text
Returns the daily balance of an account and its sub-accounts over a period, or its booked inflow and outflow per day. Use it for how a balance evolved or how much entered and left an account. Do not use it for a balance at one date: get_balances does; nor for the future: project_balance does.
```

```go
type getAccountHistoryView string

func (getAccountHistoryView) Values() []string { return []string{"balances", "flows"} }

type getAccountHistoryIn struct {
	AccountID string `json:"account_id" jsonschema:"account from list_accounts"`
	View getAccountHistoryView `json:"view" jsonschema:"balances gives the balance each day; flows gives inflow and outflow each day with postings"`
	From tool.Date `json:"from" jsonschema:"first date, inclusive"`
	To tool.Date `json:"to" jsonschema:"last date, inclusive; at most 366 days after from"`
}
```

## `list_schedules`

- Module: `planning`; effect: `read_only`
- Description:

```text
Lists recurring schedules (bills, income, subscriptions, transfers, savings) with their terms, the occurrences expected or realized in a period, or the total committed to a month. Use it for upcoming bills, subscriptions and what is due. Do not use it for budgets or goals: get_budgets_and_goals does.
```

```go
type listSchedulesState string

func (listSchedulesState) Values() []string { return []string{"expected", "overdue", "realized", "skipped"} }

type listSchedulesIn struct {
	ScheduleID string `json:"schedule_id,omitzero" jsonschema:"one schedule, with its terms versions and pauses"`
	From tool.Date `json:"from,omitzero" jsonschema:"first date of the occurrences listed; today when absent"`
	To tool.Date `json:"to,omitzero" jsonschema:"last date of the occurrences listed; 31 days after from when absent; at most 366 days after from"`
	State listSchedulesState `json:"state,omitzero" jsonschema:"keep occurrences in this state"`
	Month string `json:"month,omitzero" jsonschema:"return the installments and expected occurrences committed to this month; written YYYY-MM"`
	tool.PageArgs
}
```

## `get_budgets_and_goals`

- Module: `planning`; effect: `read_only`
- Description:

```text
Returns the monthly budgets with planned, carried, spent and available amounts for a month, and the goals with their target, current value, progress and trailing return. Use it for how a budget or goal is going. Do not use it for spending by category without a budget: get_category_totals does.
```

```go
type getBudgetsAndGoalsKind string

func (getBudgetsAndGoalsKind) Values() []string { return []string{"budgets", "goals", "both"} }

type getBudgetsAndGoalsIn struct {
	Month string `json:"month,omitzero" jsonschema:"month of the budget progress; the current month when absent; written YYYY-MM"`
	Kind getBudgetsAndGoalsKind `json:"kind,omitzero" jsonschema:"budgets, goals or both; both when absent"`
}
```

## `project_balance`

- Module: `planning`; effect: `read_only`
- Description:

```text
Projects the balance of an account to a future date from its schedules, with each expected occurrence on the way. Use it for will there be enough money on a date. Do not use it for past balances: get_account_history does.
```

```go
type projectBalanceIn struct {
	AccountID string `json:"account_id" jsonschema:"balance account from list_accounts"`
	To tool.Date `json:"to" jsonschema:"last date projected, after today and at most 12 months ahead"`
}
```

## `manage_schedule`

- Module: `planning`; effect: `write`
- Description:

```text
Proposes creating a recurring schedule or changing one: new terms from a date, a pause, or an end. Use it when the user sets up or changes a recurring bill, income, subscription, transfer or saving. Do not use it for one occurrence: manage_occurrence does. The user confirms first.
```

```go
type manageScheduleAction string

func (manageScheduleAction) Values() []string { return []string{"create", "change_terms", "pause", "end"} }

type manageScheduleKind string

func (manageScheduleKind) Values() []string { return []string{"bill", "income", "subscription", "transfer", "savings"} }

type manageScheduleFrequency string

func (manageScheduleFrequency) Values() []string { return []string{"daily", "weekly", "monthly", "yearly"} }

type manageScheduleIn struct {
	Action manageScheduleAction `json:"action" jsonschema:"operation to propose"`
	ScheduleID string `json:"schedule_id,omitzero" jsonschema:"for change_terms, pause and end: schedule from list_schedules"`
	Kind manageScheduleKind `json:"kind,omitzero" jsonschema:"for create: kind of schedule"`
	Description string `json:"description,omitzero" jsonschema:"for create: description of each transaction"`
	AccountID string `json:"account_id,omitzero" jsonschema:"for create: balance account the money leaves or reaches"`
	CounterpartID string `json:"counterpart_id,omitzero" jsonschema:"for create: category, or the other account of a transfer"`
	PayeeID string `json:"payee_id,omitzero" jsonschema:"for create: payee from list_payees_and_tags"`
	Amount string `json:"amount,omitzero" jsonschema:"for create and change_terms: positive amount of each occurrence"`
	Frequency manageScheduleFrequency `json:"frequency,omitzero" jsonschema:"for create and change_terms: repetition unit"`
	Interval int `json:"interval,omitzero" jsonschema:"for create and change_terms: repeat every this many units; 1 when absent"`
	DayOfMonth int `json:"day_of_month,omitzero" jsonschema:"for monthly schedules: day of the month"`
	Start tool.Date `json:"start,omitzero" jsonschema:"for create: date of the first occurrence"`
	Until tool.Date `json:"until,omitzero" jsonschema:"for create: last possible date; absent for no end"`
	From tool.Date `json:"from,omitzero" jsonschema:"for change_terms: first date the new terms apply; for pause: first paused date; for end: first date without occurrences"`
	To tool.Date `json:"to,omitzero" jsonschema:"for pause: last paused date"`
}
```

## `manage_occurrence`

- Module: `planning`; effect: `write`
- Description:

```text
Proposes an action on one occurrence of a schedule: link it to the transaction that paid it, skip it, move it to another date, or release a linked transaction. Use it when the user says a bill was paid, will be skipped or moved. Do not use it to change every future occurrence: manage_schedule does. The user confirms first.
```

```go
type manageOccurrenceAction string

func (manageOccurrenceAction) Values() []string { return []string{"realize", "skip", "move", "unrealize"} }

type manageOccurrenceIn struct {
	OccurrenceID string `json:"occurrence_id" jsonschema:"occurrence from list_schedules"`
	Action manageOccurrenceAction `json:"action" jsonschema:"operation to propose"`
	TransactionID string `json:"transaction_id,omitzero" jsonschema:"for realize: the transaction that fulfilled the occurrence, from search_transactions"`
	Date tool.Date `json:"date,omitzero" jsonschema:"for move: new date"`
	Reason string `json:"reason,omitzero" jsonschema:"for skip: why it is skipped"`
}
```

## `manage_budget_or_goal`

- Module: `planning`; effect: `destructive`
- Description:

```text
Proposes creating a monthly budget for a category, setting a budget's amount from a month on, or creating, changing or deleting a goal. Use it when the user sets a spending limit or a savings target. Do not use it for recurring payments: manage_schedule does. Deleting a goal cannot be undone; the user confirms every change.
```

```go
type manageBudgetOrGoalAction string

func (manageBudgetOrGoalAction) Values() []string { return []string{"create_budget", "set_budget_amount", "create_goal", "update_goal", "delete_goal"} }

type manageBudgetOrGoalIn struct {
	Action manageBudgetOrGoalAction `json:"action" jsonschema:"operation to propose"`
	BudgetID string `json:"budget_id,omitzero" jsonschema:"for set_budget_amount: budget from get_budgets_and_goals"`
	GoalID string `json:"goal_id,omitzero" jsonschema:"for update_goal and delete_goal: goal from get_budgets_and_goals"`
	CategoryID string `json:"category_id,omitzero" jsonschema:"for create_budget: expense category from list_accounts"`
	Amount string `json:"amount,omitzero" jsonschema:"for create_budget and set_budget_amount: positive monthly amount; for create_goal and update_goal: positive target"`
	Month string `json:"month,omitzero" jsonschema:"for create_budget and set_budget_amount: first month the amount applies to; written YYYY-MM"`
	Rollover bool `json:"rollover,omitzero" jsonschema:"for create_budget: the unspent amount carries to the next month"`
	Name string `json:"name,omitzero" jsonschema:"for create_goal and update_goal: goal name"`
	DueOn tool.Date `json:"due_on,omitzero" jsonschema:"for create_goal and update_goal: date the target should be reached"`
	AccountIDs []string `json:"account_ids,omitzero" jsonschema:"for create_goal and update_goal: balance accounts whose value counts toward the goal"`
}
```

## `get_portfolio`

- Module: `portfolio`; effect: `read_only`
- Description:

```text
Returns investment views at a date: positions with quantity, cost and market value; allocation by instrument type, currency or institution; net worth; or the annual return of an account over a period. Also lists the income types and instrument subtypes the user's tax jurisdiction accepts. Use it for questions about investments and net worth. Do not use it for cash balances only: get_balances does; nor for a tax year: get_tax_year does.
```

```go
type getPortfolioView string

func (getPortfolioView) Values() []string { return []string{"positions", "allocation", "net_worth", "return", "income_types", "subtypes"} }

type getPortfolioBy string

func (getPortfolioBy) Values() []string { return []string{"type", "currency", "institution"} }

type getPortfolioInstrumentType string

func (getPortfolioInstrumentType) Values() []string { return []string{"currency", "stock", "etf", "reit", "depositary_receipt", "fixed_income", "fund", "crypto"} }

type getPortfolioIn struct {
	View getPortfolioView `json:"view" jsonschema:"what to return"`
	Date tool.Date `json:"date,omitzero" jsonschema:"for positions, allocation and net_worth: valuation date; today when absent"`
	By getPortfolioBy `json:"by,omitzero" jsonschema:"for allocation: grouping"`
	AccountID string `json:"account_id,omitzero" jsonschema:"for return: account or brokerage from list_accounts"`
	From tool.Date `json:"from,omitzero" jsonschema:"for return: first date"`
	To tool.Date `json:"to,omitzero" jsonschema:"for return: last date"`
	InstrumentType getPortfolioInstrumentType `json:"instrument_type,omitzero" jsonschema:"for subtypes: instrument type"`
}
```

## `get_tax_year`

- Module: `portfolio`; effect: `read_only`
- Description:

```text
Returns a tax year of investments: realized results of sales at average cost with their tax class, and investment income with its tax treatment. Use it to prepare a tax return or answer what was gained or received in a year. Do not use it for current positions: get_portfolio does.
```

```go
type getTaxYearView string

func (getTaxYearView) Values() []string { return []string{"sales", "income", "both"} }

type getTaxYearIn struct {
	Year int `json:"year" jsonschema:"calendar year"`
	View getTaxYearView `json:"view,omitzero" jsonschema:"sales gives realized results, income gives income events; both when absent"`
}
```

## `get_market_data`

- Module: `marketdata`; effect: `read_only`
- Description:

```text
Returns market data of the instance: instruments with their type and scale, one instrument with its fixed income terms, prices of an instrument in a period, business-day calendars or a calendar's holidays in a year. Use it for prices, securities and holidays. Do not use it for the user's holdings: get_portfolio does.
```

```go
type getMarketDataView string

func (getMarketDataView) Values() []string { return []string{"instruments", "instrument", "prices", "calendars", "holidays"} }

type getMarketDataIn struct {
	View getMarketDataView `json:"view" jsonschema:"what to return"`
	Code string `json:"code,omitzero" jsonschema:"for instrument and prices: instrument code, such as a ticker or currency code"`
	Quote string `json:"quote,omitzero" jsonschema:"for prices: code of the currency the price is quoted in"`
	From tool.Date `json:"from,omitzero" jsonschema:"for prices: first date"`
	To tool.Date `json:"to,omitzero" jsonschema:"for prices: last date; at most 366 days after from"`
	Calendar string `json:"calendar,omitzero" jsonschema:"for holidays: calendar identifier from the calendars view"`
	Year int `json:"year,omitzero" jsonschema:"for holidays: calendar year"`
}
```

## `manage_instrument`

- Module: `marketdata`; effect: `write`
- Description:

```text
Proposes defining a security for the whole instance, recording a manual price, or setting the terms of a fixed income instrument. Use it when the user needs a security that does not exist yet or a price that is missing. Do not use it to buy or sell: record_investment does. Instruments and prices are shared by every user of the instance; the user confirms first.
```

```go
type manageInstrumentAction string

func (manageInstrumentAction) Values() []string { return []string{"define", "record_price", "set_terms"} }

type manageInstrumentType string

func (manageInstrumentType) Values() []string { return []string{"currency", "stock", "etf", "reit", "depositary_receipt", "fixed_income", "fund", "crypto"} }

type manageInstrumentIn struct {
	Action manageInstrumentAction `json:"action" jsonschema:"operation to propose"`
	Code string `json:"code" jsonschema:"instrument code"`
	Name string `json:"name,omitzero" jsonschema:"for define: instrument name"`
	Type manageInstrumentType `json:"type,omitzero" jsonschema:"for define: instrument type"`
	QuoteCurrency string `json:"quote_currency,omitzero" jsonschema:"for define: currency the instrument is priced in"`
	Scale int `json:"scale,omitzero" jsonschema:"for define: decimal places of a quantity"`
	Date tool.Date `json:"date,omitzero" jsonschema:"for record_price: price date"`
	Price string `json:"price,omitzero" jsonschema:"for record_price: decimal price of one unit in quote_currency"`
	IssuedOn tool.Date `json:"issued_on,omitzero" jsonschema:"for set_terms: issue date"`
	MaturesOn tool.Date `json:"matures_on,omitzero" jsonschema:"for set_terms: maturity date"`
	FaceValue string `json:"face_value,omitzero" jsonschema:"for set_terms: face value"`
	IndexID string `json:"index_id,omitzero" jsonschema:"for set_terms: index identifier; absent for a fixed rate"`
	PercentOfIndexBP int `json:"percent_of_index_bp,omitzero" jsonschema:"for set_terms: percentage of the index in basis points, 11000 for 110%"`
	SpreadBP int `json:"spread_bp,omitzero" jsonschema:"for set_terms: annual spread in basis points"`
}
```

## `list_rules`

- Module: `classification`; effect: `read_only`
- Description:

```text
Lists categorization rules by priority, rules suggested from the user's repeated corrections, the categories an aggregator assigned to imported lines, or payee aliases. Use it to see why transactions get a category automatically or what suggestions are waiting. Do not use it for one transaction's categorization: explain_categorization does.
```

```go
type listRulesKind string

func (listRulesKind) Values() []string { return []string{"rules", "suggestions", "source_categories", "payee_aliases"} }

type listRulesIn struct {
	Kind listRulesKind `json:"kind" jsonschema:"what to list"`
	RuleID string `json:"rule_id,omitzero" jsonschema:"for rules: return only this rule"`
	tool.PageArgs
}
```

## `explain_categorization`

- Module: `classification`; effect: `read_only`
- Description:

```text
Explains how transactions got their categories (rule, source category, history or manual), counts transactions by categorization method in a period, or previews what a rule would categorize. Use it for why a transaction has a category, how much is categorized automatically, or before proposing a rule. Do not use it to change a category: categorize_transactions does.
```

```go
type explainCategorizationView string

func (explainCategorizationView) Values() []string { return []string{"transactions", "statistics", "rule_preview"} }

type explainCategorizationIn struct {
	View explainCategorizationView `json:"view" jsonschema:"what to return"`
	TransactionIDs []string `json:"transaction_ids,omitzero" jsonschema:"for transactions: IDs from search_transactions; at most 50"`
	From tool.Date `json:"from,omitzero" jsonschema:"for statistics: first date"`
	To tool.Date `json:"to,omitzero" jsonschema:"for statistics: last date"`
	DescriptionContains string `json:"description_contains,omitzero" jsonschema:"for rule_preview: text the description must contain"`
	CategoryID string `json:"category_id,omitzero" jsonschema:"for rule_preview: category the rule would set"`
}
```

## `manage_rule`

- Module: `classification`; effect: `destructive`
- Description:

```text
Proposes a change to automatic categorization: create, change, reorder or delete a rule; accept or dismiss a suggested rule; run the rules over uncategorized transactions; map an aggregator's category; create, change or delete a payee alias. Use it when the user wants future transactions categorized automatically. Do not use it for transactions already recorded one by one: categorize_transactions does. The user confirms every change.
```

```go
type manageRuleAction string

func (manageRuleAction) Values() []string { return []string{"create_rule", "change_rule", "delete_rule", "reorder_rules", "accept_suggestion", "dismiss_suggestion", "run_rules", "map_source_category", "create_alias", "change_alias", "delete_alias"} }

type manageRuleMatchType string

func (manageRuleMatchType) Values() []string { return []string{"equals", "starts_with", "contains"} }

type manageRuleIn struct {
	Action manageRuleAction `json:"action" jsonschema:"operation to propose"`
	RuleID string `json:"rule_id,omitzero" jsonschema:"for change_rule and delete_rule: rule from list_rules"`
	SuggestionID string `json:"suggestion_id,omitzero" jsonschema:"for accept_suggestion and dismiss_suggestion: suggestion from list_rules"`
	SourceCategoryID string `json:"source_category_id,omitzero" jsonschema:"for map_source_category: source category from list_rules"`
	AliasID string `json:"alias_id,omitzero" jsonschema:"for change_alias and delete_alias: alias from list_rules"`
	Name string `json:"name,omitzero" jsonschema:"for create_rule, change_rule and accept_suggestion: rule name"`
	DescriptionContains string `json:"description_contains,omitzero" jsonschema:"for create_rule and change_rule: text the description must contain"`
	CategoryID string `json:"category_id,omitzero" jsonschema:"for create_rule, change_rule and map_source_category: category to set"`
	PayeeID string `json:"payee_id,omitzero" jsonschema:"for create_rule and change_rule: payee to set; for create_alias and change_alias: payee the alias names"`
	Pattern string `json:"pattern,omitzero" jsonschema:"for create_alias and change_alias: text matched against imported descriptions"`
	MatchType manageRuleMatchType `json:"match_type,omitzero" jsonschema:"for create_alias and change_alias: how pattern matches"`
	RuleIDs []string `json:"rule_ids,omitzero" jsonschema:"for reorder_rules: every rule ID in the new priority order"`
}
```

## `get_imports`

- Module: `ingestion`; effect: `read_only`
- Description:

```text
Returns import activity: statement import batches with their counts, the records of a batch and those needing review, entries of an account that no bank line confirmed, and bank connections with their sync state and accounts. Use it for whether a bank synced, what an import did or what needs review. Do not use it for the transactions themselves: search_transactions does.
```

```go
type getImportsView string

func (getImportsView) Values() []string { return []string{"batches", "records", "unconfirmed", "connections"} }

type getImportsState string

func (getImportsState) Values() []string { return []string{"received", "matched", "created", "needs_review", "discarded", "withdrawn"} }

type getImportsIn struct {
	View getImportsView `json:"view" jsonschema:"what to return"`
	BatchID string `json:"batch_id,omitzero" jsonschema:"for records: batch from the batches view"`
	State getImportsState `json:"state,omitzero" jsonschema:"for records: keep records in this state"`
	AccountID string `json:"account_id,omitzero" jsonschema:"for unconfirmed: balance account from list_accounts"`
	tool.PageArgs
}
```

## `manage_imports`

- Module: `ingestion`; effect: `destructive`
- Description:

```text
Proposes an action on imports and bank connections: sync a connection now, map a bank account of a connection to a ledger account or ignore it, resolve a record that needs review, delete a connection, or delete an integration without connections. Use it when the user asks to sync, map, review or remove a bank link. Do not use it to add credentials or a new connection: the user does that on the Links screen, and get_help explains it. The user confirms first.
```

```go
type manageImportsAction string

func (manageImportsAction) Values() []string { return []string{"sync", "map_account", "resolve_record", "delete_connection", "delete_integration"} }

type manageImportsResolution string

func (manageImportsResolution) Values() []string { return []string{"match", "create", "discard"} }

type manageImportsIn struct {
	Action manageImportsAction `json:"action" jsonschema:"operation to propose"`
	ConnectionID string `json:"connection_id,omitzero" jsonschema:"for sync, map_account and delete_connection: connection from get_imports"`
	ExternalAccountID string `json:"external_account_id,omitzero" jsonschema:"for map_account: bank account of the connection, from get_imports"`
	AccountID string `json:"account_id,omitzero" jsonschema:"for map_account: ledger account receiving the bank account's lines; absent with ignore"`
	Ignore bool `json:"ignore,omitzero" jsonschema:"for map_account: stop importing this bank account"`
	SyncFrom tool.Date `json:"sync_from,omitzero" jsonschema:"for map_account: first date imported"`
	RecordID string `json:"record_id,omitzero" jsonschema:"for resolve_record: record from get_imports"`
	Resolution manageImportsResolution `json:"resolution,omitzero" jsonschema:"for resolve_record: match links it to transaction_id, create records a new transaction, discard drops it"`
	TransactionID string `json:"transaction_id,omitzero" jsonschema:"for resolve_record with match: transaction from search_transactions"`
	IntegrationID string `json:"integration_id,omitzero" jsonschema:"for delete_integration: integration from get_imports"`
}
```

## `update_profile`

- Module: `identity`; effect: `write`
- Description:

```text
Proposes changing the user's language or region, which set the language of the app and of these answers and the format of numbers and dates. Use it when the user asks to switch language or region. Do not use it for the base currency, which is fixed after the first transaction. The user confirms first.
```

```go
type updateProfileIn struct {
	Language string `json:"language,omitzero" jsonschema:"ISO 639 language code, such as en or pt"`
	Region string `json:"region,omitzero" jsonschema:"ISO 3166-1 alpha-2 region code, such as US or BR"`
}
```

## `get_help`

- Module: `assistant`; effect: `read_only`
- Description:

```text
Returns an article of the equori guide: what a concept means in this app, how a task is done, and the screens where it is done with their paths. Use it for how-to and where-is questions, for concepts such as postings, statements or reconciliation, and for tasks the assistant cannot do, such as adding bank credentials or importing a file. Do not use it for the user's own data: the other tools return it.
```

```go
type getHelpTopic string

func (getHelpTopic) Values() []string { return []string{"getting_started", "accounts_and_categories", "transactions_and_postings", "capture", "credit_cards_and_statements", "installments", "foreign_purchases_and_exchange", "refunds_reimbursements_and_disputes", "transfers", "imports_and_bank_connections", "categorization_rules_and_payees", "reconciliation", "schedules_and_occurrences", "budgets", "goals", "investments", "reports", "privacy_and_the_assistant", "settings_language_and_region"} }

type getHelpIn struct {
	Topic getHelpTopic `json:"topic" jsonschema:"article to return"`
}
```
