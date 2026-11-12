package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
)

// dateByFacts gives every statement of the card the dates of its effective facts, or the
// rule's, and bills again the postings billed by a date that the new dates move (A86).
func (s *Service) dateByFacts(
	ctx context.Context,
	r Repository,
	booksID int64,
	cardID uuid.UUID,
	rules domain.Rules,
) error {
	fd, err := s.redateStatements(ctx, r, booksID, cardID, rules)
	if err != nil {
		return err
	}

	return s.moveRedatedPostings(ctx, r, booksID, cardID, rules, fd)
}

// factDates holds the closing date of each statement before and after the facts apply, and
// the reference of each statement id.
type factDates struct {
	before map[domain.ReferenceMonth]time.Time
	after  map[domain.ReferenceMonth]time.Time
	refOf  map[uuid.UUID]domain.ReferenceMonth
}

// redateStatements stores the effective dates of every statement of the card.
func (s *Service) redateStatements(
	ctx context.Context,
	r Repository,
	booksID int64,
	cardID uuid.UUID,
	rules domain.Rules,
) (factDates, error) {
	stored, err := r.Statements(ctx, booksID, cardID)
	if err != nil {
		return factDates{}, err
	}

	before := make(map[domain.ReferenceMonth]time.Time, len(stored))
	after := make(map[domain.ReferenceMonth]time.Time, len(stored))

	refOf := make(map[uuid.UUID]domain.ReferenceMonth, len(stored))
	for _, st := range stored {
		ref := st.Input.Reference
		before[ref], refOf[st.ID] = st.Input.Closing, ref

		closing, due, err := s.effectiveDates(ctx, st, rules)
		if err != nil {
			return factDates{}, err
		}

		after[ref] = closing
		if closing.Equal(st.Input.Closing) && due.Equal(st.Input.Due) {
			continue
		}

		if err := r.UpdateStatementDates(ctx, st.ID, closing, due); err != nil {
			return factDates{}, err
		}
	}

	return factDates{before: before, after: after, refOf: refOf}, nil
}

// moveRedatedPostings bills again the postings whose statement the new dates move.
func (s *Service) moveRedatedPostings(
	ctx context.Context,
	r Repository,
	booksID int64,
	cardID uuid.UUID,
	rules domain.Rules,
	fd factDates,
) error {
	postings, err := r.RedatablePostings(ctx, booksID, cardID)
	if err != nil {
		return err
	}

	for _, p := range postings {
		was, err := domain.StatementOn(p.Date, fd.before, rules, s.projectedClosing(ctx))
		if err != nil || was != fd.refOf[p.StatementID] {
			continue
		}

		now, err := domain.StatementOn(p.Date, fd.after, rules, s.projectedClosing(ctx))
		if err != nil || now == was {
			continue
		}

		id, err := s.ensureStatement(ctx, r, booksID, cardID, now, rules)
		if err != nil {
			return err
		}

		if err := r.MovePostingStatement(ctx, booksID, p.ID, id); err != nil {
			return err
		}
	}

	return nil
}

// effectiveDates are the dates of the statement's effective facts, completed by the rule's
// projection (A86).
func (s *Service) effectiveDates(
	ctx context.Context,
	st Statement,
	rules domain.Rules,
) (closing, due time.Time, err error) {
	rule, err := rules.For(st.Input.Reference)
	if errors.Is(err, domain.ErrNoBillingRule) {
		return st.Input.Closing, st.Input.Due, nil
	}

	if err != nil {
		return time.Time{}, time.Time{}, err
	}

	dates := domain.DatesFor(st.Input.Reference, rule)

	closing = s.shiftClosing(ctx, dates.Closing, rule)
	if due, err = s.cal.Adjust(
		ctx,
		rule.Calendar,
		dates.DueUnadjusted,
		rule.Adjustment,
	); err != nil {
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
