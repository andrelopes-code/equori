package toolapi

import (
	"context"
	"fmt"
	"slices"
	"strconv"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

type contributionMemberIn struct {
	AccountID  string `json:"account_id,omitzero" jsonschema:"account that counts whole in the class, such as a fixed income Investment line or a reserve, from list_accounts; instead of instrument"`
	Instrument string `json:"instrument,omitzero" jsonschema:"code of a security, counted in every Brokerage that holds it, such as BOVA11; instead of account_id"`
	TargetBP   int    `json:"target_bp,omitzero"  jsonschema:"share of the class this member should hold, in basis points; the members of a class add up to 10000, or none of them has a target"`
}

type contributionClassIn struct {
	Name     string                 `json:"name"      jsonschema:"name of the class, 1 to 60 characters, unique in the plan"`
	TargetBP int                    `json:"target_bp" jsonschema:"share of the portfolio the class should hold, in basis points: 4000 is 40%; the classes add up to 10000"`
	Members  []contributionMemberIn `json:"members"   jsonschema:"what the class holds; a holding belongs to at most one class"`
}

type saveContributionPlanIn struct {
	Amount  string                `json:"amount,omitzero" jsonschema:"amount contributed each month as a positive decimal in the base currency; absent stores none"`
	Classes []contributionClassIn `json:"classes"         jsonschema:"every class of the plan, at most 20; the call replaces the whole plan, so repeat each class that stays; an empty list removes the plan"`
}

func saveContributionPlan(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "save_contribution_plan",
		Description: "Proposes the contribution plan of the book: the classes of the portfolio, the target share of each, the holdings of each class and the monthly amount. " +
			"It replaces the whole plan: read the current one with get_portfolio view contribution and repeat what stays. " +
			"Use it when the user defines or changes the target split or the monthly contribution. " +
			"Do not use it to see where one contribution goes: get_portfolio view contribution with amount does, and stores nothing. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in saveContributionPlanIn) (tool.Preview, error) {
		pv, _, err := planContributionSave(ctx, svc, booksID, in)
		return pv, err
	}, func(ctx context.Context, booksID int64, in saveContributionPlanIn) (contributionView, error) {
		_, p, err := planContributionSave(ctx, svc, booksID, in)
		if err != nil {
			return contributionView{}, err
		}

		v, err := svc.SaveContributionPlan(ctx, booksID, p)
		if err != nil {
			return contributionView{}, err
		}

		return contributionViewOf(v), nil
	})
}

func planContributionSave(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in saveContributionPlanIn,
) (tool.Preview, domain.Plan, error) {
	pv := tool.Preview{
		Action: "save_contribution_plan",
		Changes: []tool.Change{
			{Field: "count", After: tool.TextValue(strconv.Itoa(len(in.Classes)))},
		},
	}

	classes, err := contributionClasses(in.Classes)
	if err != nil {
		return pv, domain.Plan{}, err
	}

	p := domain.Plan{Classes: classes}
	for _, c := range in.Classes {
		pv.Items = append(pv.Items, tool.Item{
			Description: fmt.Sprintf("%s %d.%02d%%", c.Name, c.TargetBP/100, c.TargetBP%100),
		})
	}

	if in.Amount == "" {
		return pv, p, nil
	}

	// The total of the stored view carries the base currency of the book.
	current, err := svc.ContributionPlan(ctx, booksID)
	if err != nil {
		return pv, p, err
	}

	unit, err := money.New(0, current.Total.Currency())
	if err != nil {
		return pv, p, err
	}

	amount, err := tool.ParsePositive("amount", in.Amount, unit)
	if err != nil {
		return pv, p, err
	}

	p.Amount = &amount
	pv.Changes = append(pv.Changes, tool.Change{Field: "amount", After: tool.MoneyValue(amount)})

	return pv, p, nil
}

func contributionClasses(in []contributionClassIn) ([]domain.PlanClass, error) {
	out := make([]domain.PlanClass, len(in))

	for i, c := range in {
		members := make([]domain.PlanMember, len(c.Members))
		// A class has member targets when one member names a target; the others then hold 0.
		targeted := slices.ContainsFunc(c.Members, func(m contributionMemberIn) bool {
			return m.TargetBP != 0
		})

		for j, m := range c.Members {
			field := fmt.Sprintf("classes[%d].members[%d].account_id", i, j)

			id, err := optionalID(m.AccountID, field)
			if err != nil {
				return nil, err
			}

			members[j] = domain.PlanMember{AccountID: id, Instrument: money.Currency(m.Instrument)}
			if targeted {
				members[j].TargetBP = &m.TargetBP
			}
		}

		out[i] = domain.PlanClass{Name: c.Name, TargetBP: c.TargetBP, Members: members}
	}

	return out, nil
}
