package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
)

// outsideCategory is an expense category in no bucket of the split.
type outsideCategory struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// outsideCategoryViews returns the categories outside the split of the plan with their names.
func outsideCategoryViews(p app.Plan, accounts map[uuid.UUID]Account) []outsideCategory {
	var out []outsideCategory
	for _, id := range p.OutsideCategories {
		out = append(out, outsideCategory{ID: id.String(), Name: accountName(accounts, id)})
	}

	return out
}

// loadOutsideNames reads into p the names of the categories its buckets leave outside the split;
// none when the call ends the split.
func loadOutsideNames(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	accounts map[uuid.UUID]Account,
	p *budgetGoalPlan,
) error {
	if len(p.buckets) == 0 {
		return nil
	}

	outside, err := svc.OutsideCategories(ctx, booksID, p.buckets)
	p.outsideNames = categoryNames(outside, accounts)

	return err
}
