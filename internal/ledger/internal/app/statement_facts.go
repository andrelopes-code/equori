package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// StatementFacts is what an institution reports for the statement due on Due (A85).
type StatementFacts struct {
	Closing *time.Time
	Due     time.Time
	Total   money.Money
	Minimum *money.Money
}

// RecordStatementFacts records an aggregator's bill on the card statement due on the bill's
// due date, creating it when absent, and dates the statement by its facts (A85, A86).
func (s *Service) RecordStatementFacts(ctx context.Context, userID int64, cardID uuid.UUID, f StatementFacts) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		card, err := s.card(ctx, userID, cardID)
		if err != nil {
			return err
		}
		ref, err := s.statementDue(ctx, r, userID, cardID, f.Due)
		if err != nil {
			return err
		}
		rules, err := r.BillingRules(ctx, userID, cardID)
		if err != nil {
			return err
		}
		id, err := s.ensureStatement(ctx, r, userID, cardID, ref, rules)
		if err != nil {
			return err
		}
		fact, err := statementFact(userID, id, domain.FactAggregator, card, f)
		if err != nil {
			return err
		}
		if err := r.SaveStatementFact(ctx, fact); err != nil {
			return err
		}
		return s.dateByFacts(ctx, r, userID, cardID, rules)
	})
}

// SetOwnerFacts records the owner's facts for a statement, which win over an aggregator's.
func (s *Service) SetOwnerFacts(ctx context.Context, userID int64, statementID uuid.UUID, f StatementFacts) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		v, card, err := s.statementView(ctx, r, userID, statementID)
		if err != nil {
			return err
		}
		fact, err := statementFact(userID, statementID, domain.FactOwner, card, f)
		if err != nil {
			return err
		}
		if err := r.SaveStatementFact(ctx, fact); err != nil {
			return err
		}
		rules, err := r.BillingRules(ctx, userID, v.AccountID)
		if err != nil {
			return err
		}
		return s.dateByFacts(ctx, r, userID, v.AccountID, rules)
	})
}

// RemoveOwnerFacts removes the owner's facts; the statement takes the aggregator's facts or
// the rule's dates again.
func (s *Service) RemoveOwnerFacts(ctx context.Context, userID int64, statementID uuid.UUID) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		v, _, err := s.statementView(ctx, r, userID, statementID)
		if err != nil {
			return err
		}
		if err := r.DeleteStatementFact(ctx, userID, statementID, domain.FactOwner); err != nil {
			return err
		}
		rules, err := r.BillingRules(ctx, userID, v.AccountID)
		if err != nil {
			return err
		}
		return s.dateByFacts(ctx, r, userID, v.AccountID, rules)
	})
}

func statementFact(userID int64, statementID uuid.UUID, source string, card domain.Account, f StatementFacts) (domain.StatementFact, error) {
	if f.Total.Currency() != card.Instrument || (f.Minimum != nil && f.Minimum.Currency() != card.Instrument) {
		return domain.StatementFact{}, validationError("total", "must be in the card currency")
	}
	if f.Closing != nil && !f.Closing.Before(f.Due) {
		return domain.StatementFact{}, validationError("closing_date", "must be before the due date")
	}
	fact := domain.StatementFact{UserID: userID, StatementID: statementID, Source: source, Closing: f.Closing, Due: f.Due, Total: f.Total.Amount()}
	if f.Minimum != nil {
		m := f.Minimum.Amount()
		fact.Minimum = &m
	}
	return fact, nil
}

