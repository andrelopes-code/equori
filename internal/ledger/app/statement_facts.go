package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
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
func (s *Service) RecordStatementFacts(
	ctx context.Context,
	booksID int64,
	cardID uuid.UUID,
	f StatementFacts,
) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		card, err := s.card(ctx, booksID, cardID)
		if err != nil {
			return err
		}

		ref, err := s.statementDue(ctx, r, booksID, cardID, f.Due)
		if err != nil {
			return err
		}

		rules, err := r.BillingRules(ctx, booksID, cardID)
		if err != nil {
			return err
		}

		id, err := s.ensureStatement(ctx, r, booksID, cardID, ref, rules)
		if err != nil {
			return err
		}

		fact, err := statementFact(booksID, id, domain.FactAggregator, card, f)
		if err != nil {
			return err
		}

		if err := r.SaveStatementFact(ctx, fact); err != nil {
			return err
		}

		return s.dateByFacts(ctx, r, booksID, cardID, rules)
	})
}

// SetOwnerFacts records the owner's facts for a statement, which win over an aggregator's.
func (s *Service) SetOwnerFacts(
	ctx context.Context,
	booksID int64,
	statementID uuid.UUID,
	f StatementFacts,
) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		v, card, err := s.statementView(ctx, r, booksID, statementID)
		if err != nil {
			return err
		}

		fact, err := statementFact(booksID, statementID, domain.FactOwner, card, f)
		if err != nil {
			return err
		}

		if err := r.SaveStatementFact(ctx, fact); err != nil {
			return err
		}

		rules, err := r.BillingRules(ctx, booksID, v.AccountID)
		if err != nil {
			return err
		}

		return s.dateByFacts(ctx, r, booksID, v.AccountID, rules)
	})
}

// RemoveOwnerFacts removes the owner's facts; the statement takes the aggregator's facts or
// the rule's dates again.
func (s *Service) RemoveOwnerFacts(
	ctx context.Context,
	booksID int64,
	statementID uuid.UUID,
) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		v, _, err := s.statementView(ctx, r, booksID, statementID)
		if err != nil {
			return err
		}

		if err := r.DeleteStatementFact(ctx, booksID, statementID, domain.FactOwner); err != nil {
			return err
		}

		rules, err := r.BillingRules(ctx, booksID, v.AccountID)
		if err != nil {
			return err
		}

		return s.dateByFacts(ctx, r, booksID, v.AccountID, rules)
	})
}

func statementFact(
	booksID int64,
	statementID uuid.UUID,
	source string,
	card domain.Account,
	f StatementFacts,
) (domain.StatementFact, error) {
	if f.Total.Currency() != card.Instrument ||
		(f.Minimum != nil && f.Minimum.Currency() != card.Instrument) {
		return domain.StatementFact{}, validationError("total", "must be in the card currency")
	}

	if f.Closing != nil && !f.Closing.Before(f.Due) {
		return domain.StatementFact{}, validationError(
			"closing_date",
			"must be before the due date",
		)
	}

	fact := domain.StatementFact{
		BooksID:     booksID,
		StatementID: statementID,
		Source:      source,
		Closing:     f.Closing,
		Due:         f.Due,
		Total:       f.Total.Amount(),
	}
	if f.Minimum != nil {
		m := f.Minimum.Amount()
		fact.Minimum = &m
	}

	return fact, nil
}

// SettleReportedStatements reconciles every closed statement of the card whose amount due
// equals the reported total (A92, A7). It moves no posting: a feed can still report as pending
// a line the institution billed, so a statement changes only by the line's bill or by the
// owner (A141).
func (s *Service) SettleReportedStatements(
	ctx context.Context,
	booksID int64,
	cardID uuid.UUID,
) error {
	card, err := s.card(ctx, booksID, cardID)
	if err != nil {
		return err
	}

	views, err := s.statementSummaries(ctx, s.repo, booksID, cardID)
	if err != nil {
		return err
	}

	for _, v := range views {
		if v.Fact == nil || v.Reconciled || s.clock.Today(ctx).Before(v.Input.Closing) ||
			v.Summary.AmountDue != v.Fact.Total {
			continue
		}

		total, err := money.New(v.Fact.Total, card.Instrument)
		if err != nil {
			return err
		}

		if err := s.ReconcileStatement(
			ctx,
			booksID,
			v.ID,
			total,
		); err != nil &&
			!errors.Is(err, ErrDifferenceRemains) {
			return err
		}
	}

	return nil
}

