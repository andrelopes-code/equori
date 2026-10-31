package app

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

// ErrNoDecision: the record carries no automatic decision to undo (A148).
var ErrNoDecision = errors.New("the record has no decision to undo")

// UndoDecision reverts the record's last automatic decision and returns the record with its
// batch (P12 A148).
func (s *Service) UndoDecision(ctx context.Context, booksID int64, recordID uuid.UUID) (domain.ExternalRecord, domain.Batch, error) {
	found, err := s.repo.Record(ctx, booksID, recordID)
	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}

	unlock, err := s.repo.LockAccountImports(ctx, found.AccountID)
	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}
	defer unlock()

	rec, err := s.repo.Record(ctx, booksID, recordID)
	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}

	if rec.Decision == "" {
		return domain.ExternalRecord{}, domain.Batch{}, ErrNoDecision
	}

	b, err := s.repo.Batch(ctx, booksID, rec.BatchID)
	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}

	decided, left := rec.Decision, rec.State

	switch decided {
	case domain.DecisionLinked:
		err = s.undoLinked(ctx, &rec, b)
	case domain.DecisionWithdrawn:
		err = s.undoWithdrawn(ctx, &rec, b)
	default:
		err = ErrNoDecision
	}

	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}

	rec.Decision, rec.Undo = "", domain.Undo{}

	if err := s.repo.SaveUndo(ctx, rec, decided, left, nil); err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}

	b, err = s.repo.Batch(ctx, booksID, rec.BatchID)

	return rec, b, err
}

// undoLinked releases the posting and returns the record to review as a probable match.
func (s *Service) undoLinked(ctx context.Context, rec *domain.ExternalRecord, b domain.Batch) error {
	if err := s.ledger.ReleaseRecord(ctx, rec.BooksID, rec.ID); err != nil {
		return err
	}

	rec.State, rec.TransactionID, rec.ReviewReason = domain.StateNeedsReview, uuid.Nil, domain.ReviewProbable

	return s.refreshCandidates(ctx, rec, currencyOf(b))
}

// undoWithdrawn links the record to the posting it had and keeps it from later withdrawals.
func (s *Service) undoWithdrawn(ctx context.Context, rec *domain.ExternalRecord, b domain.Batch) error {
	u := rec.Undo

	if u.TransactionID != uuid.Nil {
		match := Match{RecordID: rec.ID, TransactionID: u.TransactionID, AccountID: rec.AccountID, Pending: rec.ExternalStatus == domain.ExternalPending}

		conflicts, err := s.ledger.ClearMatched(ctx, rec.BooksID, []Match{match})
		if err != nil {
			return err
		}

		if len(conflicts) > 0 {
			return ErrAlreadyMatched
		}
	}

	rec.State, rec.TransactionID, rec.ReviewReason, rec.Kept = u.State, u.TransactionID, u.ReviewReason, true
	rec.Candidates, rec.Scores = nil, nil

	return s.refreshCandidates(ctx, rec, currencyOf(b))
}
