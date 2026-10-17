package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// BalanceAt returns the balance in the account currency; a parent account sums its descendants.
func (s *Service) BalanceAt(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, basis Basis) (Balance, error) {
	switch basis {
	case "":
		basis = BasisBooked
	case BasisBooked, BasisSettled:
	default:
		return Balance{}, &domain.FieldError{Field: "basis", Message: "must be booked or settled", Err: domain.ErrValidation}
	}
	a, err := s.repo.Account(ctx, userID, accountID)
	if err != nil {
		return Balance{}, err
	}
	instruments, err := s.repo.TreeInstruments(ctx, userID, accountID)
	if err != nil {
		return Balance{}, err
	}
	if len(instruments) > 1 {
		return Balance{}, ErrMixedInstruments
	}
	total, err := s.repo.BalanceAt(ctx, userID, accountID, date, basis)
	if err != nil {
		return Balance{}, err
	}
	amount, err := s.AmountOf(ctx, total, a.Instrument)
	if err != nil {
		return Balance{}, err
	}
	return Balance{AccountID: accountID, Date: date, Basis: basis, Amount: amount}, nil
}

// CategoryTotal returns the weights of the postings of a category subtree booked in
// [from, to), in the user's base currency (P7 amendment A54).
func (s *Service) CategoryTotal(ctx context.Context, userID int64, categoryID uuid.UUID, from, to time.Time) (money.Money, error) {
	settings, err := s.repo.Settings(ctx, userID)
	if err != nil {
		return money.Money{}, err
	}
	if _, err := s.repo.Account(ctx, userID, categoryID); err != nil {
		return money.Money{}, err
	}
	total, err := s.repo.CategoryTotal(ctx, userID, categoryID, from, to)
	if err != nil {
		return money.Money{}, err
	}
	return money.New(total, settings.BaseCurrency)
}

// CategoryMonthlyTotals is CategoryTotal for each month in [from, to), keyed by its first day.
func (s *Service) CategoryMonthlyTotals(ctx context.Context, userID int64, categoryID uuid.UUID, from, to time.Time) (map[time.Time]money.Money, error) {
	settings, err := s.repo.Settings(ctx, userID)
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.Account(ctx, userID, categoryID); err != nil {
		return nil, err
	}
	totals, err := s.repo.CategoryMonthlyTotals(ctx, userID, categoryID, from, to)
	if err != nil {
		return nil, err
	}
	out := make(map[time.Time]money.Money, len(totals))
	for m, total := range totals {
		if out[m], err = money.New(total, settings.BaseCurrency); err != nil {
			return nil, err
		}
	}
	return out, nil
}
