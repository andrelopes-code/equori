package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// ResultTotals returns the results of the sales and the net income of every security account of
// the book up to the end of date, one amount per currency ordered by code (amendment A262 TR2).
func (s *Service) ResultTotals(
	ctx context.Context,
	booksID int64,
	date time.Time,
) (realized, income []money.Money, err error) {
	results, err := s.accountResults(ctx, booksID, date)
	if err != nil {
		return nil, nil, err
	}

	r, i := domain.ResultTotals(results)
	if realized, err = moneyOf(r); err != nil {
		return nil, nil, err
	}

	if income, err = moneyOf(i); err != nil {
		return nil, nil, err
	}

	return realized, income, nil
}

// accountResults reads every result and income event dated up to the end of date.
func (s *Service) accountResults(
	ctx context.Context,
	booksID int64,
	date time.Time,
) (map[uuid.UUID]domain.AccountResult, error) {
	end := date.AddDate(0, 0, 1)

	results, err := s.repo.RealizedResults(ctx, booksID, time.Time{}, end)
	if err != nil {
		return nil, err
	}

	incomes, err := s.repo.IncomeEvents(ctx, booksID, time.Time{}, end)
	if err != nil {
		return nil, err
	}

	return domain.AccountResults(results, incomes), nil
}

func resultParts(a domain.AccountResult) (realized, income *money.Money, err error) {
	if realized, err = moneyPtr(a.Realized); err != nil {
		return nil, nil, err
	}

	if income, err = moneyPtr(a.Income); err != nil {
		return nil, nil, err
	}

	return realized, income, nil
}

func moneyPtr(a *domain.Amount) (*money.Money, error) {
	if a == nil {
		return nil, nil
	}

	m, err := money.New(a.Units, a.Currency)
	if err != nil {
		return nil, err
	}

	return &m, nil
}

func moneyOf(amounts []domain.Amount) ([]money.Money, error) {
	out := make([]money.Money, len(amounts))
	for i, a := range amounts {
		m, err := money.New(a.Units, a.Currency)
		if err != nil {
			return nil, err
		}

		out[i] = m
	}

	return out, nil
}
