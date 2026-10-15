package domain

import (
	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// SplitInstallments divides total into n parts in minor units; the remainder goes to
// the first part (DM3), so the parts always sum to total.
func SplitInstallments(total money.Money, n int) []money.Money {
	per := total.Amount() / int64(n)
	first := total.Amount() - per*int64(n-1)
	parts := make([]money.Money, n)
	for i := range parts {
		amount := per
		if i == 0 {
			amount = first
		}
		parts[i], _ = money.New(amount, total.Currency()) // |amount| ≤ |total|, already valid
	}
	return parts
}

const (
	PlanPurchase  = "purchase"
	PlanFinancing = "financing"
)

type InstallmentPlan struct {
	ID                  uuid.UUID
	UserID              int64
	AccountID           uuid.UUID
	OriginTransactionID uuid.UUID
	Kind                string
	Count               int
	Principal           money.Money
	Interest            money.Money
	FirstStatementID    uuid.UUID
}
