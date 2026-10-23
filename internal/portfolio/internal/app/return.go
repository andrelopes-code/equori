package app

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/domain"
)

// MaxReturnDays is the longest period of a return (investments design 4.3).
const MaxReturnDays = 366

var (
	ErrNotFound = errors.New("not found")
	// ErrInvalidReturnRange: from is after to, or the period exceeds MaxReturnDays.
	ErrInvalidReturnRange = errors.New("invalid return range")
	// ErrReturnUndefined: no money was invested in the period, or the rate has no solution.
	ErrReturnUndefined = errors.New("return undefined")
)

// Flow is money that entered (positive) or left (negative) an account tree on a date, in the
// balancing currency of its transaction.
type Flow struct {
	Date  time.Time
	Value money.Money
}

// ReturnFlow is a Flow valued in the currency of the report.
type ReturnFlow struct {
	Date   time.Time
	Amount money.Money
}

// ReturnReport is the money-weighted return of an account tree over a period.
type ReturnReport struct {
	AnnualBP         int
	Flows            []ReturnFlow
	Opening, Closing money.Money
}

// Return values the account tree the day before from and on to, values each external flow at the
// price of its date, and solves the annual rate of the result. in defaults to the base currency.
func (s *Service) Return(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time, in money.Currency) (ReturnReport, error) {
	return s.returnOf(ctx, userID, []uuid.UUID{accountID}, from, to, in)
}

// returnOf is Return over the accounts taken as one tree: a flow between two of them is internal.
func (s *Service) returnOf(ctx context.Context, userID int64, accountIDs []uuid.UUID, from, to time.Time, in money.Currency) (ReturnReport, error) {
	if to.Before(from) || to.Sub(from) > (MaxReturnDays-1)*24*time.Hour {
		return ReturnReport{}, ErrInvalidReturnRange
	}
	if in == "" {
		base, err := s.ledger.BaseCurrency(ctx, userID)
		if err != nil {
			return ReturnReport{}, err
		}
		in = base
	}
	start := from.AddDate(0, 0, -1)
	opening, err := s.valued(ctx, userID, accountIDs, start, in)
	if err != nil {
		return ReturnReport{}, err
	}
	closing, err := s.valued(ctx, userID, accountIDs, to, in)
	if err != nil {
		return ReturnReport{}, err
	}
	flows, err := s.ledger.ExternalFlows(ctx, userID, accountIDs, from, to)
	if err != nil {
		return ReturnReport{}, err
	}
	report := ReturnReport{Opening: opening, Closing: closing}
	cash := []domain.CashFlow{{Date: start, Amount: -opening.Amount()}, {Date: to, Amount: closing.Amount()}}
	for _, f := range flows {
		value := f.Value
		if value.Currency() != in {
			if value, _, err = s.md.Convert(ctx, value, in, f.Date); err != nil {
				return ReturnReport{}, fmt.Errorf("value the flow of %s: %w", f.Date.Format(time.DateOnly), err)
			}
		}
		report.Flows = append(report.Flows, ReturnFlow{Date: f.Date, Amount: value})
		cash = append(cash, domain.CashFlow{Date: f.Date, Amount: -value.Amount()})
	}
	bp, ok := domain.AnnualReturnBP(cash)
	if !ok {
		return ReturnReport{}, ErrReturnUndefined
	}
	report.AnnualBP = bp
	return report, nil
}

// valued sums the value of each account tree in currency in.
func (s *Service) valued(ctx context.Context, userID int64, accountIDs []uuid.UUID, date time.Time, in money.Currency) (money.Money, error) {
	total, err := money.New(0, in)
	if err != nil {
		return money.Money{}, err
	}
	for _, id := range accountIDs {
		v, err := s.ledger.ValuedBalance(ctx, userID, id, date, in)
		if err != nil {
			return money.Money{}, err
		}
		if total, err = total.Add(v); err != nil {
			return money.Money{}, fmt.Errorf("sum valued balances: %w", err)
		}
	}
	return total, nil
}

const (
	trailingDays      = 365
	minHistoryMonths  = 3
	maxTrailingMonths = 12
	daysPerMonth      = 30.4375
)

// TrailingReturn is the return of the accounts over the last 12 months, in basis points, with
// the whole months the window covers. ok is false, with no error, when the accounts have less
// than three months of postings, no external flow in the window, no price for a flow, or no
// solution (investments design 4.4, AG4).
func (s *Service) TrailingReturn(ctx context.Context, userID int64, accountIDs []uuid.UUID, today time.Time, in money.Currency) (bp, months int, ok bool, err error) {
	first, found, err := s.ledger.FirstPosting(ctx, userID, accountIDs)
	if err != nil || !found || first.After(today.AddDate(0, -minHistoryMonths, 0)) {
		return 0, 0, false, err
	}
	from := today.AddDate(0, 0, -trailingDays)
	if first.After(from) {
		from = first
	}
	report, err := s.returnOf(ctx, userID, accountIDs, from, today, in)
	if errors.Is(err, ErrReturnUndefined) || errors.Is(err, ErrPriceMissing) {
		return 0, 0, false, nil
	}
	if err != nil || len(report.Flows) == 0 {
		return 0, 0, false, err
	}
	months = min(maxTrailingMonths, int(math.Round(today.Sub(from).Hours()/24/daysPerMonth)))
	return report.AnnualBP, months, true, nil
}
