package domain

// English is the wording of a language without its own.
func English() Wording {
	return Wording{
		YieldDay:           "Yield %s",
		YieldPeriod:        "Yield %s to %s",
		BalanceAdjustment:  "Balance adjustment",
		CardOpeningBalance: "Opening balance %s",
		StatementPayment:   "Statement payment %s",
		StatementFinancing: "Statement financing %s",
		Refund:             "Refund: %s",
		Cancellation:       "Cancellation: %s",
		Anticipation:       "Anticipation: %s",
		Chargeback:         "Chargeback: %s",
	}
}
