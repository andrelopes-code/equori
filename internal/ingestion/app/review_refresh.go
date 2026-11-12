package app

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Reopen returns a discarded record to review with the candidates the ledger holds now, so a
// line discarded before the entry it confirms existed can still confirm it (A140).
func (s *Service) Reopen(
	ctx context.Context,
	booksID int64,
	recordID uuid.UUID,
) (domain.ExternalRecord, domain.Batch, error) {
	found, err := s.repo.Record(ctx, booksID, recordID)
	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}

	unlock, err := s.repo.LockAccountImports(ctx, found.AccountID)
	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}
	defer unlock()

	reopened, err := s.repo.ReopenRecord(ctx, booksID, recordID, found.BatchID)
	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}

	if !reopened {
		return domain.ExternalRecord{}, domain.Batch{}, ErrRecordNotDiscarded
	}

	b, err := s.repo.Batch(ctx, booksID, found.BatchID)
	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}

	rec, err := s.repo.Record(ctx, booksID, recordID)
	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}

	return rec, b, s.refreshCandidates(ctx, &rec, currencyOf(b))
}

// refreshCandidates scores a record in review against the postings of its account that no
// record links now, so a transaction recorded after the import is offered and one linked
// since is not (A140).
// refreshReview prepares a record in review for reading. A record in review group keeps its
// entry as the only candidate and lists the other lines of its group; a group that no longer
// holds lists none. Another record has its candidates scored again.
func (s *Service) refreshReview(
	ctx context.Context,
	rec *domain.ExternalRecord,
	currency money.Currency,
) error {
	if rec.State != domain.StateNeedsReview || rec.ReviewReason != domain.ReviewGroup {
		return s.refreshCandidates(ctx, rec, currency)
	}

	members, err := s.groupOf(ctx, *rec)
	if errors.Is(err, ErrGroupChanged) {
		return nil
	}

	if err != nil {
		return err
	}

	for _, m := range members {
		if m.Record.ID != rec.ID {
			rec.GroupIDs = append(rec.GroupIDs, m.Record.ID)
		}
	}

	return nil
}

func (s *Service) refreshCandidates(
	ctx context.Context,
	rec *domain.ExternalRecord,
	currency money.Currency,
) error {
	if rec.State != domain.StateNeedsReview {
		return nil
	}

	line := Line{
		AccountID:   rec.AccountID,
		Currency:    currency,
		Date:        rec.Date,
		Amount:      rec.Amount,
		Description: truncate(rec.Description),
	}

	if rec.ReviewReason == domain.ReviewTransfer {
		return s.refreshTransferCandidates(ctx, rec, line)
	}

	postings, err := s.ledger.UnlinkedPostings(
		ctx,
		rec.BooksID,
		rec.AccountID,
		rec.Date.AddDate(
			0,
			0,
			-domain.MatchHardLimit,
		),
		rec.Date.AddDate(0, 0, domain.MatchHardLimit),
	)
	if err != nil {
		return err
	}

	assigned, err := s.assign(ctx, rec.BooksID, []scoredLine{{rec: rec, line: line}}, postings)
	if err != nil {
		return err
	}

	rec.Scores = assigned[0].Candidates

	rec.Candidates = make([]uuid.UUID, len(rec.Scores))
	for i, c := range rec.Scores {
		rec.Candidates[i] = c.TransactionID
	}

	return nil
}

// refreshTransferCandidates lists the transactions the line may pair with (A219); rule 2 does not
// score them.
func (s *Service) refreshTransferCandidates(
	ctx context.Context,
	rec *domain.ExternalRecord,
	line Line,
) error {
	cps, _, err := s.counterparts(ctx, rec.BooksID, rec, line)
	if err != nil {
		return err
	}

	rec.Scores, rec.Candidates = nil, nil
	for _, cp := range cps {
		rec.Candidates = append(rec.Candidates, cp.TransactionID)
	}

	return nil
}
