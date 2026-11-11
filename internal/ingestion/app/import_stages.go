package app

import (
	"context"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

func (s *Service) claimLines(ctx context.Context, p *importPlan) error {
	ordinals := domain.Ordinals{}

	var holders [][]byte
	if p.sync {
		var err error
		if holders, err = s.repo.BookHolders(ctx, p.batch.BooksID); err != nil {
			return err
		}
	}

	claims := make([]domain.ExternalRecord, len(p.lines))
	for i, r := range p.lines {
		claims[i] = domain.ExternalRecord{
			BooksID:     p.batch.BooksID,
			BatchID:     p.batch.ID,
			AccountID:   p.batch.AccountID,
			ExternalID:  r.ExternalID,
			DedupKey:    domain.DedupKey(p.batch.AccountID, p.batch.Source, r, ordinals.Next(r)),
			Raw:         r.Raw,
			Date:        r.Date,
			Amount:      r.Amount,
			Description: r.Description,
			State:       domain.StateReceived,

			InstitutionID:  r.InstitutionID,
			ReportedAmount: r.Amount,
			ReportedOn:     r.Date,
		}
		if p.sync {
			withFacts(&claims[i], r)
			claims[i].Counterparty = domain.CounterpartyOf(r.Counterparty, holders)
		}
	}

	claimed, err := s.repo.ClaimRecords(ctx, claims)
	if err != nil {
		return err
	}

	p.batch.Counts.Received = len(p.lines)
	reopenWithdrawn(claimed, p.lines)

	p.claimed = claimed

	return nil
}

func (s *Service) classifyLines(ctx context.Context, p *importPlan) error {
	for i := range p.claimed {
		if err := s.classifyLine(ctx, p, i); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) classifyLine(ctx context.Context, p *importPlan, i int) error {
	rec, r := &p.claimed[i].Record, p.lines[i]
	existed := p.claimed[i].Existed

	if p.sync && existed && rec.State == domain.StateNeedsReview &&
		r.Installment != nil && r.Amount < 0 && len(rec.Candidates) == 0 {
		p.offerAgain(rec, r)

		return nil
	}

	if existed && rec.State != domain.StateReceived {
		return s.applyStoredChange(ctx, p, rec, r)
	}

	rec.BatchID = p.batch.ID
	p.pending = append(p.pending, rec)

	line := p.lineOf(rec, r)

	var reserve domain.ReserveOutcome
	if p.reserve != nil {
		reserve = p.reserve(r)
		line.TransferTo = reserve.TransferTo
	}

	if p.sync && r.Installment != nil && r.Amount < 0 {
		// A40: the line goes to its installment purchase; a resumed one finds its own link.
		p.parts = append(p.parts, InstallmentLine{RecordID: rec.ID, Line: line, Installment: *r.Installment})

		return nil
	}

	if existed {
		done, err := s.resume(ctx, rec)
		if err != nil {
			return err
		}

		if done {
			return nil
		}
	}

	p.scoring = append(p.scoring, scoredLine{rec: rec, line: line, reserveReview: reserve.Review})

	return nil
}

func (s *Service) applyStoredChange(
	ctx context.Context,
	p *importPlan,
	rec *domain.ExternalRecord,
	r domain.NormalizedRecord,
) error {
	reported, changed, err := s.update(ctx, p.sync, p.batch.ID, rec, r)
	if err != nil {
		return err
	}

	if reported {
		p.updated = append(p.updated, *rec)
	}

	if changed {
		p.batch.Counts.Updated++
	} else {
		p.batch.Counts.Ignored++
	}

	return nil
}

func (s *Service) repeatedLines(
	ctx context.Context,
	p *importPlan,
	assigned []domain.Assignment,
) (map[int]bool, error) {
	if !p.sync {
		return nil, nil
	}

	return s.repeats(ctx, p.batch, p.scoring, assigned)
}

// heldBackLines names the new lines that may repeat a stored line under another name or id
// (A215).
func (s *Service) heldBackLines(
	ctx context.Context,
	p *importPlan,
	assigned []domain.Assignment,
	repeated map[int]bool,
	grouped map[int]uuid.UUID,
) (map[int]bool, error) {
	var (
		fresh   []domain.ExternalRecord
		indexes []int
	)

	for i, a := range assigned {
		_, inGroup := grouped[i]
		if a.Zone == domain.ZoneNew && !repeated[i] && !inGroup && !p.scoring[i].reserveReview {
			fresh, indexes = append(fresh, *p.scoring[i].rec), append(indexes, i)
		}
	}

	if len(fresh) == 0 {
		return nil, nil
	}

	from, to := span(p.scoring)

	stored, err := s.repo.RepeatableRecords(ctx, p.batch.BooksID, p.batch.AccountID, from, to, p.sync)
	if err != nil {
		return nil, err
	}

	claimed := make([]uuid.UUID, len(p.claimed))
	for i := range p.claimed {
		claimed[i] = p.claimed[i].Record.ID
	}

	held := map[int]bool{}
	for i := range domain.HeldBackLines(fresh, stored, claimed) {
		held[indexes[i]] = true
	}

	return held, nil
}

func (s *Service) linkMatches(ctx context.Context, p *importPlan) error {
	conflicts, err := s.ledger.ClearMatched(ctx, p.batch.BooksID, p.matches)
	if err != nil {
		return err
	}

	for i, rec := range p.matched {
		rec.State, rec.TransactionID = domain.StateMatched, p.matches[i].TransactionID
		if slices.Contains(conflicts, i) {
			rec.State, rec.TransactionID, rec.Candidates = domain.StateNeedsReview, uuid.Nil, []uuid.UUID{p.matches[i].TransactionID}
			continue
		}

		if err := s.billMatched(ctx, rec, p.matches[i].Pending); err != nil {
			return err
		}

		if rec.ReviewReason != domain.ReviewChanged {
			rec.Decision, rec.Undo = domain.DecisionLinked, domain.Undo{}
		}
	}

	return nil
}

func (s *Service) placeInstallments(ctx context.Context, p *importPlan) error {
	if err := s.installments(ctx, p.batch, p.parts, p.pending); err != nil {
		return err
	}

	if err := s.installments(ctx, p.batch, p.again, p.retried); err != nil {
		return err
	}

	for _, rec := range p.retried {
		if rec.State == domain.StateNeedsReview {
			p.batch.Counts.Ignored++
			continue
		}

		// The record stays in its batch, which counts it as resolved.
		if err := s.repo.ResolveRecord(ctx, *rec); err != nil {
			return err
		}

		p.batch.Counts.Updated++
	}

	return nil
}

func (s *Service) saveOutcomes(ctx context.Context, p *importPlan) error {
	outcomes := make([]domain.ExternalRecord, len(p.pending))
	for i, rec := range p.pending {
		if rec.State == domain.StateMatched && rec.Decision == domain.DecisionPaired {
			p.batch.Counts.Paired++
		} else {
			p.batch.Counts.Count(rec.State)
		}

		if p.sync && rec.State != domain.StateReceived {
			rec.SummaryBatchID = p.batch.ID
		}

		outcomes[i] = *rec
	}

	if err := s.repo.UpdateRecordFacts(ctx, p.updated); err != nil {
		return err
	}

	return s.repo.SaveOutcomes(ctx, outcomes)
}
