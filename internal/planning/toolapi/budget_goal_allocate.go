package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// goalAccountLists splits the accounts of a goal into the ones held whole and the ones held by
// allocations: all of one kind, by the allocated flag (planning coherence A255).
func goalAccountLists(in manageBudgetOrGoalIn, p budgetGoalPlan) (whole, allocated []uuid.UUID) {
	if in.Allocated {
		return []uuid.UUID{}, p.accountIDs
	}

	return p.accountIDs, []uuid.UUID{}
}

// loadAllocation reads the goal and returns the currency of the one account an allocation names.
func loadAllocation(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	p *budgetGoalPlan,
	accounts map[uuid.UUID]Account,
) (money.Currency, error) {
	if len(p.accountIDs) != 1 {
		return "", validationError("account_ids", "must name the one account to allocate from")
	}

	var err error
	if p.goal, err = svc.Goal(ctx, booksID, p.goalID); err != nil {
		return "", err
	}

	return accounts[p.accountIDs[0]].Instrument, nil
}

// parseAllocationAmount reads a signed amount: a negative one releases what a goal holds.
func parseAllocationAmount(amount string, currency money.Currency) (*money.Money, error) {
	unit, err := unitOf(currency)
	if err != nil {
		return nil, err
	}

	m, err := tool.ParseAmount("amount", amount, unit)
	if err != nil {
		return nil, err
	}

	return &m, nil
}

// previewAllocation shows the account and the amount an allocation assigns to the goal.
func previewAllocation(pv *tool.Preview, p budgetGoalPlan) {
	pv.Target = p.goal.Name
	pv.Changes = []tool.Change{
		{Field: "account", After: tool.TextValue(p.accountNames[0])},
		{Field: "amount", After: tool.MoneyValue(*p.amount)},
	}
}
