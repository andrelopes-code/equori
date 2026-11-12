package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

// unlinked reads, in one query, the postings the new lines of the file may confirm.
func (s *Service) unlinked(
	ctx context.Context,
	batch *domain.Batch,
	claimed []Claim,
) ([]domain.LedgerPosting, error) {
	var from, to time.Time
	for _, c := range claimed {
		if c.Existed {
			continue
		}

		if from.IsZero() || c.Record.Date.Before(from) {
			from = c.Record.Date
		}

		if c.Record.Date.After(to) {
			to = c.Record.Date
		}
	}

	if from.IsZero() {
		return nil, nil
	}

	return s.ledger.UnlinkedPostings(
		ctx,
		batch.BooksID,
		batch.AccountID,
		from.AddDate(0, 0, -domain.MatchHardLimit),
		to.AddDate(0, 0, domain.MatchHardLimit),
	)
}

// repeats returns the lines matching would create that repeat a payment the account records
// (A142). The recorded lines are the account's aggregator records that hold a transaction and
// the lines this import links. Only card lines carry the payment kind, so a bank account
// repeats nothing.
func (s *Service) repeats(
	ctx context.Context,
	batch *domain.Batch,
	lines []scoredLine,
	assigned []domain.Assignment,
) (map[int]bool, error) {
	scan := scanRepeats(lines, assigned)
	fresh, recorded, at, from, to := scan.fresh, scan.recorded, scan.at, scan.from, scan.to

	if len(fresh) == 0 {
		return nil, nil
	}

	stored, err := s.repo.SyncedRecords(
		ctx,
		batch.BooksID,
		batch.AccountID,
		from.AddDate(0, 0, -domain.RepeatDays),
		to.AddDate(0, 0, domain.RepeatDays),
	)
	if err != nil {
		return nil, err
	}

	for _, rec := range stored {
		if rec.TransactionID != uuid.Nil {
			recorded = append(recorded, domain.RepeatLine{
				ExternalID: rec.ExternalID,
				Date:       rec.Date,
				Amount:     rec.Amount,
				Kind:       rec.LineKind,
			})
		}
	}

	out := map[int]bool{}
	for k := range domain.Repeats(fresh, recorded) {
		out[at[k]] = true
	}

	return out, nil
}

type repeatScan struct {
	fresh, recorded []domain.RepeatLine
	at              []int
	from, to        time.Time
}

func scanRepeats(lines []scoredLine, assigned []domain.Assignment) repeatScan {
	var (
		fresh, recorded []domain.RepeatLine
		at              []int
		from, to        time.Time
	)
	for i, a := range assigned {
		l := domain.RepeatLine{
			ExternalID: lines[i].rec.ExternalID,
			Date:       lines[i].line.Date,
			Amount:     lines[i].line.Amount,
			Kind:       lines[i].line.Kind,
		}
		switch {
		case a.Zone == domain.ZoneLink:
			recorded = append(recorded, l)
		case a.Zone == domain.ZoneNew && l.Amount > 0:
			fresh, at = append(fresh, l), append(at, i)
			if from.IsZero() || l.Date.Before(from) {
				from = l.Date
			}

			if l.Date.After(to) {
				to = l.Date
			}
		}
	}

	return repeatScan{fresh: fresh, recorded: recorded, at: at, from: from, to: to}
}

// scoredLine is a line that matching decides: link, review or create.
type scoredLine struct {
	rec           *domain.ExternalRecord
	line          Line
	reserveReview bool
}

// assign decides the lines by score (A98–A100); the payees of the lines are asked of
// classification only when the account has postings to compare.
func (s *Service) assign(
	ctx context.Context,
	booksID int64,
	lines []scoredLine,
	postings []domain.LedgerPosting,
) ([]domain.Assignment, error) {
	if len(lines) == 0 {
		return nil, nil
	}

	if len(postings) == 0 {
		out := make([]domain.Assignment, len(lines))
		for i := range out {
			out[i].Zone = domain.ZoneNew
		}

		return out, nil
	}

	plain := make([]Line, len(lines))
	for i, l := range lines {
		plain[i] = l.line
	}

	payees, err := s.ledger.LinePayees(ctx, booksID, plain)
	if err != nil {
		return nil, err
	}

	compared := make([]domain.MatchLine, len(lines))
	for i, l := range lines {
		compared[i] = domain.MatchLine{
			Date:        l.rec.Date,
			Amount:      l.rec.Amount,
			PayeeID:     payees[i],
			Description: l.rec.Description,
		}
	}

	return domain.Assign(compared, postings), nil
}

// resume completes a record whose transaction a previous import committed in the ledger
// before it stopped (P4 amendments A11, A12); it reports whether the record is done.
func (s *Service) resume(ctx context.Context, rec *domain.ExternalRecord) (bool, error) {
	txID, imported, err := s.ledger.LinkedTransaction(ctx, rec.BooksID, rec.ID)
	if errors.Is(err, ErrNotFound) {
		return false, nil
	}

	if err != nil {
		return false, err
	}

	rec.State, rec.TransactionID = domain.StateMatched, txID
	if imported {
		rec.State = domain.StateCreated
	}

	return true, nil
}
