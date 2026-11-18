package app

import (
	"context"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// checkGoalAccounts validates the accounts of g: at least one; whole accounts are balance
// accounts with no ancestor among them; allocated accounts are asset accounts without
// sub-accounts in a currency; and an account is held whole or by allocations across the goals
// of the book, never both (planning coherence A255).
func (s *Service) checkGoalAccounts(ctx context.Context, booksID int64, g domain.Goal) error {
	if len(g.AccountIDs)+len(g.AllocatedAccountIDs) == 0 {
		return goalAccountError("account_ids", "must hold at least one account")
	}

	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return err
	}

	byID := make(map[uuid.UUID]Account, len(facts))
	parents := make(map[uuid.UUID]bool, len(facts))

	for _, a := range facts {
		byID[a.ID] = a
		parents[a.ParentID] = true
	}

	if err := checkWholeAccounts(g.AccountIDs, byID); err != nil {
		return err
	}

	for _, id := range g.AllocatedAccountIDs {
		a, ok := byID[id]
		_, notCurrency := money.ParseCurrency(string(a.Instrument))

		if !ok || a.Class != "asset" || parents[id] || notCurrency != nil ||
			slices.Contains(g.AccountIDs, id) {
			return goalAccountError(
				"allocated_account_ids",
				"must be asset accounts without sub-accounts, in a currency, not held whole",
			)
		}
	}

	others, err := s.allGoals(ctx, booksID)
	if err != nil {
		return err
	}

	return checkLinkKinds(g, others)
}

// checkWholeAccounts validates the accounts a goal holds whole.
func checkWholeAccounts(ids []uuid.UUID, byID map[uuid.UUID]Account) error {
	for _, id := range ids {
		a, ok := byID[id]
		if !ok || (a.Class != "asset" && a.Class != "liability") {
			return goalAccountError("account_ids", "must be balance accounts of the book")
		}
	}

	for _, id := range ids {
		for parent := byID[id].ParentID; parent != uuid.Nil; parent = byID[parent].ParentID {
			if slices.Contains(ids, parent) {
				return goalAccountError(
					"account_ids",
					"must not hold an account and one of its sub-accounts",
				)
			}
		}
	}

	return nil
}

// checkLinkKinds rejects an account g holds one way while another goal holds it the other way.
func checkLinkKinds(g domain.Goal, others []domain.Goal) error {
	for _, o := range others {
		if o.ID == g.ID {
			continue
		}

		for _, id := range g.AllocatedAccountIDs {
			if slices.Contains(o.AccountIDs, id) {
				return goalAccountError(
					"allocated_account_ids",
					"holds an account another goal holds whole",
				)
			}
		}

		for _, id := range g.AccountIDs {
			if slices.Contains(o.AllocatedAccountIDs, id) {
				return goalAccountError(
					"account_ids",
					"holds an account another goal holds by allocations",
				)
			}
		}
	}

	return nil
}

func goalAccountError(field, message string) error {
	return &domain.FieldError{Field: field, Message: message, Err: domain.ErrValidation}
}

// sharedWith returns the goals other than g that hold one of its accounts, by id.
func sharedWith(g domain.Goal, all []domain.Goal) []uuid.UUID {
	own := slices.Concat(g.AccountIDs, g.AllocatedAccountIDs)
	out := []uuid.UUID{}

	for _, o := range all {
		if o.ID == g.ID {
			continue
		}

		if slices.ContainsFunc(
			slices.Concat(o.AccountIDs, o.AllocatedAccountIDs),
			func(id uuid.UUID) bool { return slices.Contains(own, id) },
		) {
			out = append(out, o.ID)
		}
	}

	return out
}
