package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

// reserveTransfers resolves the reserve a bank line moves money into or out of against every
// reserved balance of the connection (A212).
func (s *Service) reserveTransfers(
	c domain.Connection,
	ext domain.ExternalAccount,
) func(domain.NormalizedRecord) domain.ReserveOutcome {
	if ext.Subtype == domain.SubtypeReservedBalance {
		return nil
	}

	var reserves []domain.ExternalAccount
	for _, x := range c.Accounts {
		if x.Subtype == domain.SubtypeReservedBalance {
			reserves = append(reserves, x)
		}
	}

	return func(r domain.NormalizedRecord) domain.ReserveOutcome {
		return domain.ResolveReserve(r, reserves)
	}
}

// reidentify gives the stored record of a line the line's new external id when the aggregator
// returns the line under another id and the same institution line id (A143); the claim of
// the line then finds that record.
func (s *Service) reidentify(
	ctx context.Context,
	batch *domain.Batch,
	read domain.AccountRead,
) error {
	var externalIDs, institutionIDs []string

	for _, r := range read.Records {
		if r.InstitutionID != "" {
			externalIDs = append(externalIDs, r.ExternalID)
			institutionIDs = append(institutionIDs, r.InstitutionID)
		}
	}

	if len(institutionIDs) == 0 {
		return nil
	}

	stored, err := s.repo.RecordsByLineIDs(
		ctx,
		batch.BooksID,
		batch.AccountID,
		externalIDs,
		institutionIDs,
	)
	if err != nil {
		return err
	}

	for i, rec := range domain.Reidentifications(read.Records, read.Seen, stored) {
		line := read.Records[i]
		key := domain.DedupKey(batch.AccountID, domain.SourceAggregator, line, 0)

		if err := s.repo.Reidentify(
			ctx,
			batch.BooksID,
			batch.ID,
			rec.ID,
			line.ExternalID,
			key,
			line.Raw,
		); err != nil {
			return err
		}

		batch.Counts.ReIdentified++
	}

	return nil
}

// withdraw marks withdrawn the account's aggregator records dated in [from, to], both days
// included, that the aggregator no longer returns, and releases their postings (A38). The
// read asks one day more on each side, so the aggregator's own calendar day cannot hide a
// line of the window (A145). A read that returns no line while the window holds records
// withdraws nothing and marks the batch (A146).
func (s *Service) withdraw(
	ctx context.Context,
	batch *domain.Batch,
	seen []string,
	from, to time.Time,
) error {
	returned := make(map[string]bool, len(seen))
	for _, id := range seen {
		returned[id] = true
	}

	stored, err := s.repo.SyncedRecords(ctx, batch.BooksID, batch.AccountID, from, to)
	if err != nil {
		return err
	}

	if len(seen) == 0 && len(stored) > 0 {
		batch.ReadEmpty = true

		return nil
	}

	var gone []uuid.UUID
	for _, rec := range stored {
		if returned[rec.ExternalID] || rec.Kept {
			continue
		}

		if rec.TransactionID != uuid.Nil {
			if err := s.ledger.ReleaseRecord(ctx, batch.BooksID, rec.ID); err != nil {
				return err
			}
		}

		gone = append(gone, rec.ID)
	}

	batch.Counts.Withdrawn = len(gone)

	return s.repo.WithdrawRecords(ctx, batch.BooksID, batch.ID, gone)
}
