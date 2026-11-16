package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
)

// withCostMethod gives h the cost method of its instrument in the book's region and, under
// fixed income lots, the open lots on date. A holding whose lots disagree with its quantity
// is a defect of the derivation and fails the operation (FL8).
func (s *Service) withCostMethod(
	ctx context.Context,
	r Repository,
	booksID int64,
	security domain.Account,
	h domain.Holding,
	date time.Time,
	exclude uuid.UUID,
) (domain.Holding, error) {
	profile, err := s.profiles.Profile(ctx, booksID)
	if err != nil {
		return domain.Holding{}, fmt.Errorf("read profile: %w", err)
	}

	in, err := s.ins.Instrument(ctx, security.Instrument)
	if err != nil {
		return domain.Holding{}, err
	}

	if s.defaults.CostMethod(profile.Region, in.Type) != domain.CostFIFO {
		return h, nil
	}

	lots, err := s.openLots(ctx, r, booksID, security.ID, date, uuid.Nil, exclude)
	if err != nil {
		return domain.Holding{}, fmt.Errorf("open lots of account %s: %w", security.ID, err)
	}

	if openQuantity(lots) != h.Quantity.Amount() {
		return domain.Holding{}, fmt.Errorf(
			"open lots of account %s hold %d units, the holding %d: %w",
			security.ID, openQuantity(lots), h.Quantity.Amount(), domain.ErrLotsInconsistent,
		)
	}

	h.Method, h.Lots = domain.CostFIFO, lots

	return h, nil
}

// openLots replays the postings of an account up to date; a transfer in reads the open lots of
// its source just before the transfer.
func (s *Service) openLots(
	ctx context.Context,
	r Repository,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	beforeTx, exclude uuid.UUID,
) ([]domain.Lot, error) {
	postings, err := r.OpenLotPostings(ctx, booksID, accountID, date, beforeTx, exclude)
	if err != nil {
		return nil, err
	}

	return domain.ReplayLots(postings, func(p domain.LotPosting) ([]domain.Lot, error) {
		return s.openLots(ctx, r, booksID, p.Source, p.Date, p.TransactionID, exclude)
	})
}

func openQuantity(lots []domain.Lot) (units int64) {
	for _, l := range lots {
		units += l.Quantity
	}

	return units
}
