package app

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
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

		out, err := s.pairLine(ctx, p.batch, p.created[i], lines[k])
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
// lines to create. The counterparts are the transactions of rule 2 and the records in review
// of rule 3.
func (s *Service) pairLine(
	ctx context.Context,
	b *domain.Batch,
	rec *domain.ExternalRecord,
	line Line,
) (bool, error) {
	cps, parties, err := s.counterparts(ctx, b.BooksID, rec, line)
	if err != nil {
		return false, err
	}

	reviews, err := s.transferReviews(ctx, b.BooksID, rec, line)
	if err != nil {
		return false, err
	}

	for {
		switch {
		case len(cps)+len(reviews) == 1 && rec.Counterparty == domain.CounterpartyHolder &&
			(len(reviews) == 1 || parties[cps[0].RecordID] == domain.CounterpartyHolder):
			txID, ok, err := s.pairingTransaction(ctx, b, cps, reviews)
			if err != nil {
				return false, err
			}

			if !ok {
				// The record in review changed or the ledger refused its line: the line takes the
				// outcome without it.
				reviews = nil

				continue
			}

			version, err := s.ledger.PairLine(ctx, b.BooksID, txID, rec.AccountID, rec.ID)
			if err == nil {
				rec.State, rec.TransactionID, rec.Decision, rec.Undo = domain.StateMatched, txID, domain.DecisionPaired, domain.Undo{
					Version: version,
				}

				return true, nil
			}

			if !errors.Is(err, ErrNotPairable) {
				return false, err
			}

			reviewTransfer(rec, []Counterpart{{TransactionID: txID}})
		case len(cps)+len(reviews) > 0, rec.Counterparty == domain.CounterpartyHolder:
			reviewTransfer(rec, cps)
		default:
			return false, nil
		}

		return true, nil
	}
}

// pairingTransaction returns the transaction the line pairs with. The record in review of rule 3
// first gets its transaction (A218 rule 2); false when it changed or the ledger refused its line.
func (s *Service) pairingTransaction(
	ctx context.Context,
	b *domain.Batch,
	cps []Counterpart,
	reviews []domain.ExternalRecord,
) (uuid.UUID, bool, error) {
	if len(reviews) == 0 {
		return cps[0].TransactionID, true, nil
	}

	o := reviews[0]

	unlock, err := s.repo.LockAccountImports(ctx, o.AccountID)
	if err != nil {
		return uuid.Nil, false, err
	}
	defer unlock()

	o, err = s.repo.Record(ctx, b.BooksID, o.ID)
	if err != nil {
		return uuid.Nil, false, err
	}

	if o.State != domain.StateNeedsReview || o.ReviewReason != domain.ReviewTransfer {
		return uuid.Nil, false, nil
	}

	line := Line{
		AccountID:    o.AccountID,
		Currency:     money.Currency(b.Currency),
		Date:         o.Date,
		Amount:       o.Amount,
		Description:  truncate(o.Description),
		Unclassified: true,
	}

	ids, err := s.ledger.RecordImported(ctx, b.BooksID, []NewLine{{RecordID: o.ID, Line: line}})
	if errors.Is(err, ErrLineRejected) {
		return uuid.Nil, false, nil
	}

	if err != nil {
		return uuid.Nil, false, err
	}

	o.State, o.TransactionID, o.Candidates, o.SummaryBatchID = domain.StateCreated, ids[0], nil, b.ID

	return ids[0], true, s.repo.ResolveRecord(ctx, o)
}

// transferReviews lists the records in review transfer of other accounts that A216 rule 3 keeps:
// both they and the line carry the counterparty holder.
func (s *Service) transferReviews(
	ctx context.Context,
	booksID int64,
	rec *domain.ExternalRecord,
	line Line,
) ([]domain.ExternalRecord, error) {
	if rec.Counterparty != domain.CounterpartyHolder {
		return nil, nil
	}

	window := time.Duration(domain.PairingWindowDays) * 24 * time.Hour

	reviews, err := s.repo.TransferReviews(
		ctx,
		booksID,
		rec.AccountID,
		-rec.Amount,
		string(line.Currency),
		rec.Date.Add(-window),
		rec.Date.Add(window),
	)
	if err != nil {
		return nil, err
	}

	return slices.DeleteFunc(reviews, func(o domain.ExternalRecord) bool {
		return o.Counterparty != domain.CounterpartyHolder
	}), nil
}

// counterparts lists the counterparts of the line that A216 rule 4 keeps, with the counterparty
// of each one's record.
func (s *Service) counterparts(
	ctx context.Context,
	booksID int64,
	rec *domain.ExternalRecord,
	line Line,
) ([]Counterpart, map[uuid.UUID]string, error) {
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
