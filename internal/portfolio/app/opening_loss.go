package app

import (
	"context"
	"fmt"
	"slices"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// OpeningLossError is the field of the opening losses that breaks a rule of investment history
// LO2 or LO4; Field names the item, as in losses[0].pool.
type OpeningLossError struct{ Field, Message string }

func (e *OpeningLossError) Error() string { return e.Field + " " + e.Message }

// OpeningLosses returns the pools of the jurisdiction that accept an opening loss, the losses
// the book holds and its base currency (investment history LO4). A region without a jurisdiction
// lists no pool.
func (s *Service) OpeningLosses(
	ctx context.Context,
	booksID int64,
) ([]string, []domain.OpeningLoss, money.Currency, error) {
	j, err := s.juris.For(ctx, booksID)
	if err != nil {
		return nil, nil, "", err
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return nil, nil, "", err
	}

	losses, err := s.repo.OpeningLosses(ctx, booksID)
	if err != nil {
		return nil, nil, "", err
	}

	return lossPools(j), losses, base, nil
}

// SaveOpeningLosses replaces the opening losses of the book with losses; an empty list clears
// them. It returns an *OpeningLossError for the first item that breaks a rule.
func (s *Service) SaveOpeningLosses(
	ctx context.Context,
	booksID int64,
	losses []domain.OpeningLoss,
) error {
	j, err := s.juris.For(ctx, booksID)
	if err != nil {
		return err
	}

	if err := checkOpeningLosses(lossPools(j), losses); err != nil {
		return err
	}

	return s.repo.ReplaceOpeningLosses(ctx, booksID, losses)
}

func checkOpeningLosses(pools []string, losses []domain.OpeningLoss) error {
	seen := map[string]bool{}

	for i, l := range losses {
		field, message := "", ""

		switch {
		case !slices.Contains(pools, l.Pool):
			field, message = "pool", "is not a pool of the monthly tax of this region"
		case seen[l.Pool]:
			field, message = "pool", "appears twice"
		case l.Month.Day() != 1:
			field, message = "month", "must be the first day of a month"
		case l.Amount <= 0:
			field, message = "amount", "must be above zero"
		}

		if field != "" {
			return &OpeningLossError{
				Field:   fmt.Sprintf("losses[%d].%s", i, field),
				Message: message,
			}
		}

		seen[l.Pool] = true
	}

	return nil
}

func lossPools(j domain.Jurisdiction) []string {
	if j == nil {
		return nil
	}

	return j.LossPools()
}
