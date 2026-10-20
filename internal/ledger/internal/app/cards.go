package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Service) card(ctx context.Context, userID int64, accountID uuid.UUID) (domain.Account, error) {
	a, err := s.repo.Account(ctx, userID, accountID)
	if err != nil {
		return domain.Account{}, err
	}
	return a, domain.RequireCard(a)
}

func (s *Service) AddBillingRule(ctx context.Context, userID int64, accountID uuid.UUID, r domain.BillingCycleRule) (domain.BillingCycleRule, error) {
	if _, err := s.card(ctx, userID, accountID); err != nil {
		return domain.BillingCycleRule{}, err
	}
	rule, err := domain.NewBillingCycleRule(r)
	if err != nil {
		return domain.BillingCycleRule{}, err
	}
	if _, err := s.cal.Adjust(ctx, rule.Calendar, s.clock.Today(), "none"); err != nil {
		return domain.BillingCycleRule{}, validationError("calendar", "is not a known calendar")
	}
	var created domain.BillingCycleRule
	err = s.repo.InTx(ctx, func(tx Repository) error {
		if created, err = tx.InsertBillingRule(ctx, userID, accountID, rule); err != nil {
			return err
		}
		return s.redateOpenStatements(ctx, tx, userID, accountID, rule.EffectiveFrom)
	})
	return created, err
}

// redateOpenStatements applies a new rule version to statements that have not closed
// yet; their postings stay on the same reference month.
func (s *Service) redateOpenStatements(ctx context.Context, r Repository, userID int64, accountID uuid.UUID, from domain.ReferenceMonth) error {
	rules, err := r.BillingRules(ctx, userID, accountID)
	if err != nil {
		return err
	}
	open, err := r.OpenStatementsFrom(ctx, userID, accountID, from, s.clock.Today())
	if err != nil {
		return err
	}
	for _, st := range open {
		rule, err := rules.For(st.Input.Reference)
		if err != nil {
			return err
		}
		dates := domain.DatesFor(st.Input.Reference, rule)
		due, err := s.cal.Adjust(ctx, rule.Calendar, dates.DueUnadjusted, rule.Adjustment)
		if err != nil {
			return err
		}
		if err := r.UpdateStatementDates(ctx, st.ID, s.shiftClosing(ctx, dates.Closing, rule), due); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) BillingRules(ctx context.Context, userID int64, accountID uuid.UUID) (domain.Rules, error) {
	if _, err := s.card(ctx, userID, accountID); err != nil {
		return nil, err
	}
	return s.repo.BillingRules(ctx, userID, accountID)
}

func (s *Service) AddCreditLimit(ctx context.Context, userID int64, l CreditLimit) (CreditLimit, error) {
	a, err := s.card(ctx, userID, l.AccountID)
	if err != nil {
		return CreditLimit{}, err
	}
	if l.Amount.Currency() != a.Instrument || l.Amount.Amount() <= 0 {
		return CreditLimit{}, &domain.FieldError{Field: "amount", Message: "must be positive and in the card currency", Err: domain.ErrValidation}
	}
	return s.repo.InsertCreditLimit(ctx, userID, l)
}

func (s *Service) CreditLimits(ctx context.Context, userID int64, accountID uuid.UUID) ([]CreditLimit, error) {
	if _, err := s.card(ctx, userID, accountID); err != nil {
		return nil, err
	}
	return s.repo.CreditLimits(ctx, userID, accountID)
}

func (s *Service) AddCard(ctx context.Context, userID int64, c domain.Card) (domain.Card, error) {
	if _, err := s.card(ctx, userID, c.AccountID); err != nil {
		return domain.Card{}, err
	}
	c.UserID = userID
	c, err := domain.NewCard(c)
	if err != nil {
		return domain.Card{}, err
	}
	return s.repo.InsertCard(ctx, c)
}

func (s *Service) Cards(ctx context.Context, userID int64, accountID uuid.UUID) ([]domain.Card, error) {
	if _, err := s.card(ctx, userID, accountID); err != nil {
		return nil, err
	}
	return s.repo.Cards(ctx, userID, accountID)
}

func (s *Service) SetCardActive(ctx context.Context, userID int64, id uuid.UUID, active bool) (domain.Card, error) {
	return s.repo.SetCardActive(ctx, userID, id, active)
}

// CardSummary returns nil when the card has no credit limit in force today. The available
// limit subtracts the whole debt, unbilled installments included, as issuers do.
func (s *Service) CardSummary(ctx context.Context, userID int64, a domain.Account) (*CardSummary, error) {
	if a.Kind != domain.KindCreditCard {
		return nil, nil
	}
	limits, err := s.repo.CreditLimits(ctx, userID, a.ID)
	if err != nil {
		return nil, err
	}
	today := s.clock.Today()
	var current *CreditLimit
	for i := range limits {
		if !limits[i].EffectiveFrom.After(today) {
			current = &limits[i]
		}
	}
	if current == nil {
		return nil, nil
	}
	totals, err := s.repo.AccountTotals(ctx, userID, a.ID)
	if err != nil {
		return nil, err
	}
	available, err := money.New(current.Amount.Amount()+totals.Total, a.Instrument)
	if err != nil {
		return nil, err
	}
	return &CardSummary{CreditLimit: current.Amount, AvailableLimit: available}, nil
}
