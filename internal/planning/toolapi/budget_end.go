package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// loadBudgetEnd reads the budget end_budget ends and what the end takes away.
func loadBudgetEnd(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	p *budgetGoalPlan,
	accounts map[uuid.UUID]Account,
) (money.Currency, error) {
	b, err := svc.Budget(ctx, booksID, p.budgetID)
	if err != nil {
		return "", err
	}

	p.budget, p.categoryName = b, accounts[b.CategoryID].Name

	removed, carried, err := svc.BudgetEndPreview(ctx, booksID, b, p.month)
	if err != nil {
		return "", err
	}

	for _, a := range removed {
		amount, err := money.New(a.Amount, b.Currency)
		if err != nil {
			return "", err
		}

		p.removed = append(p.removed, removedVersion{from: a.EffectiveFrom, amount: amount})
	}

	p.carried, err = money.New(carried, b.Currency)

	return b.Currency, err
}

// previewBudgetEnd names the budget, its last day in force, each removed version and the
// dropped balance; the end is destructive when it takes either away (budget end E20).
func previewBudgetEnd(pv *tool.Preview, p budgetGoalPlan) {
	pv.Target = p.categoryName
	pv.Changes = []tool.Change{
		{Field: "budget", Before: tool.TextValue(p.categoryName)},
		{Field: "until", After: tool.DateValue(p.month.AddDate(0, 0, -1))},
	}

	for _, v := range p.removed {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "from", Before: tool.DateValue(v.from)},
			tool.Change{Field: "amount", Before: tool.MoneyValue(v.amount)},
		)
	}

	if p.carried.Amount() > 0 {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "carried", Before: tool.MoneyValue(p.carried)},
		)
	}

	pv.Destructive = len(p.removed) > 0 || p.carried.Amount() > 0
}
