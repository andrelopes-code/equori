package app

import (
	"context"
	"errors"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

// pairLines pairs the new lines of a sync with a transaction of another account of the book
// (A216 rule 2, A218). A line that pairs, or that waits in review transfer, leaves p.creates.
func (s *Service) pairLines(ctx context.Context, p *importPlan) error {
	if !p.sync {
		return nil
	}

	var (
		at    []int
		lines []Line
	)

	for i, c := range p.creates {
		if !c.Line.Pending && c.Line.TransferTo == nil {
			at, lines = append(at, i), append(lines, c.Line)
		}
	}

	if len(at) == 0 {
		return nil
	}

	decided, err := s.ledger.RuleDecided(ctx, p.batch.BooksID, lines)
	if err != nil {
		return err
	}

	var left []int

	for k, i := range at {
		if decided[k] {
			continue
		}

		out, err := s.pairLine(ctx, p.batch.BooksID, p.created[i], lines[k])
		if err != nil {
			return err
		}

		if out {
			left = append(left, i)
		}
	}

	for _, i := range slices.Backward(left) {
		p.creates, p.created = slices.Delete(p.creates, i, i+1), slices.Delete(p.created, i, i+1)
	}

	return nil
}

// pairLine applies the outcomes of A218 to one line; it reports whether the line left the
// lines to create.
func (s *Service) pairLine(ctx context.Context, booksID int64, rec *domain.ExternalRecord, line Line) (bool, error) {
	cps, parties, err := s.counterparts(ctx, booksID, rec, line)
	if err != nil {
		return false, err
	}

	switch {
	case len(cps) == 1 && rec.Counterparty == domain.CounterpartyHolder && parties[cps[0].RecordID] == domain.CounterpartyHolder:
		version, err := s.ledger.PairLine(ctx, booksID, cps[0].TransactionID, rec.AccountID, rec.ID)
		if err == nil {
			rec.State, rec.TransactionID, rec.Decision, rec.Undo = domain.StateMatched, cps[0].TransactionID, domain.DecisionPaired, domain.Undo{Version: version}

			return true, nil
		}

		if !errors.Is(err, ErrNotPairable) {
			return false, err
		}

		reviewTransfer(rec, cps)
	case len(cps) > 0, rec.Counterparty == domain.CounterpartyHolder:
		reviewTransfer(rec, cps)
	default:
		return false, nil
	}

	return true, nil
}

// counterparts lists the counterparts of the line that A216 rule 4 keeps, with the counterparty
// of each one's record.
func (s *Service) counterparts(ctx context.Context, booksID int64, rec *domain.ExternalRecord, line Line) ([]Counterpart, map[uuid.UUID]string, error) {
	cps, err := s.ledger.Counterparts(ctx, booksID, line)
	if err != nil || len(cps) == 0 {
		return nil, nil, err
	}

	ids := make([]uuid.UUID, len(cps))
	for i, cp := range cps {
		ids[i] = cp.RecordID
	}

	parties, err := s.repo.RecordCounterparties(ctx, booksID, ids)
	if err != nil {
		return nil, nil, err
	}

	cps = slices.DeleteFunc(cps, func(cp Counterpart) bool {
		return !eligible(rec.Counterparty, parties[cp.RecordID], line, cp)
	})

	return cps, parties, nil
}

// eligible applies A216 rule 4: a third party on either side excludes the counterpart, except
// for a card payment.
func eligible(line, counterpart string, l Line, cp Counterpart) bool {
	if l.Kind == domain.KindPayment || cp.CardPayment {
		return true
	}

	return line != domain.CounterpartyThirdParty && counterpart != domain.CounterpartyThirdParty
}

func reviewTransfer(rec *domain.ExternalRecord, cps []Counterpart) {
	rec.State, rec.ReviewReason = domain.StateNeedsReview, domain.ReviewTransfer

	rec.Candidates = nil
	for _, cp := range cps {
		rec.Candidates = append(rec.Candidates, cp.TransactionID)
	}
}
