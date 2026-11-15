package httpapi

import (
	"context"
	"fmt"
	"net/http"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
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
		Month: p.Month.Format(
			monthLayout,
		),
		Currency:       string(p.Currency),
		Source:         BudgetPlanSource(p.Reference.Source),
		ExpectedIncome: optional(p.Expected),
		AverageIncome:  optional(p.Average),
		ReceivedIncome: m(
			p.Received,
		),
		Installments: m(p.Installments),
		Savings:      m(p.Savings),
		Planned:      m(p.Planned),
		Prices:       toPricesAPI(p.Prices),
		Rows:         make([]BudgetPlanRow, len(p.Rows)),
	}
	if p.Reference.HasFixed {
		out.Fixed = optional(&p.Reference.Fixed)
	}

	if len(p.ExpectedItems) > 0 {
		items := planIncomeAPI(p.ExpectedItems, m)
		out.ExpectedItems = &items
	}

	setPlanSettings(&out, p)
	setPlanSavings(&out, p, optional)
	setPlanReference(&out, p, optional)
	setPlanBuckets(&out, p, m)

	for i, r := range p.Rows {
		out.Rows[i] = toBudgetPlanRowAPI(r, m)
	}

	return out
}

func setPlanSettings(out *BudgetPlan, p app.Plan) {
	if p.AverageMonths > 0 {
		out.AverageMonths = &p.AverageMonths
	}

	if p.Reference.HasTarget {
		out.SavingsTargetBp = &p.Reference.TargetBP
	}
}

func planIncomeAPI(items []app.PlanIncome, m func(int64) Money) []BudgetPlanIncome {
	out := make([]BudgetPlanIncome, len(items))
	for i, x := range items {
		out[i] = BudgetPlanIncome{
			ScheduleId:  x.ScheduleID,
			Description: x.Description,
			Amount:      m(x.Amount),
		}
	}

	return out
}

func setPlanSavings(out *BudgetPlan, p app.Plan, optional func(*int64) *Money) {
	if rate, ok := p.SavingsRate(); ok {
		out.SavingsRateBp = &rate
	}

	if target, ok := p.SavingsTarget(); ok {
		out.SavingsTarget = optional(&target)
		gap, _ := p.SavingsGap()
		out.SavingsGap = optional(&gap)
	}
}

func setPlanReference(out *BudgetPlan, p app.Plan, optional func(*int64) *Money) {
	if ref, ok := p.ReferenceAmount(); ok {
		out.Reference = optional(&ref)
		rest, _ := p.Unassigned()
		out.Unassigned = optional(&rest)
	}
}

func toBudgetPlanRowAPI(r domain.PlanRow, m func(int64) Money) BudgetPlanRow {
	row := BudgetPlanRow{
		CategoryId: r.CategoryID,
		Planned:    m(r.Planned),
		LastMonth:  m(r.LastMonth),
		Average:    m(r.Average),
		Counted:    r.Counted,
	}
	if r.BudgetID != uuid.Nil {
		row.BudgetId = &r.BudgetID
	}

	if r.HasNextChange {
		next := r.NextChange.Format(monthLayout)
		row.NextChange = &next
	}

	return row
}

func (s *Server) getBudgetPlan(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (BudgetPlan, error) {
	params, err := httpserver.Query[GetBudgetPlanParams](r)
	if err != nil {
		return BudgetPlan{}, err
	}

	month, err := parseMonth("month", params.Month)
	if err != nil {
		return BudgetPlan{}, err
	}

	p, err := s.svc.BudgetPlan(ctx, auth.MustBooksID(ctx), month)
	if err != nil {
		return BudgetPlan{}, err
	}

	return toBudgetPlanAPI(p), nil
}

func (s *Server) saveBudgetPlan(
	ctx context.Context,
	r *http.Request,
	in SaveBudgetPlanJSONRequestBody,
) (BudgetPlan, error) {
	params, err := httpserver.Query[SaveBudgetPlanParams](r)
	if err != nil {
		return BudgetPlan{}, err
	}

	month, err := parseMonth("month", params.Month)
	if err != nil {
		return BudgetPlan{}, err
	}

	var fixed *money.Money
	if in.Fixed != nil {
		m, err := fromMoneyAPI("fixed", *in.Fixed)
		if err != nil {
			return BudgetPlan{}, err
		}

		fixed = &m
	}

	amounts := make([]app.PlanAmount, len(in.Amounts))
	for i, a := range in.Amounts {
		m, err := fromMoneyAPI(fmt.Sprintf("amounts[%d].amount", i), a.Amount)
		if err != nil {
			return BudgetPlan{}, err
		}

		amounts[i] = app.PlanAmount{CategoryID: a.CategoryId, Amount: m}
	}

	p, err := s.svc.SaveBudgetPlan(
		ctx,
		auth.MustBooksID(ctx),
		month,
		domain.ReferenceSource(in.Source),
		fixed,
		in.SavingsTargetBp,
		amounts,
	)
	if err != nil {
		return BudgetPlan{}, err
	}

	return toBudgetPlanAPI(p), nil
}
