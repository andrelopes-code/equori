package app

import (
	"context"
	"errors"
	"fmt"

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

// statementOf: explicit statement, else the oldest unpaid closed statement for a payment
// (P2 amendment A5), else the statement the date falls in (T04).
func (s *Service) statementOf(ctx context.Context, r Repository, t *domain.Transaction, p *domain.Posting, rules domain.Rules) (domain.ReferenceMonth, error) {
	if p.Statement != nil {
		return *p.Statement, nil
	}
	if p.CardRole == domain.RolePayment {
		summaries, err := s.statementSummaries(ctx, r, t.UserID, p.AccountID)
		if err != nil {
			return domain.ReferenceMonth{}, err
		}
		for _, st := range summaries {
			if st.Summary.Unpaid > 0 && !st.Input.Closing.After(t.Date) {
				return st.Input.Reference, nil
			}
		}
	}
	return domain.StatementFor(t.Date, rules)
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
