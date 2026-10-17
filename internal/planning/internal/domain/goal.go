package domain

import (
	"math/bits"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Goal is a target balance over balance accounts by a date (P7 amendment A55).
type Goal struct {
	ID         uuid.UUID
	Name       string
	Target     int64
	Currency   money.Currency
	DueOn      time.Time
	AccountIDs []uuid.UUID
}

func (g Goal) Validate() error {
	if n := len([]rune(g.Name)); n < 1 || n > 60 {
		return invalid("name", "must have 1 to 60 characters")
	}
	if g.Target <= 0 {
		return invalid("target", "must be positive")
	}
	return nil
}

// GoalProgress is a goal measured against the current balance of its accounts.
type GoalProgress struct {
	Current, Remaining int64
	ProgressBP         int
}

// Measure returns remaining = max(target − current, 0) and progress = ⌊current × 10000 ÷ target⌋
// within [0, 10000].
func (g Goal) Measure(current int64) GoalProgress {
	p := GoalProgress{Current: current, Remaining: max(g.Target-current, 0)}
	switch {
	case current <= 0:
	case current >= g.Target:
		p.ProgressBP = 10000
	default:
		// current < target, so the quotient is below 10000; 128 bits hold current × 10000.
		hi, lo := bits.Mul64(uint64(current), 10000)
		q, _ := bits.Div64(hi, lo, uint64(g.Target)) //nolint:gosec // 0 < current < target here
		p.ProgressBP = int(q)                        //nolint:gosec // q < 10000
	}
	return p
}
