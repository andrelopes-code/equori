package app

import (
	"context"
	"errors"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

var ErrRecordResolved = errors.New("the record does not need review")

type RecordKey struct {
	ID uuid.UUID `json:"ri"`
}

const (
	ActionMatch   = "match"
	ActionCreate  = "create"
	ActionDiscard = "discard"
)

// Records lists a batch's records in file order; state filters them when not empty.
func (s *Service) Records(ctx context.Context, userID int64, batchID uuid.UUID, state domain.RecordState, p page.Request[RecordKey]) ([]domain.ExternalRecord, *RecordKey, domain.Batch, error) {
	b, err := s.repo.Batch(ctx, userID, batchID)
	if err != nil {
		return nil, nil, domain.Batch{}, err
	}
	recs, next, err := s.repo.Records(ctx, userID, batchID, state, p)
	return recs, next, b, err
}

// Resolve settles a record that needs review with the owner's choice (chapter 4, 4.3.3,
// ResolveMatch) and moves it between the batch counts.
// Record returns one of the user's external records.
func (s *Service) Record(ctx context.Context, userID int64, id uuid.UUID) (domain.ExternalRecord, error) {
	return s.repo.Record(ctx, userID, id)
}

func (s *Service) Resolve(ctx context.Context, userID int64, recordID uuid.UUID, action string, txID uuid.UUID) (domain.ExternalRecord, domain.Batch, error) {
	if action != ActionMatch && action != ActionCreate && action != ActionDiscard {
		return domain.ExternalRecord{}, domain.Batch{}, &domain.FieldError{Field: "action", Message: "must be match, create or discard"}
	}
	found, err := s.repo.Record(ctx, userID, recordID)
	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}
	unlock, err := s.repo.LockAccountImports(ctx, found.AccountID)
	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}
	defer unlock()
	rec, err := s.repo.Record(ctx, userID, recordID)
	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}
	if rec.State != domain.StateNeedsReview {
		return domain.ExternalRecord{}, domain.Batch{}, ErrRecordResolved
	}
	b, err := s.repo.Batch(ctx, userID, rec.BatchID)
	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}
	switch action {
	case ActionMatch:
		if !slices.Contains(rec.Candidates, txID) {
			return domain.ExternalRecord{}, domain.Batch{}, &domain.FieldError{Field: "transaction_id", Message: "must be one of the record's candidates"}
		}
		// A101: the institution's amount and date win; the owner's classification stays.
		if err := s.ledger.ConfirmLine(ctx, userID, txID, rec.AccountID, rec.Amount, rec.Date); err != nil {
			return domain.ExternalRecord{}, domain.Batch{}, err
		}
		conflicts, err := s.ledger.ClearMatched(ctx, userID, []Match{{RecordID: rec.ID, TransactionID: txID, AccountID: rec.AccountID}})
		if err != nil {
			return domain.ExternalRecord{}, domain.Batch{}, err
		}
		if len(conflicts) > 0 {
			return domain.ExternalRecord{}, domain.Batch{}, ErrAlreadyMatched
		}
		rec.State, rec.TransactionID = domain.StateMatched, txID
	case ActionCreate:
		line := Line{AccountID: rec.AccountID, Currency: currencyOf(b), Date: rec.Date, Amount: rec.Amount, Description: truncate(rec.Description)}
		ids, err := s.ledger.RecordImported(ctx, userID, []NewLine{{RecordID: rec.ID, Line: line}})
		if errors.Is(err, ErrLineRejected) {
			return domain.ExternalRecord{}, domain.Batch{}, &domain.FieldError{Field: "action", Message: err.Error()}
		}
		if err != nil {
			return domain.ExternalRecord{}, domain.Batch{}, err
		}
		rec.State, rec.TransactionID = domain.StateCreated, ids[0]
	case ActionDiscard:
		rec.State = domain.StateDiscarded
	}
	rec.Candidates = nil
	if err := s.repo.ResolveRecord(ctx, rec); err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}
	return rec, b, nil
}

// Unconfirmed lists the account's entries that no institution line confirmed: dated within its
// feed and more than MatchHardLimit days before the feed's end, oldest first (A103).
func (s *Service) Unconfirmed(ctx context.Context, userID int64, accountID uuid.UUID) ([]domain.LedgerPosting, money.Currency, error) {
	target, err := s.ledger.ImportTarget(ctx, userID, accountID)
	if err != nil {
		return nil, "", err
	}
	feed, err := s.repo.AccountFeed(ctx, userID, accountID)
	if err != nil || feed.From == nil || feed.To == nil {
		return nil, target.Currency, err
	}
	to := feed.To.AddDate(0, 0, -domain.MatchHardLimit-1)
	if to.Before(*feed.From) {
		return nil, target.Currency, nil
	}
	ps, err := s.ledger.UnlinkedPostings(ctx, userID, accountID, *feed.From, to)
	return ps, target.Currency, err
}
