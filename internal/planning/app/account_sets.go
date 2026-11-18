package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// AccountSet names the set an asset or liability account belongs to (planning coherence A250).
type AccountSet string

const (
	SetSpending AccountSet = "spending"
	SetSavings  AccountSet = "savings"
	SetGoals    AccountSet = "goals"
)

// accountSets holds the goal set and the savings set of a book; every other asset and liability
// account is in the spending set (A250).
type accountSets struct {
	goals, savings map[uuid.UUID]bool
	facts          map[uuid.UUID]Account
	// byGoal is the set that takes what is allocated to each goal: the goal set, or the savings
	// set for a goal that counts as savings (A255).
	byGoal map[uuid.UUID]AccountSet
	names  map[uuid.UUID]string
}

// accountSets returns the sets of the book's accounts.
func (s *Service) accountSets(
	ctx context.Context,
	booksID int64,
	facts []Account,
) (accountSets, error) {
	all, err := s.allGoals(ctx, booksID)
	if err != nil {
		return accountSets{}, err
	}

	goals, savings := goalAccounts(all, facts)
	out := accountSets{
		goals:   goals,
		savings: savings,
		facts:   make(map[uuid.UUID]Account),
		byGoal:  make(map[uuid.UUID]AccountSet, len(all)),
		names:   make(map[uuid.UUID]string, len(all)),
	}

	for _, g := range all {
		out.byGoal[g.ID], out.names[g.ID] = SetGoals, g.Name
		if g.CountsAsSavings {
			out.byGoal[g.ID] = SetSavings
		}
	}

	for _, a := range facts {
		out.facts[a.ID] = a
		if a.Class == "asset" && isSavingsKind(a.Kind) && !goals[a.ID] {
			savings[a.ID] = true
		}
	}

	return out, nil
}

// of returns the set of an asset or liability account; false for any other account.
func (a accountSets) of(id uuid.UUID) (AccountSet, bool) {
	f, known := a.facts[id]

	switch {
	case !known || (f.Class != "asset" && f.Class != "liability"):
		return "", false
	case a.goals[id]:
		return SetGoals, true
	case a.savings[id]:
		return SetSavings, true
	default:
		return SetSpending, true
	}
}

// movementCounterparts returns the accounts whose postings count as a movement into or out of
// held (A251): the asset and liability accounts in base outside held, the expense categories and
// the income categories, except the ones that record a price change or a correction.
func movementCounterparts(
	facts []Account,
	held map[uuid.UUID]bool,
	base money.Currency,
) map[uuid.UUID]bool {
	out := make(map[uuid.UUID]bool)

	for _, f := range facts {
		if held[f.ID] || f.Instrument != base {
			continue
		}

		switch f.Class {
		case "asset", "liability":
			out[f.ID] = true
		case "expense":
			out[f.ID] = isSpendingRole(f.SystemRole)
		case "income":
			out[f.ID] = !isRetainedRole(f.SystemRole)
		}
	}

	return out
}

// isSpendingRole reports whether an expense category of the role records money spent: not a
// realized loss or a correction (A251).
func isSpendingRole(role string) bool {
	return role != "realized_losses" && role != "adjustments" && role != "opening_balances"
}

// spendingCategories returns the expense categories in base whose postings are money spent.
func spendingCategories(facts []Account, base money.Currency) map[uuid.UUID]bool {
	out := make(map[uuid.UUID]bool)

	for _, f := range facts {
		if f.Class == "expense" && f.Instrument == base && isSpendingRole(f.SystemRole) {
			out[f.ID] = true
		}
	}

	return out
}

// isRetainedRole reports whether an income category records a yield or a realized gain (A252).
func isRetainedRole(role string) bool { return role == "yield" || role == "realized_gains" }
