package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// HoldingLots is a security account on a date: the cost method a sale of it uses, its holding
// and, under the lot method, the open lots (A234 FL11).
type HoldingLots struct {
	Method              string
	Quantity, CostBasis money.Money
	Lots                []OpenLot
}

// OpenLot is the part of a holding bought on one date.
type OpenLot struct {
	AcquiredOn     time.Time
	Quantity, Cost money.Money
}

// OpenLots returns the cost method, the holding and the open lots of a security account at the
// end of date without the postings of the transaction exclude, if any. The lots are empty under
// the average method.
func (s *Service) OpenLots(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	exclude uuid.UUID,
) (HoldingLots, error) {
	base, err := baseCurrency(ctx, s.repo, booksID)
	if err != nil {
		return HoldingLots{}, err
	}

	security, err := s.repo.Account(ctx, booksID, accountID)
	if err != nil {
		return HoldingLots{}, err
	}

	if !security.HoldsSecurity() {
		return HoldingLots{}, fieldErr("id", "must hold a security", domain.ErrValidation)
	}

	h, err := s.readHolding(ctx, s.repo, booksID, security, base, date, exclude)
	if err != nil {
		return HoldingLots{}, err
	}

	h, err = s.withCostMethod(ctx, s.repo, booksID, security, h, date, exclude)
	if err != nil {
		return HoldingLots{}, err
	}

	out := HoldingLots{Method: h.Method, Quantity: h.Quantity, CostBasis: h.CostBasis}
	if out.Method == "" {
		out.Method = domain.CostAverage
	}

	for _, l := range h.Lots {
		lot, err := s.openLot(ctx, l, security.Instrument, base)
		if err != nil {
			return HoldingLots{}, err
		}

		out.Lots = append(out.Lots, lot)
	}

	return out, nil
}

func (s *Service) openLot(
	ctx context.Context,
	l domain.Lot,
	instrument, base money.Currency,
) (OpenLot, error) {
	quantity, err := s.AmountOf(ctx, l.Quantity, instrument)
	if err != nil {
		return OpenLot{}, err
	}

	cost, err := money.New(l.Cost, base)
	if err != nil {
		return OpenLot{}, err
	}

	return OpenLot{AcquiredOn: l.AcquiredOn, Quantity: quantity, Cost: cost}, nil
}
