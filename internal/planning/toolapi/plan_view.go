package toolapi

import (
	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// planView is the budget plan of the month (budget plan amendment A129): the reference income
// less installments, savings, goal deposits and the counted budgets is the unassigned amount.
// GoalDeposits is absent at zero (planning coherence A253).
type planView struct {
	Source         string        `json:"source"`
	ExpectedIncome tool.Money    `json:"expected_income,omitzero"`
	AverageIncome  tool.Money    `json:"average_income,omitzero"`
	AverageMonths  int           `json:"average_months,omitzero"`
	Reference      tool.Money    `json:"reference,omitzero"`
	Installments   tool.Money    `json:"installments"`
	Savings        tool.Money    `json:"savings"`
	GoalDeposits   tool.Money    `json:"goal_deposits,omitzero"`
	Planned        tool.Money    `json:"planned"`
	Unassigned     tool.Money    `json:"unassigned,omitzero"`
	Rows           []planRowView `json:"rows"`
	// Buckets is the income split with each bucket's target, planned and spent amounts (A230).
	Buckets []planBucketView `json:"buckets,omitzero"`
	// BucketsFrom is the start month of the version that holds Buckets (A240).
	BucketsFrom string `json:"buckets_from,omitzero"`
	// OutsideCategories lists the open expense categories in no bucket of the split (A236).
	OutsideCategories []outsideCategory `json:"outside_categories,omitzero"`
}

// toPlanView leaves a figure the plan does not have at its zero value, which the output omits.
func toPlanView(p app.Plan, accounts map[uuid.UUID]Account) (planView, error) {
	m := func(amount int64) (tool.Money, error) { return moneyOf(amount, p.Currency) }
	optional := func(v *int64) (tool.Money, error) {
		if v == nil {
			return tool.Money{}, nil
		}

		return m(*v)
	}
	out := planView{Source: string(p.Reference.Source), AverageMonths: p.AverageMonths}

	var err error
	if out.ExpectedIncome, err = optional(p.Expected); err != nil {
		return planView{}, err
	}

	if out.AverageIncome, err = optional(p.Average); err != nil {
		return planView{}, err
	}

	if out.Reference, out.Unassigned, err = planReference(p); err != nil {
		return planView{}, err
	}

	for _, f := range []struct {
		amount int64
		into   *tool.Money
	}{{p.Installments, &out.Installments}, {p.Savings, &out.Savings}, {p.Planned, &out.Planned}} {
		if *f.into, err = m(f.amount); err != nil {
			return planView{}, err
		}
	}

	if p.GoalDeposits != 0 {
		if out.GoalDeposits, err = m(p.GoalDeposits); err != nil {
			return planView{}, err
		}
	}

	if out.Rows, err = planRowViews(p, accounts); err != nil {
		return planView{}, err
	}

	if out.Buckets, err = planBucketViews(p, accounts); err != nil {
		return planView{}, err
	}

	out.BucketsFrom = planBucketsFrom(p)
	out.OutsideCategories = outsideCategoryViews(p, accounts)

	return out, nil
}

// planReference returns the reference amount of the plan and what is left to assign; zero
// values without a reference.
func planReference(p app.Plan) (reference, unassigned tool.Money, err error) {
	ref, ok := p.ReferenceAmount()
	if !ok {
		return tool.Money{}, tool.Money{}, nil
	}

	rest, _ := p.Unassigned()

	if reference, err = moneyOf(ref, p.Currency); err != nil {
		return tool.Money{}, tool.Money{}, err
	}

	unassigned, err = moneyOf(rest, p.Currency)

	return reference, unassigned, err
}
