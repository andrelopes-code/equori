package app

import (
	"context"
	"errors"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// BaseValue returns the value of an amount in the book's base currency at a date, from the
// stored prices (M5). An amount in the base currency is returned unchanged. Without a price
// the error wraps ErrPriceMissing on the field amount (M6).
func (s *Service) BaseValue(
	ctx context.Context,
	booksID int64,
	amount money.Money,
	date time.Time,
) (money.Money, error) {
	settings, err := s.repo.Settings(ctx, booksID)
	if err != nil {
		return money.Money{}, err
	}

	if amount.Currency() == settings.BaseCurrency {
		return amount, nil
	}

	c, err := s.prices.Convert(ctx, amount, settings.BaseCurrency, date)
	if errors.Is(err, ErrPriceMissing) {
		return money.Money{}, fieldErr("amount", err.Error(), ErrPriceMissing)
	}

	if err != nil {
		return money.Money{}, err
	}

	return c.Value, nil
}
