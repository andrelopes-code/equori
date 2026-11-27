package toolapi

import (
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type getAccountDetailsIn struct {
	AccountID      string    `json:"account_id"               jsonschema:"ID of the account, from list_accounts"`
	PurchaseDate   tool.Date `json:"purchase_date,omitzero"   jsonschema:"for a card: return the statement a purchase on this date is billed on"`
	Month          string    `json:"month,omitzero"           jsonschema:"for a card: return the installments committed to the statement of this month; written YYYY-MM"`
	StatementsFrom string    `json:"statements_from,omitzero" jsonschema:"for a card: first statement month to list; the last 6 months when absent; written YYYY-MM"`
}

type accountSummaryView struct {
	AccountID string `json:"account_id"`
	Name      string `json:"name"`
	Class     string `json:"class"`
	Kind      string `json:"kind,omitzero"`
	Currency  string `json:"currency"`
	Closed    bool   `json:"closed,omitzero"`
}

type openDifferenceView struct {
	AssertionID string     `json:"assertion_id"`
	Date        tool.Date  `json:"date"`
	Difference  tool.Money `json:"difference"`
}

type reconciliationView struct {
	LastReconciledOn tool.Date          `json:"last_reconciled_on,omitzero"`
	OpenDifference   openDifferenceView `json:"open_difference,omitzero"`
}

type assertionView struct {
	Date       tool.Date  `json:"date"`
	Amount     tool.Money `json:"amount"`
	Reconciled bool       `json:"reconciled"`
	Source     string     `json:"source"`
}

type cardView struct {
	CardID   string `json:"card_id"`
	Holder   string `json:"holder"`
	LastFour string `json:"last_four"`
	Virtual  bool   `json:"virtual,omitzero"`
	Active   bool   `json:"active"`
}

type billingCycleView struct {
	EffectiveFrom        string `json:"effective_from"                   jsonschema:"YYYY-MM"`
	ClosingMode          string `json:"closing_mode"                     jsonschema:"day or before_due"`
	ClosingDay           int    `json:"closing_day,omitzero"             jsonschema:"with closing_mode day"`
	ClosingDaysBeforeDue int    `json:"closing_days_before_due,omitzero" jsonschema:"with closing_mode before_due: days before the due day, before its shift"`
	ClosingAdjustment    string `json:"closing_adjustment"`
	DueDay               int    `json:"due_day"`
	DueDateAdjustment    string `json:"due_date_adjustment"`
	ClosingDayAssignment string `json:"closing_day_assignment"`
	Calendar             string `json:"calendar"`
}

type statementRowView struct {
	StatementID string     `json:"statement_id"`
	Reference   string     `json:"reference"    jsonschema:"YYYY-MM"`
	ClosingDate tool.Date  `json:"closing_date"`
	DueDate     tool.Date  `json:"due_date"`
	Status      string     `json:"status"`
	AmountDue   tool.Money `json:"amount_due"`
	Unpaid      tool.Money `json:"unpaid"`
}

type placementView struct {
	Reference   string    `json:"reference"    jsonschema:"YYYY-MM"`
	ClosingDate tool.Date `json:"closing_date"`
	DueDate     tool.Date `json:"due_date"`
}

type commitmentView struct {
	Month  string     `json:"month"  jsonschema:"YYYY-MM"`
	Amount tool.Money `json:"amount"`
}

type cardDetailsView struct {
	Cards          []cardView         `json:"cards"`
	CreditLimit    tool.Money         `json:"credit_limit,omitzero"`
	AvailableLimit tool.Money         `json:"available_limit,omitzero"`
	BillingCycles  []billingCycleView `json:"billing_cycles"           jsonschema:"the cycle version in force this month and every later one, oldest first"`
	Statements     []statementRowView `json:"statements"`
	Placement      placementView      `json:"placement,omitzero"`
	Committed      commitmentView     `json:"committed,omitzero"`
}

type getAccountDetailsOut struct {
	Account           accountSummaryView `json:"account"`
	Reconciliation    reconciliationView `json:"reconciliation"`
	BalanceAssertions []assertionView    `json:"balance_assertions"`
	Card              cardDetailsView    `json:"card,omitzero"`
}
