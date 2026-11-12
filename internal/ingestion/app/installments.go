package app

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

// installments places aggregator installment lines in their purchases, in batch order (P6
// amendment A40): the first line of a purchase creates its ledger plan, the others confirm
// their installments. A line the ledger refuses waits for review.
func (s *Service) installments(
	ctx context.Context,
	batch *domain.Batch,
	lines []InstallmentLine,
	records []*domain.ExternalRecord,
) error {
	if len(lines) == 0 {
		return nil
	}

	byID := recordsByID(records)
	keys := planKeys(batch.AccountID, lines)

	plans, err := s.repo.InstallmentPlans(ctx, batch.BooksID, keys)
	if err != nil {
		return err
	}

	for i, l := range lines {
		rec := byID[l.RecordID]
		var txID uuid.UUID

		planID, known := plans[string(keys[i])]
		txID, planID, err = s.placeInstallment(ctx, batch.BooksID, l, planID, known)

		switch {
		case errors.Is(err, ErrInstallmentRefused):
			rec.State = domain.StateNeedsReview
			continue
		case err != nil:
			return err
		}

		rec.State, rec.TransactionID = domain.StateMatched, txID
		if !known && planID != uuid.Nil {
			rec.State, plans[string(keys[i])] = domain.StateCreated, planID
			if err := s.repo.SaveInstallmentPlan(
				ctx,
				batch.BooksID,
				batch.AccountID,
				keys[i],
				planID,
			); err != nil {
				return err
			}
		}
	}

	return nil
}

func recordsByID(records []*domain.ExternalRecord) map[uuid.UUID]*domain.ExternalRecord {
	byID := make(map[uuid.UUID]*domain.ExternalRecord, len(records))
	for _, rec := range records {
		byID[rec.ID] = rec
	}

	return byID
}

func planKeys(accountID uuid.UUID, lines []InstallmentLine) [][]byte {
	keys := make([][]byte, len(lines))
	for i, l := range lines {
		keys[i] = domain.PlanKey(accountID, l.Installment, l.Line.Description)
	}

	return keys
}

func (s *Service) placeInstallment(
	ctx context.Context,
	booksID int64,
	l InstallmentLine,
	planID uuid.UUID,
	known bool,
) (uuid.UUID, uuid.UUID, error) {
	if known {
		txID, err := s.ledger.LinkInstallment(
			ctx,
			booksID,
			l.RecordID,
			planID,
			l.Installment.Number,
			l.Line,
		)

		return txID, planID, err
	}

	return s.ledger.RecordInstallment(ctx, booksID, l)
}
