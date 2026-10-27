package httpapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func toBudgetPlanAPI(p app.Plan) BudgetPlan {
	m := func(amount int64) Money { return toMoneyAPI(amount, p.Currency) }
	optional := func(v *int64) *Money {
		if v == nil {
			return nil
		}
		out := m(*v)
		return &out
	}
	out := BudgetPlan{
		Month: p.Month.Format(monthLayout), Currency: string(p.Currency), Source: BudgetPlanSource(p.Reference.Source),
		ExpectedIncome: optional(p.Expected), AverageIncome: optional(p.Average),
		ReceivedIncome: m(p.Received), Installments: m(p.Installments), Savings: m(p.Savings), Planned: m(p.Planned),
		Prices: toPricesAPI(p.Prices), Rows: make([]BudgetPlanRow, len(p.Rows)),
	}
	if p.Reference.HasFixed {
		out.Fixed = optional(&p.Reference.Fixed)
	}
	if len(p.ExpectedItems) > 0 {
		items := make([]BudgetPlanIncome, len(p.ExpectedItems))
		for i, x := range p.ExpectedItems {
			items[i] = BudgetPlanIncome{ScheduleId: x.ScheduleID, Description: x.Description, Amount: m(x.Amount)}
		}
		out.ExpectedItems = &items
	}
	if p.AverageMonths > 0 {
		out.AverageMonths = &p.AverageMonths
	}
	if ref, ok := p.ReferenceAmount(); ok {
		out.Reference = optional(&ref)
		rest, _ := p.Unassigned()
		out.Unassigned = optional(&rest)
	}
	for i, r := range p.Rows {
		row := BudgetPlanRow{CategoryId: r.CategoryID, Planned: m(r.Planned), LastMonth: m(r.LastMonth), Average: m(r.Average), Counted: r.Counted}
		if r.BudgetID != uuid.Nil {
			row.BudgetId = &r.BudgetID
		}
		if r.HasNextChange {
			next := r.NextChange.Format(monthLayout)
			row.NextChange = &next
		}
		out.Rows[i] = row
	}
	return out
}

func (s *Server) GetBudgetPlan(ctx context.Context, req GetBudgetPlanRequestObject) (GetBudgetPlanResponseObject, error) {
	month, err := parseMonth("month", req.Params.Month)
	if err != nil {
		return nil, err
	}
	p, err := s.svc.BudgetPlan(ctx, auth.MustUserID(ctx), month)
	if err != nil {
		return nil, err
	}
	return GetBudgetPlan200JSONResponse(toBudgetPlanAPI(p)), nil
}
