package app

import (
	"context"
	"fmt"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

type Service struct {
	repo   Repository
	ledger Ledger
}

func NewService(repo Repository, ledger Ledger) *Service {
	return &Service{repo: repo, ledger: ledger}
}

func (s *Service) ListRules(ctx context.Context, userID int64, p page.Request[RuleKey]) ([]domain.Rule, *RuleKey, error) {
	return s.repo.ListRules(ctx, userID, p)
}

func (s *Service) Rule(ctx context.Context, userID int64, id uuid.UUID) (domain.Rule, error) {
	return s.repo.Rule(ctx, userID, id)
}

func (s *Service) CreateRule(ctx context.Context, userID int64, r domain.Rule) (domain.Rule, error) {
	r, err := s.checkRule(ctx, userID, r)
	if err != nil {
		return domain.Rule{}, err
	}
	return s.repo.InsertRule(ctx, userID, r)
}

// ChangeRule replaces everything but the priority.
func (s *Service) ChangeRule(ctx context.Context, userID int64, r domain.Rule) (domain.Rule, error) {
	r, err := s.checkRule(ctx, userID, r)
	if err != nil {
		return domain.Rule{}, err
	}
	return s.repo.UpdateRule(ctx, userID, r)
}

func (s *Service) DeleteRule(ctx context.Context, userID int64, id uuid.UUID) error {
	return s.repo.DeleteRule(ctx, userID, id)
}

// ReorderRules gives the rules of ids the priorities 1..n; ids is every rule exactly once.
func (s *Service) ReorderRules(ctx context.Context, userID int64, ids []uuid.UUID) ([]domain.Rule, error) {
	err := s.repo.InTx(ctx, func(r Repository) error {
		current, err := r.LockRuleIDs(ctx, userID)
		if err != nil {
			return err
		}
		sorted := slices.Clone(ids)
		slices.SortFunc(sorted, compareIDs)
		slices.SortFunc(current, compareIDs)
		if !slices.Equal(sorted, current) {
			return &domain.FieldError{Field: "rule_ids", Message: "must list every rule exactly once", Err: domain.ErrValidation}
		}
		return r.SetPriorities(ctx, userID, ids)
	})
	if err != nil {
		return nil, err
	}
	rules, _, err := s.repo.ListRules(ctx, userID, page.Request[RuleKey]{Limit: len(ids)})
	return rules, err
}

func compareIDs(a, b uuid.UUID) int { return slices.Compare(a[:], b[:]) }

// checkRule validates r and its references to the user's categories, payees and accounts.
func (s *Service) checkRule(ctx context.Context, userID int64, r domain.Rule) (domain.Rule, error) {
	r, err := domain.NewRule(r)
	if err != nil {
		return domain.Rule{}, err
	}
	accounts, err := s.accounts(ctx, userID)
	if err != nil {
		return domain.Rule{}, err
	}
	var payees []uuid.UUID
	payeeFields := map[uuid.UUID]string{}
	for i, c := range r.Conditions {
		field := fmt.Sprintf("conditions[%d].value", i)
		for _, id := range c.IDs {
			switch c.Field {
			case domain.FieldAccount:
				if a, ok := accounts[id]; !ok || !a.isBalance() {
					return domain.Rule{}, invalidRef(field, "must be asset or liability accounts")
				}
			case domain.FieldPayee:
				payees = append(payees, id)
				payeeFields[id] = field
			}
		}
	}
	for i, a := range r.Actions {
		field := fmt.Sprintf("actions[%d]", i)
		if a.Type == domain.ActionSetCategory {
			if c, ok := accounts[a.CategoryID]; !ok || !c.isCategory() {
				return domain.Rule{}, invalidRef(field+".category_id", "must be an income or expense category")
			}
		}
		for j, p := range a.Parts {
			if c, ok := accounts[p.CategoryID]; !ok || !c.isCategory() {
				return domain.Rule{}, invalidRef(fmt.Sprintf("%s.parts[%d].category_id", field, j), "must be an income or expense category")
			}
		}
		if a.Type == domain.ActionSetPayee {
			payees = append(payees, a.PayeeID)
			payeeFields[a.PayeeID] = field + ".payee_id"
		}
	}
	if len(payees) > 0 {
		missing, err := s.ledger.MissingPayees(ctx, userID, payees)
		if err != nil {
			return domain.Rule{}, err
		}
		if len(missing) > 0 {
			return domain.Rule{}, invalidRef(payeeFields[missing[0]], "unknown payee")
		}
	}
	return r, nil
}

func (s *Service) accounts(ctx context.Context, userID int64) (map[uuid.UUID]Account, error) {
	as, err := s.ledger.AccountFacts(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]Account, len(as))
	for _, a := range as {
		out[a.ID] = a
	}
	return out, nil
}

func invalidRef(field, message string) error {
	return &domain.FieldError{Field: field, Message: message, Err: domain.ErrValidation}
}
