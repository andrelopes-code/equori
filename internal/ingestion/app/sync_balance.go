package app

import (
	"context"
	"errors"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

func (s *Service) assertAccountBalance(
	ctx context.Context,
	c domain.Connection,
	ext *domain.ExternalAccount,
	batch *domain.Batch,
	target domain.ImportTarget,
	b *domain.Balance,
) error {
	// The ledger decides an open assertion of this balance again on every sync (A77).
	if ext.Balance == nil || *ext.Balance != *b {
		batch.Balance = domain.FileBalance{
			Status: domain.BalanceRecorded,
			Date:   &b.Date,
			Amount: b.Amount,
		}
	}

	assert := s.ledger.AssertSyncedBalance
	if ext.Subtype == domain.SubtypeReservedBalance {
		open, err := s.repo.OpenReserveReviews(ctx, c.BooksID, c.ID)
		if err != nil {
			return err
		}

		// A213: while a line may be this reserve's movement, its difference is not yield.
		if open == 0 {
			assert = s.ledger.AssertSyncedReserve
		}
	}

	err := assert(ctx, c.BooksID, *ext.AccountID, *b, target.Currency)
	switch {
	case errors.Is(err, ErrBalanceRejected):
		if batch.Balance.Status == domain.BalanceRecorded {
			batch.Balance.Status, batch.Balance.Reason = domain.BalanceSkipped, err.Error()
		}
	case err != nil:
		return err
	}

	ext.Balance = b

	return nil
}

func reserveRank(ext domain.ExternalAccount) int {
	if ext.Subtype == domain.SubtypeReservedBalance {
		return 1
	}

	return 0
}

func createdSince(ext domain.ExternalAccount) *time.Time {
	var createdFrom *time.Time

	if ext.LastReadAt != nil {
		since := ext.LastReadAt.Add(-domain.CreatedMargin)
		createdFrom = &since
	}

	return createdFrom
}
