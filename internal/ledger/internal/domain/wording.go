package domain

// Wording holds, in one language, the descriptions of the transactions the ledger creates. Each
// field is a fmt format whose %s verbs take the values named in its comment.
type Wording struct {
	YieldDay           string // the day
	YieldPeriod        string // the first day, the last day
	BalanceAdjustment  string
	CardOpeningBalance string // the card's name
	StatementPayment   string // the statement reference
	StatementFinancing string // the statement reference
	Refund             string // the purchase's description
	Cancellation       string // the purchase's description
	Anticipation       string // the purchase's description
	Chargeback         string // the purchase's description
}
