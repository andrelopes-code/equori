package app

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const balancePriceDecimals = 12

// balancePrice stores the unit price the balance of a linked investment implies: balance over
// the units the book holds at the balance date. It stores nothing while a movement is pending.
func (s *Service) balancePrice(
	ctx context.Context,
	booksID int64,
	inv domain.StoredInvestment,
	source string,
) error {
	if s.prices == nil || inv.Instrument == nil || inv.AccountID == nil {
		return nil
	}

	for _, m := range inv.Movements {
		if m.State == domain.MovementPending {
			return nil
		}
	}

	held, err := s.ledger.HeldUnits(ctx, booksID, *inv.AccountID, inv.Source.BalanceDate)
	if err != nil || held.Amount() <= 0 {
		return err
	}

	price, err := money.Quotient(inv.Source.Balance, held, balancePriceDecimals)
	if err != nil || price.Mantissa() <= 0 {
		return err
	}

	return s.prices.RecordBalancePrice(
		ctx,
		booksID,
		money.Currency(*inv.Instrument),
		inv.Source.Balance.Currency(),
		inv.Source.BalanceDate,
		price,
		source,
	)
}

// confirmedPrice is balancePrice for a review: the source is the connection's aggregator.
func (s *Service) confirmedPrice(
	ctx context.Context,
	booksID int64,
	inv domain.StoredInvestment,
) error {
	c, err := s.repo.Connection(ctx, booksID, inv.ConnectionID)
	if err != nil {
		return err
	}

	i, err := s.repo.Integration(ctx, booksID, c.IntegrationID)
	if err != nil {
		return err
	}

	return s.balancePrice(ctx, booksID, inv, string(i.Aggregator))
}
