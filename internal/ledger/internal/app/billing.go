package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
)

// bill resolves the statement of every card posting of t and creates missing
// statement rows, inside the transaction that records the postings (I03).
func (s *Service) bill(ctx context.Context, r Repository, t *domain.Transaction) error {
	rulesByCard := map[uuid.UUID]domain.Rules{}
	for i := range t.Postings {
		p := &t.Postings[i]
		if p.CardRole == "" {
			continue
		}
		rules, ok := rulesByCard[p.AccountID]
		if !ok {
			var err error
			if rules, err = r.BillingRules(ctx, t.UserID, p.AccountID); err != nil {
				return err
			}
			rulesByCard[p.AccountID] = rules
		}
		ref, err := s.statementOf(ctx, r, t, p, rules)
		if errors.Is(err, domain.ErrNoBillingRule) {
			return &domain.FieldError{Field: fmt.Sprintf("postings[%d].account_id", i), Message: "card has no billing cycle rule for the date", Err: domain.ErrValidation}
		}
		if err != nil {
			return err
		}
		id, err := s.ensureStatement(ctx, r, t.UserID, p.AccountID, ref, rules)
		if errors.Is(err, domain.ErrNoBillingRule) {
			return &domain.FieldError{Field: fmt.Sprintf("postings[%d].statement", i), Message: "no billing cycle rule covers the statement", Err: domain.ErrValidation}
		}
		if err != nil {
			return err
		}
		p.Statement, p.StatementID = &ref, id
	}
	return nil
}

// statementOf: explicit statement, else the statement the date falls in (T04); a payment is
// billed on the statement of its cycle, not on the one it pays (A89).
func (s *Service) statementOf(ctx context.Context, r Repository, t *domain.Transaction, p *domain.Posting, rules domain.Rules) (domain.ReferenceMonth, error) {
	if p.Statement != nil {
		return *p.Statement, nil
	}
	return s.statementOn(ctx, r, t.UserID, p.AccountID, t.Date, rules)
}

// statementOn is the statement of a posting dated d by the card's stored dates (A86).
func (s *Service) statementOn(ctx context.Context, r Repository, userID int64, cardID uuid.UUID, d time.Time, rules domain.Rules) (domain.ReferenceMonth, error) {
	closing, err := r.StatementClosings(ctx, userID, cardID)
	if err != nil {
		return domain.ReferenceMonth{}, err
	}
	return domain.StatementOn(d, closing, rules, s.projectedClosing(ctx))
}

// projectedClosing is the rule's closing date of a month, shifted by its closing adjustment
// (A87); a calendar that cannot answer leaves it unshifted.
func (s *Service) projectedClosing(ctx context.Context) func(domain.ReferenceMonth, domain.BillingCycleRule) time.Time {
	return func(m domain.ReferenceMonth, rule domain.BillingCycleRule) time.Time {
		return s.shiftClosing(ctx, domain.DatesFor(m, rule).Closing, rule)
	}
}

func (s *Service) shiftClosing(ctx context.Context, closing time.Time, rule domain.BillingCycleRule) time.Time {
	if rule.ClosingAdjustment == "" || rule.ClosingAdjustment == "none" {
		return closing
	}
	shifted, err := s.cal.Adjust(ctx, rule.Calendar, closing, rule.ClosingAdjustment)
	if err != nil {
		return closing
	}
	return shifted
}

func (s *Service) ensureStatement(ctx context.Context, r Repository, userID int64, accountID uuid.UUID, ref domain.ReferenceMonth, rules domain.Rules) (uuid.UUID, error) {
	rule, err := rules.For(ref)
	if err != nil {
		return uuid.Nil, err
	}
	dates := domain.DatesFor(ref, rule)
	due, err := s.cal.Adjust(ctx, rule.Calendar, dates.DueUnadjusted, rule.Adjustment)
	if err != nil {
		return uuid.Nil, err
	}
	dates.Closing = s.shiftClosing(ctx, dates.Closing, rule)
	return r.EnsureStatement(ctx, userID, accountID, dates, due)
}

// StatementView is a stored statement with its derived summary.
type StatementView struct {
	Statement
	Summary domain.StatementSummary
}

func (s *Service) statementSummaries(ctx context.Context, r Repository, userID int64, accountID uuid.UUID) ([]StatementView, error) {
	stored, err := r.Statements(ctx, userID, accountID)
	if err != nil {
		return nil, err
	}
	inputs := make([]domain.StatementInput, len(stored))
	for i, st := range stored {
		inputs[i] = st.Input
	}
	summaries := domain.Summarize(inputs, s.clock.Today())
	out := make([]StatementView, len(stored))
	for i := range stored {
		out[i] = StatementView{Statement: stored[i], Summary: summaries[i]}
	}
	return out, nil
}

// StatementPlacement is the statement a card purchase would be billed on, and the statement
// before it when a rule or a stored statement gives its dates.
type StatementPlacement struct {
	Reference domain.ReferenceMonth
	Closing   time.Time
	Due       time.Time
	Previous  *StatementDates
}

type StatementDates struct {
	Closing time.Time
	Due     time.Time
}

// PlaceStatement resolves the statement of a purchase dated d as bill would, without
// storing it: a stored statement keeps its dates, a new one gets the rule's adjusted dates.
func (s *Service) PlaceStatement(ctx context.Context, userID int64, cardID uuid.UUID, d time.Time) (StatementPlacement, error) {
	if _, err := s.card(ctx, userID, cardID); err != nil {
		return StatementPlacement{}, err
	}
	rules, err := s.repo.BillingRules(ctx, userID, cardID)
	if err != nil {
		return StatementPlacement{}, err
	}
	ref, err := s.statementOn(ctx, s.repo, userID, cardID, d, rules)
	if errors.Is(err, domain.ErrNoBillingRule) {
		return StatementPlacement{}, validationError("date", "card has no billing cycle rule for the date")
	}
	if err != nil {
		return StatementPlacement{}, err
	}
	stored, err := s.repo.Statements(ctx, userID, cardID)
	if err != nil {
		return StatementPlacement{}, err
	}
	dates, err := s.statementDates(ctx, ref, rules, stored)
	if errors.Is(err, domain.ErrNoBillingRule) {
		return StatementPlacement{}, validationError("date", "no billing cycle rule covers the statement")
	}
	if err != nil {
		return StatementPlacement{}, err
	}
	out := StatementPlacement{Reference: ref, Closing: dates.Closing, Due: dates.Due}
	previous, err := s.statementDates(ctx, ref.Add(-1), rules, stored)
	switch {
	case err == nil:
		out.Previous = &previous
	case !errors.Is(err, domain.ErrNoBillingRule):
		return StatementPlacement{}, err
	}
	return out, nil
}

func (s *Service) statementDates(ctx context.Context, ref domain.ReferenceMonth, rules domain.Rules, stored []Statement) (StatementDates, error) {
	for _, st := range stored {
		if st.Input.Reference == ref {
			return StatementDates{Closing: st.Input.Closing, Due: st.Input.Due}, nil
		}
	}
	rule, err := rules.For(ref)
	if err != nil {
		return StatementDates{}, err
	}
	dates := domain.DatesFor(ref, rule)
	due, err := s.cal.Adjust(ctx, rule.Calendar, dates.DueUnadjusted, rule.Adjustment)
	if err != nil {
		return StatementDates{}, err
	}
	return StatementDates{Closing: s.shiftClosing(ctx, dates.Closing, rule), Due: due}, nil
}
