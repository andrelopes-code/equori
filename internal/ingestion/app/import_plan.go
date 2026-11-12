package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// importPlan is the state of one importRecords call: the lines, their claimed records and the
// groups the lines fall into.
type importPlan struct {
	batch    *domain.Batch
	currency money.Currency
	sync     bool
	lines    []domain.NormalizedRecord
	reserve  func(domain.NormalizedRecord) domain.ReserveOutcome
	claimed  []Claim

	pending []*domain.ExternalRecord
	updated []domain.ExternalRecord
	creates []NewLine
	created []*domain.ExternalRecord
	matches []Match
	matched []*domain.ExternalRecord
	scoring []scoredLine
	parts   []InstallmentLine
	retried []*domain.ExternalRecord
	again   []InstallmentLine
}

// importRecords deduplicates, matches and creates the lines of one batch with a constant
// number of ledger commits, so that a 1,000-line file stays within N07. A record that a
// previous import left received is processed again (P4 amendment A12). In a sync, a stored
// line the aggregator changed is updated (P6 A36), a withdrawn line returned again is
// processed again (A38), and a line the ledger refuses waits for review instead of failing
// the batch. reserve, when set, resolves the reserved balance a new line moves money to (A212).
func (s *Service) importRecords(
	ctx context.Context,
	batch *domain.Batch,
	currency money.Currency,
	lines []domain.NormalizedRecord,
	reserve func(domain.NormalizedRecord) domain.ReserveOutcome,
) error {
	p := &importPlan{
		batch:    batch,
		currency: currency,
		sync:     batch.Source == domain.SourceAggregator,
		lines:    lines,
		reserve:  reserve,
	}

	if err := s.claimLines(ctx, p); err != nil {
		return err
	}

	postings, err := s.unlinked(ctx, batch, p.claimed)
	if err != nil {
		return err
	}

	if err := s.classifyLines(ctx, p); err != nil {
		return err
	}

	assigned, err := s.assign(ctx, batch.BooksID, p.scoring, postings)
	if err != nil {
		return err
	}

	repeated, err := s.repeatedLines(ctx, p, assigned)
	if err != nil {
		return err
	}

	grouped, err := s.groupedLines(ctx, p, assigned, repeated, postings)
	if err != nil {
		return err
	}

	held, err := s.heldBackLines(ctx, p, assigned, repeated, grouped)
	if err != nil {
		return err
	}

	p.route(assigned, repeated, grouped, held)

	return s.applyPlan(ctx, p)
}

func (s *Service) applyPlan(ctx context.Context, p *importPlan) error {
	if err := s.linkMatches(ctx, p); err != nil {
		return err
	}

	if err := s.pairLines(ctx, p); err != nil {
		return err
	}

	if err := s.create(ctx, p.batch.BooksID, p.sync, p.creates, p.created); err != nil {
		return err
	}

	if err := s.placeInstallments(ctx, p); err != nil {
		return err
	}

	return s.saveOutcomes(ctx, p)
}

func (p *importPlan) offerAgain(rec *domain.ExternalRecord, r domain.NormalizedRecord) {
	// A90: an installment line waiting for review is offered again; what refused it
	// (a reconciled installment, a line of an earlier rule) may have changed.
	withFacts(rec, r)

	line := p.lineOf(rec, r)
	p.retried, p.again = append(
		p.retried,
		rec,
	), append(
		p.again,
		InstallmentLine{RecordID: rec.ID, Line: line, Installment: *r.Installment},
	)
}

func (p *importPlan) route(
	assigned []domain.Assignment,
	repeated map[int]bool,
	grouped map[int]uuid.UUID,
	held map[int]bool,
) {
	for i, a := range assigned {
		rec, line := p.scoring[i].rec, p.scoring[i].line
		if repeated[i] {
			// A142: the source reports a recorded payment under a second id.
			rec.State, rec.ReviewReason = domain.StateNeedsReview, domain.ReviewRepeated
			continue
		}

		if entry, ok := grouped[i]; ok {
			// A168: the lines of a group wait for the owner with the entry as their candidate.
			rec.State, rec.ReviewReason, rec.Candidates = domain.StateNeedsReview, domain.ReviewGroup, []uuid.UUID{
				entry,
			}

			continue
		}

		if held[i] {
			// A215: the stored line did not return, so this one may be it under another name or id.
			rec.State, rec.ReviewReason = domain.StateNeedsReview, domain.ReviewDuplicate
			continue
		}

		switch {
		case a.Zone == domain.ZoneNew && p.scoring[i].reserveReview:
			// A213: a line no reserve resolves books nothing a balance could turn into yield.
			rec.State, rec.ReviewReason = domain.StateNeedsReview, domain.ReviewReserve
		case a.Zone == domain.ZoneNew:
			p.creates, p.created = append(
				p.creates,
				NewLine{RecordID: rec.ID, Line: line},
			), append(
				p.created,
				rec,
			)
		case a.Zone == domain.ZoneLink:
			p.matches = append(
				p.matches,
				Match{
					RecordID:      rec.ID,
					TransactionID: a.TransactionID,
					AccountID:     rec.AccountID,
					Pending:       line.Pending,
				},
			)
			p.matched = append(p.matched, rec)
		default:
			rec.State, rec.ReviewReason, rec.Scores = domain.StateNeedsReview, string(
				a.Zone,
			), a.Candidates

			rec.Candidates = make([]uuid.UUID, len(a.Candidates))
			for j, c := range a.Candidates {
				rec.Candidates[j] = c.TransactionID
			}
		}
	}
}

func (p *importPlan) lineOf(rec *domain.ExternalRecord, r domain.NormalizedRecord) Line {
	return Line{
		AccountID:   rec.AccountID,
		Currency:    p.currency,
		Date:        rec.Date,
		Amount:      rec.Amount,
		Description: truncate(rec.Description),
		Pending:     r.Pending,
		DueDate:     r.DueDate,
		Category:    r.Category,
		Kind:        r.Kind,
	}
}

// reopenWithdrawn turns a withdrawn record that the aggregator returned into a received one.
func reopenWithdrawn(claimed []Claim, lines []domain.NormalizedRecord) {
	for i := range claimed {
		if rec := &claimed[i].Record; claimed[i].Existed && rec.State == domain.StateWithdrawn {
			withFacts(rec, lines[i])
			rec.Date, rec.Amount, rec.State, rec.TransactionID, rec.Candidates = lines[i].Date, lines[i].Amount, domain.StateReceived, uuid.Nil, nil
			rec.ReviewReason, rec.Scores = "", nil
			rec.Decision, rec.Undo = "", domain.Undo{}
			claimed[i].Existed = false
		}
	}
}