// SettleChangedCards settles the reported statements of the credit cards among accountIDs
// (A139); other accounts are skipped.
func (s *Service) SettleChangedCards(
	ctx context.Context,
	booksID int64,
	accountIDs []uuid.UUID,
) error {
	for _, id := range accountIDs {
		a, err := s.repo.Account(ctx, booksID, id)
		if errors.Is(err, ErrNotFound) {
			continue
		}

		if err != nil {
			return err
		}

		if a.Kind != domain.KindCreditCard {
			continue
		}

		if err := s.SettleReportedStatements(ctx, booksID, id); err != nil {
			return err
		}
	}

	return nil
}

// RecordCardOpening opens a card that has no opening balance with the total of the bill due
// on due, billed on that bill's statement and dated on its closing date (A93).
func (s *Service) RecordCardOpening(
	ctx context.Context,
	booksID int64,
	cardID uuid.UUID,
	due time.Time,
	total money.Money,
) error {
	if total.IsZero() {
		return nil
	}

	return s.repo.InTx(ctx, func(r Repository) error {
		card, err := s.card(ctx, booksID, cardID)
		if err != nil {
			return err
		}

		if has, err := r.HasOpeningBalance(ctx, booksID, cardID); err != nil || has {
			return err
		}

		ref, closing, err := s.openingStatement(ctx, r, booksID, cardID, due)
		if err != nil {
			return err
		}

		return s.insertCardOpening(ctx, r, booksID, cardID, card, ref, closing, total)
	})
}

// openingStatement ensures the statement of the bill due on due and returns its reference
// and the closing dates of the card.
func (s *Service) openingStatement(
	ctx context.Context,
	r Repository,
	booksID int64,
	cardID uuid.UUID,
	due time.Time,
) (domain.ReferenceMonth, map[domain.ReferenceMonth]time.Time, error) {
	ref, err := s.statementDue(ctx, r, booksID, cardID, due)
	if err != nil {
		return domain.ReferenceMonth{}, nil, err
	}

	rules, err := r.BillingRules(ctx, booksID, cardID)
	if err != nil {
		return domain.ReferenceMonth{}, nil, err
	}

	if _, err := s.ensureStatement(ctx, r, booksID, cardID, ref, rules); err != nil {
		return domain.ReferenceMonth{}, nil, err
	}

	closing, err := r.StatementClosings(ctx, booksID, cardID)

	return ref, closing, err
}

// insertCardOpening records the opening balance of card on the day before the closing of ref.
func (s *Service) insertCardOpening(
	ctx context.Context,
	r Repository,
	booksID int64,
	cardID uuid.UUID,
	card domain.Account,
	ref domain.ReferenceMonth,
	closing map[domain.ReferenceMonth]time.Time,
	total money.Money,
) error {
	opening, err := r.SystemAccount(ctx, booksID, domain.RoleOpeningBalances)
	if err != nil {
		return err
	}

	date := closing[ref].AddDate(0, 0, -1)
	if date.Before(card.OpenedOn) {
		date = card.OpenedOn
	}

	w, err := s.writerFor(ctx, booksID)
	if err != nil {
		return err
	}

	_, err = s.insert(ctx, r, domain.Transaction{
		BooksID:     booksID,
		Date:        date,
		Description: fmt.Sprintf(w.CardOpeningBalance, card.Name),
		Origin:      domain.OriginSystem,
		Postings: []domain.Posting{
			{AccountID: cardID, Amount: total.Neg(), Statement: &ref},
			{AccountID: opening.ID, Amount: total},
		},
	})

	return err
}
