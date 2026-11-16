package app

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// estimate sets the estimated tax and net of p from its market value in the base currency; a
// valuation in another currency has no estimate (FC21).
func (s *Service) estimate(
	ctx context.Context,
	booksID int64,
	p *Position,
	value money.Money,
	date time.Time,
) error {
	tax, ok, err := s.ledger.EstimateWithholding(
		ctx, booksID, p.AccountID, date, p.Quantity.Amount(), value.Amount(),
	)
	if err != nil || !ok {
		return err
	}

	net, err := value.Sub(tax)
	if err != nil {
		return err
	}

	p.EstimatedTax, p.EstimatedNet = &tax, &net

	return nil
}
