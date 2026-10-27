package domain

// Portuguese takes its terms from the glossary of docs/domain/02-ubiquitous-language.md.
func Portuguese() Wording {
	return Wording{
		YieldDay:           "Rendimento de %s",
		YieldPeriod:        "Rendimento de %s a %s",
		BalanceAdjustment:  "Ajuste de saldo",
		CardOpeningBalance: "Saldo inicial %s",
		StatementPayment:   "Pagamento de fatura %s",
		StatementFinancing: "Parcelamento de fatura %s",
		Refund:             "Estorno: %s",
		Cancellation:       "Cancelamento: %s",
		Anticipation:       "Antecipação: %s",
		Chargeback:         "Contestação: %s",
	}
}