// dateByFacts gives every statement of the card the dates of its effective facts, or the
// rule's, and bills again the postings billed by a date that the new dates move (A86).
func (s *Service) dateByFacts(ctx context.Context, r Repository, userID int64, cardID uuid.UUID, rules domain.Rules) error {
	stored, err := r.Statements(ctx, userID, cardID)
	if err != nil {
		return err
	}
	before := make(map[domain.ReferenceMonth]time.Time, len(stored))
	after := make(map[domain.ReferenceMonth]time.Time, len(stored))
	refOf := make(map[uuid.UUID]domain.ReferenceMonth, len(stored))
	for _, st := range stored {
		ref := st.Input.Reference
		before[ref], refOf[st.ID] = st.Input.Closing, ref
		closing, due, err := s.effectiveDates(ctx, st, rules)
		if err != nil {
			return err
		}
		after[ref] = closing
		if closing.Equal(st.Input.Closing) && due.Equal(st.Input.Due) {
			continue
		}
		if err := r.UpdateStatementDates(ctx, st.ID, closing, due); err != nil {
			return err
		}
	}
	postings, err := r.RedatablePostings(ctx, userID, cardID)
	if err != nil {
		return err
	}
	for _, p := range postings {
		was, err := domain.StatementOn(p.Date, before, rules, s.projectedClosing(ctx))
		if err != nil || was != refOf[p.StatementID] {
			continue
		}
		now, err := domain.StatementOn(p.Date, after, rules, s.projectedClosing(ctx))
		if err != nil || now == was {
			continue
		}
		id, err := s.ensureStatement(ctx, r, userID, cardID, now, rules)
		if err != nil {
			return err
		}
		if err := r.MovePostingStatement(ctx, userID, p.ID, id); err != nil {
			return err
		}
	}
	return nil
}

// effectiveDates are the dates of the statement's effective facts, completed by the rule's
// projection (A86).
func (s *Service) effectiveDates(ctx context.Context, st Statement, rules domain.Rules) (closing, due time.Time, err error) {
	rule, err := rules.For(st.Input.Reference)
	if errors.Is(err, domain.ErrNoBillingRule) {
		return st.Input.Closing, st.Input.Due, nil
	}
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	dates := domain.DatesFor(st.Input.Reference, rule)
	closing = s.shiftClosing(ctx, dates.Closing, rule)
	if due, err = s.cal.Adjust(ctx, rule.Calendar, dates.DueUnadjusted, rule.Adjustment); err != nil {
		return time.Time{}, time.Time{}, err
	}
	if f := st.Fact; f != nil {
		due = f.Due
		if f.Closing != nil {
			// The institution reports the closing date before its calendar shift (A86, C3).
			closing = s.shiftClosing(ctx, *f.Closing, rule)
		}
	}
	return closing, due, nil
}

// SettleReportedStatements moves the card's pending postings off the statements the
// institution reported (A90) and reconciles every closed statement whose amount due equals
// the reported total (A92, A7).
func (s *Service) SettleReportedStatements(ctx context.Context, userID int64, cardID uuid.UUID) error {
	err := s.repo.InTx(ctx, func(r Repository) error {
		pending, err := r.PendingOnReported(ctx, userID, cardID)
		if err != nil || len(pending) == 0 {
			return err
		}
		stored, err := r.Statements(ctx, userID, cardID)
		if err != nil {
			return err
		}
		reported := map[domain.ReferenceMonth]bool{}
		refOf := map[uuid.UUID]domain.ReferenceMonth{}
		for _, st := range stored {
			refOf[st.ID] = st.Input.Reference
			reported[st.Input.Reference] = st.Fact != nil
		}
		rules, err := r.BillingRules(ctx, userID, cardID)
		if err != nil {
			return err
		}
		for _, p := range pending {
			ref := refOf[p.StatementID]
			for reported[ref] {
				ref = ref.Add(1)
			}
			id, err := s.ensureStatement(ctx, r, userID, cardID, ref, rules)
			if err != nil {
				return err
			}
			if err := r.MovePostingStatement(ctx, userID, p.ID, id); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	card, err := s.card(ctx, userID, cardID)
	if err != nil {
		return err
	}
	views, err := s.statementSummaries(ctx, s.repo, userID, cardID)
	if err != nil {
		return err
	}
	for _, v := range views {
		if v.Fact == nil || v.Reconciled || s.clock.Today().Before(v.Input.Closing) || v.Summary.AmountDue != v.Fact.Total {
			continue
		}
		total, err := money.New(v.Fact.Total, card.Instrument)
		if err != nil {
			return err
		}
		if err := s.ReconcileStatement(ctx, userID, v.ID, total); err != nil && !errors.Is(err, ErrDifferenceRemains) {
			return err
		}
	}
	return nil
}
