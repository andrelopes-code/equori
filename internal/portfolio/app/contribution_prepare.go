package app

import (
	"context"
	"fmt"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// prepareContribution is the head of a save and of the previews: the stored plan completes what
// p leaves out (CO16), the ideals derive, the plan and its members and rules are validated.
// amountOK, when set, checks the amount against the base currency.
func (s *Service) prepareContribution(
	ctx context.Context,
	booksID int64,
	p domain.Plan,
	amountOK func(base money.Currency) bool,
) (domain.Plan, accountBook, money.Currency, error) {
	p, err := s.keptPlan(ctx, booksID, p)
	if err != nil {
		return domain.Plan{}, accountBook{}, "", err
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return domain.Plan{}, accountBook{}, "", err
	}

	if amountOK != nil && !amountOK(base) {
		return domain.Plan{}, accountBook{}, "", ErrContributionAmountInvalid
	}

	ab, err := s.loadAccountBook(ctx, booksID)
	if err != nil {
		return domain.Plan{}, accountBook{}, "", err
	}

	if err := s.validateMembers(ctx, ab, p); err != nil {
		return domain.Plan{}, accountBook{}, "", err
	}

	if err := s.validateRules(ctx, ab, p, base); err != nil {
		return domain.Plan{}, accountBook{}, "", err
	}

	return p, ab, base, nil
}

// keptPlan reads the stored plan once, keeps its fields where p is silent, derives the ideals and
// checks the shape.
func (s *Service) keptPlan(
	ctx context.Context,
	booksID int64,
	p domain.Plan,
) (domain.Plan, error) {
	stored, _, err := s.repo.ContributionPlan(ctx, booksID)
	if err != nil {
		return domain.Plan{}, fmt.Errorf("read the contribution plan: %w", err)
	}

	p = p.KeepFrom(stored, s.ledger.Today(ctx))
	p.Revision = stored.Revision

	p, err = s.withIdeals(ctx, p)
	if err != nil {
		return domain.Plan{}, err
	}

	if err := p.Check(); err != nil {
		return domain.Plan{}, err
	}

	return p, nil
}
