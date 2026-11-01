package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

// groupedLines decides the lines of the batch that zone New puts in a group (A167, A168). It
// returns, by index in p.scoring, the entry each such line waits on.
func (s *Service) groupedLines(
	ctx context.Context,
	p *importPlan,
	assigned []domain.Assignment,
	repeated map[int]bool,
	postings []domain.LedgerPosting,
) (map[int]uuid.UUID, error) {
	if len(p.scoring) == 0 || len(postings) == 0 {
		return nil, nil
	}

	entries := freeEntries(postings, assigned)

	var (
		fresh []domain.ExternalRecord
		index = map[uuid.UUID]int{}
	)

	for i, a := range assigned {
		line := p.scoring[i]
		if a.Zone != domain.ZoneNew || repeated[i] || line.line.TransferTo != nil {
			continue
		}

		fresh = append(fresh, *line.rec)
		index[line.rec.ID] = i
	}

	if len(fresh) == 0 || len(entries) == 0 {
		return nil, nil
	}

	from, to := span(p.scoring)

	created, err := s.repo.CreatedRecords(ctx, p.batch.BooksID, p.batch.AccountID, from, to)
	if err != nil {
		return nil, err
	}

	lines, err := s.groupLines(ctx, p.batch.BooksID, fresh, created)
	if err != nil {
		return nil, err
	}

	out := map[int]uuid.UUID{}

	for _, m := range domain.FindGroups(entries, lines) {
		for _, id := range m.RecordIDs {
			if i, ok := index[id]; ok {
				out[i] = m.TransactionID
			}
		}
	}

	return out, nil
}

// groupLines turns records into the lines FindGroups takes: new for the records of the batch or
// in review, not new for the created ones that the ledger says a group may take over.
func (s *Service) groupLines(
	ctx context.Context,
	booksID int64,
	fresh, created []domain.ExternalRecord,
) ([]domain.GroupLine, error) {
	lines := make([]domain.GroupLine, 0, len(fresh)+len(created))
	for _, r := range fresh {
		lines = append(lines, domain.GroupLine{RecordID: r.ID, Date: r.Date, Amount: r.Amount, New: true})
	}

	if len(created) == 0 {
		return lines, nil
	}

	txIDs := make([]uuid.UUID, len(created))
	for i, r := range created {
		txIDs[i] = r.TransactionID
	}

	ok, err := s.ledger.GroupableTransactions(ctx, booksID, txIDs)
	if err != nil {
		return nil, err
	}

	groupable := make(map[uuid.UUID]bool, len(ok))
	for _, id := range ok {
		groupable[id] = true
	}

	for _, r := range created {
		if groupable[r.TransactionID] {
			lines = append(lines, domain.GroupLine{RecordID: r.ID, Date: r.Date, Amount: r.Amount})
		}
	}

	return lines, nil
}

// freeEntries drops the postings that a zone Link of the same batch takes.
func freeEntries(postings []domain.LedgerPosting, assigned []domain.Assignment) []domain.LedgerPosting {
	taken := map[uuid.UUID]bool{}

	for _, a := range assigned {
		if a.Zone == domain.ZoneLink {
			taken[a.TransactionID] = true
		}
	}

	var out []domain.LedgerPosting

	for _, posting := range postings {
		if !taken[posting.TransactionID] {
			out = append(out, posting)
		}
	}

	return out
}

// span is the window of the batch's lines widened by the hard limit of matching.
func span(lines []scoredLine) (from, to time.Time) {
	for _, l := range lines {
		if from.IsZero() || l.rec.Date.Before(from) {
			from = l.rec.Date
		}

		if l.rec.Date.After(to) {
			to = l.rec.Date
		}
	}

	return from.AddDate(0, 0, -domain.MatchHardLimit), to.AddDate(0, 0, domain.MatchHardLimit)
}
