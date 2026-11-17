package app

import (
	"cmp"
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// MaxEventDays is the longest range of FixedIncomeEvents (A236 FC17).
const MaxEventDays = 400

// ErrInvalidEventRange: to is before from, or the range exceeds MaxEventDays.
var ErrInvalidEventRange = errors.New("invalid fixed income event range")

// Coupon is what one unit of a fixed income security pays on a payment date (A236 FC8).
type Coupon struct {
	Date           time.Time
	PaysOn         time.Time
	Interest       string
	Principal      string
	AmortizationBP int
	PaysInterest   bool
	RateMissing    bool
}

// FixedIncomeEvent is a payment of a held fixed income security (A236 FC17).
type FixedIncomeEvent struct {
	AccountID   uuid.UUID
	Instrument  money.Currency
	Date        time.Time
	Kind        string // interest, amortization, maturity, unit_tax, unit_tax
	Quantity    money.Money
	Gross       *money.Money // nil with RateMissing
	RateMissing bool
	State       string // upcoming, due, recorded
}

// FixedIncomeEvents lists the payments dated in [from, to] of the fixed income securities the
// book held at the day before from or at to, sorted by date, account and kind (A236 FC17).
func (s *Service) FixedIncomeEvents(
	ctx context.Context,
	booksID int64,
	from, to time.Time,
) ([]FixedIncomeEvent, error) {
	if to.Before(from) || to.Sub(from) > MaxEventDays*24*time.Hour {
		return nil, ErrInvalidEventRange
	}

	holdings, err := s.fixedIncomeHoldings(ctx, booksID, from, to)
	if err != nil {
		return nil, err
	}

	positions := positionCache{repo: s.repo, booksID: booksID}
	today := s.ledger.Today(ctx)

	var out []FixedIncomeEvent
	for _, h := range holdings {
		es, err := s.holdingEvents(ctx, booksID, h, to, today, &positions)
		if err != nil {
			return nil, err
		}

		for _, e := range es {
			if !e.Date.Before(from) {
				out = append(out, e)
			}
		}
	}

	unitTax, err := s.unitTaxEvents(ctx, booksID, from, to, today, &positions)
	if err != nil {
		return nil, err
	}

	out = append(out, unitTax...)

	slices.SortFunc(out, compareEvents)

	return out, nil
}

type holding struct {
	account    uuid.UUID
	instrument money.Currency
}

// fixedIncomeHoldings are the accounts holding a fixed income instrument the day before from or
// at to.
func (s *Service) fixedIncomeHoldings(
	ctx context.Context,
	booksID int64,
	from, to time.Time,
) ([]holding, error) {
	return s.heldInstruments(ctx, booksID, from, to, func(info InstrumentInfo) bool {
		return info.Type == typeFixedIncome
	})
}

// heldInstruments are the accounts holding an instrument that keep accepts, the day before from
// or at to.
// shortcut: a position bought and sold inside the range has no event listed; upgrade when
// positions carry their first and last day.
func (s *Service) heldInstruments(
	ctx context.Context,
	booksID int64,
	from, to time.Time,
	keep func(InstrumentInfo) bool,
) ([]holding, error) {
	var out []holding

	keeps := map[money.Currency]bool{}

	for _, day := range []time.Time{from.AddDate(0, 0, -1), to} {
		rows, err := s.repo.PositionsAt(ctx, booksID, day)
		if err != nil {
			return nil, err
		}

		for _, r := range rows {
			kept, known := keeps[r.Instrument]
			if !known {
				info, err := s.md.InstrumentOf(ctx, r.Instrument)
				if err != nil {
					return nil, err
				}

				kept = keep(info)
				keeps[r.Instrument] = kept
			}

			h := holding{r.AccountID, r.Instrument}
			if kept && r.Quantity > 0 && !slices.Contains(out, h) {
				out = append(out, h)
			}
		}
	}

	return out, nil
}

func compareEvents(a, b FixedIncomeEvent) int {
	return cmp.Or(
		a.Date.Compare(b.Date),
		cmp.Compare(a.AccountID.String(), b.AccountID.String()),
		cmp.Compare(kindOrder(a.Kind), kindOrder(b.Kind)),
	)
}

func kindOrder(kind string) int {
	return slices.Index(
		[]string{
			domain.EventInterest, domain.EventAmortization, domain.EventMaturity,
			domain.EventUnitTax,
		},
		kind,
	)
}

// positionCache reads the positions of a day once.
type positionCache struct {
	repo    Repository
	booksID int64
	days    map[string][]domain.PositionDay
}

// held is the quantity of an account in an instrument at the end of date.
func (c *positionCache) held(ctx context.Context, h holding, date time.Time) (int64, error) {
	key := date.Format(time.DateOnly)

	rows, ok := c.days[key]
	if !ok {
		var err error

		rows, err = c.repo.PositionsAt(ctx, c.booksID, date)
		if err != nil {
			return 0, err
		}

		if c.days == nil {
			c.days = map[string][]domain.PositionDay{}
		}

		c.days[key] = rows
	}

	for _, r := range rows {
		if r.AccountID == h.account && r.Instrument == h.instrument {
			return r.Quantity, nil
		}
	}

	return 0, nil
}
