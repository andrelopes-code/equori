package domain

import (
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Category is a category account as decisions need it.
type Category struct {
	Class      string
	Instrument money.Currency
	OpenedOn   time.Time
	ClosedOn   *time.Time
}

func (c Category) usable(instrument money.Currency, date time.Time) bool {
	return c.Instrument == instrument && !date.Before(c.OpenedOn) && (c.ClosedOn == nil || !date.After(*c.ClosedOn))
}

// Allocation is one category posting of a decision, signed like the posting.
type Allocation struct {
	CategoryID uuid.UUID
	Amount     money.Money
}

// Allocate divides total among parts (P5 amendment A21): percent parts rounded toward zero,
// so their sum never exceeds the total, then fixed parts, then the remainder; zero shares are
// dropped. It returns false when a category cannot take a posting on date or the fixed parts
// exceed the total.
func Allocate(total money.Money, parts []Part, categories map[uuid.UUID]Category, date time.Time) ([]Allocation, bool) {
	sign := int64(1)
	n := total.Amount()
	if n < 0 {
		sign, n = -1, -n
	}
	left := n
	shares := make([]int64, len(parts))
	for i, p := range parts {
		c, ok := categories[p.CategoryID]
		if !ok || !c.usable(total.Currency(), date) {
			return nil, false
		}
		switch {
		case p.Percent != 0:
			// Split n to keep n·percent within int64 for amounts up to 2^53.
			shares[i] = n/basisPointsAll*int64(p.Percent) + n%basisPointsAll*int64(p.Percent)/basisPointsAll
		case p.Amount != nil:
			if p.Amount.Currency() != total.Currency() {
				return nil, false
			}
			shares[i] = p.Amount.Amount()
		default:
			continue
		}
		left -= shares[i]
	}
	if left < 0 {
		return nil, false
	}
	out := make([]Allocation, 0, len(parts))
	for i, p := range parts {
		if p.Remainder {
			shares[i] = left
		}
		if shares[i] == 0 {
			continue
		}
		amount, err := money.New(sign*shares[i], total.Currency())
		if err != nil {
			return nil, false
		}
		out = append(out, Allocation{CategoryID: p.CategoryID, Amount: amount})
	}
	return out, len(out) > 0
}
