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
	total, err := s.repo.BalanceAt(ctx, userID, accountID, date, basis)
	if err != nil {
		return Balance{}, err
	}
	amount, err := money.New(total, a.Instrument)
	if err != nil {
		return Balance{}, err
	}
	return Balance{AccountID: accountID, Date: date, Basis: basis, Amount: amount}, nil
}
