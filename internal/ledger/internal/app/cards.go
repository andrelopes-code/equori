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
	r, err := domain.NewBillingCycleRule(r)
	if err != nil {
		return domain.BillingCycleRule{}, err
	}
	return s.repo.InsertBillingRule(ctx, userID, accountID, r)
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
