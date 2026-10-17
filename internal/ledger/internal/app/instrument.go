package app

import (
	"context"
	"fmt"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// AmountOf builds an amount of code; a security takes its scale from Market data.
func AmountOf(ctx context.Context, ins Instruments, units int64, code money.Currency) (money.Money, error) {
	if _, err := money.ParseCurrency(string(code)); err == nil {
		return money.New(units, code)
	}
	if ins == nil {
		return money.Money{}, fmt.Errorf("amount of %s: %w", code, ErrUnknownInstrument)
	}
	in, err := ins.Instrument(ctx, code)
	if err != nil {
		return money.Money{}, fmt.Errorf("amount of %s: %w", code, err)
	}
	return money.NewOf(units, code, in.Scale)
}

// AmountOf is AmountOf with the service's instruments, for the HTTP adapter.
func (s *Service) AmountOf(ctx context.Context, units int64, code money.Currency) (money.Money, error) {
	return AmountOf(ctx, s.ins, units, code)
}

// describeInstrument sets the quote currency of a security account (P8 amendment A63).
func (s *Service) describeInstrument(ctx context.Context, a *domain.Account) error {
	if !a.HoldsSecurity() {
		return nil
	}
	in, err := s.ins.Instrument(ctx, a.Instrument)
	if err != nil {
		return &domain.FieldError{Field: "currency", Message: "is not a known instrument", Err: domain.ErrValidation}
	}
	a.QuoteCurrency = in.QuoteCurrency
	return nil
}
