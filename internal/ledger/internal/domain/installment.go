package domain

import (
	"math/bits"

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

// Allocate splits total over shares in proportion, rounding down, and gives the
// rounding remainder to the largest share (P2 amendment A6, same rule as the cash view).
func Allocate(total int64, shares []int64) []int64 {
	var sum int64
	largest := 0
	for i, s := range shares {
		sum += s
		if s > shares[largest] {
			largest = i
		}
	}
	out := make([]int64, len(shares))
	if sum == 0 {
		return out
	}
	var allocated int64
	for i, s := range shares {
		out[i] = mulDiv(total, s, sum)
		allocated += out[i]
	}
	out[largest] += total - allocated
	return out
}

// mulDiv returns a*b/c rounded toward zero without overflowing for |a|, |b|, |c| ≤ 2^53.
func mulDiv(a, b, c int64) int64 {
	hi, lo := bits.Mul64(uint64(a), uint64(b)) //nolint:gosec // callers pass non-negative amounts.
	q, _ := bits.Div64(hi, lo, uint64(c))      //nolint:gosec // c is a positive sum of amounts.
	return int64(q)                            //nolint:gosec // q ≤ a because b ≤ c.
}
