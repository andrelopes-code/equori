package app

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// basisPoints is the denominator of the shares of a plan: 10000 basis points are the whole.
const basisPoints = 10000

// Plan is the budget plan of a month (budget plan amendments A129 and A131). Expected is nil
// when the book has no income schedule and Average when no month of history exists.
type Plan struct {
	Month                                    time.Time
	Currency                                 money.Currency
	Reference                                domain.Reference
	Expected                                 *int64
	ExpectedItems                            []PlanIncome
	Average                                  *int64
	AverageMonths                            int
	Received, Installments, Savings, Planned int64
	Rows                                     []domain.PlanRow
	Prices                                   []Price
}

// PlanIncome is the income a schedule expects in the month.
type PlanIncome struct {
	ScheduleID  uuid.UUID
	Description string
	Amount      int64
}

// ReferenceAmount is the figure of the chosen source; false when the source has none.
func (p Plan) ReferenceAmount() (int64, bool) {
	switch p.Reference.Source {
	case domain.SourceExpectedIncome:
		if p.Expected != nil {
			return *p.Expected, true
		}
	case domain.SourceAverageIncome:
		if p.Average != nil {
			return *p.Average, true
		}
	case domain.SourceFixed:
		return p.Reference.Fixed, p.Reference.HasFixed
	}

	return 0, false
}

// Unassigned is reference − installments − savings − planned; false without a reference.
func (p Plan) Unassigned() (int64, bool) {
	ref, ok := p.ReferenceAmount()
	return ref - p.Installments - p.Savings - p.Planned, ok
}

// SavingsRate is savings as basis points of the reference, truncated; false unless the
// reference is above zero (A188).
func (p Plan) SavingsRate() (int, bool) {
	ref, ok := p.ReferenceAmount()
	if !ok || ref <= 0 {
		return 0, false
	}

	return int(p.Savings/ref*basisPoints + p.Savings%ref*basisPoints/ref), true
}

// SavingsTarget is the reference times the stored target, rounded half up; false without a
// target or a reference above zero (A188).
func (p Plan) SavingsTarget() (int64, bool) {
	ref, ok := p.ReferenceAmount()
	if !ok || ref <= 0 || !p.Reference.HasTarget {
		return 0, false
	}

	// ref = q×10000 + r keeps the product within int64.
	bp := int64(p.Reference.TargetBP)

	return ref/basisPoints*bp + (ref%basisPoints*bp+basisPoints/2)/basisPoints, true
}

// SavingsGap is what the target still lacks of the month's savings, never below zero (A188).
func (p Plan) SavingsGap() (int64, bool) {
	target, ok := p.SavingsTarget()
	if !ok {
		return 0, false
	}

	return max(target-p.Savings, 0), true
}

// BudgetPlan returns the plan of month for the book.
func (s *Service) BudgetPlan(ctx context.Context, booksID int64, month time.Time) (Plan, error) {
	month = domain.MonthOf(month)
	if month.After(s.horizon(ctx)) {
		return Plan{}, &domain.FieldError{Field: "month", Message: "must be at most today + 12 months", Err: domain.ErrValidation}
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return Plan{}, err
	}

	out := Plan{Month: month, Currency: base}

	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return Plan{}, err
	}

	var categories []domain.PlanCategory
	var flowAccounts []uuid.UUID

	expense := make(map[uuid.UUID]bool)
	for _, a := range facts {
		switch {
		case a.Class == "expense":
			categories = append(categories, domain.PlanCategory{ID: a.ID, ParentID: a.ParentID, Open: !a.Closed})
			expense[a.ID] = true
			flowAccounts = append(flowAccounts, a.ID)
		case a.Class == "income":
			flowAccounts = append(flowAccounts, a.ID)
		case a.Kind == "credit_card" && a.Instrument == base:
			c, err := s.ledger.PriorInstallments(ctx, booksID, a.ID, month)
			if err != nil {
				return Plan{}, err
			}

			out.Installments += c
		}
	}

	from, to := month.AddDate(0, -3, 0), month.AddDate(0, 1, 0)

	own, err := s.ledger.OwnCategoryMonthlyTotals(ctx, booksID, "expense", from, to)
	if err != nil {
		return Plan{}, err
	}

	income, err := s.ledger.OwnCategoryMonthlyTotals(ctx, booksID, "income", from, to)
	if err != nil {
		return Plan{}, err
	}

	first, hasPostings, err := s.ledger.FirstPosting(ctx, booksID, flowAccounts)
	if err != nil {
		return Plan{}, err
	}

	budgets, err := s.repo.Budgets(ctx, booksID)
	if err != nil {
		return Plan{}, err
	}

	var expenseBudgets []domain.Budget
	for _, b := range budgets {
		if expense[b.CategoryID] {
			expenseBudgets = append(expenseBudgets, b)
		}
	}

	out.Rows, out.AverageMonths = domain.PlanRows(domain.PlanInput{
		Month: month, Categories: categories, Budgets: expenseBudgets, Own: own, FirstPosting: first, HasPostings: hasPostings,
	})
	for _, r := range out.Rows {
		if r.Counted {
			out.Planned += r.Planned
		}
	}

	// Income postings are negative; the plan reads earnings as positive.
	var history int64
	for _, byMonth := range income {
		out.Received -= byMonth[month]
		for i := 1; i <= out.AverageMonths; i++ {
			history -= byMonth[month.AddDate(0, -i, 0)]
		}
	}

	if out.AverageMonths > 0 {
		average := domain.Divide(history, out.AverageMonths)
		out.Average = &average
	}

	if err := s.planOccurrences(ctx, booksID, &out); err != nil {
		return Plan{}, err
	}

	ref, stored, err := s.repo.BudgetReference(ctx, booksID)
	if err != nil {
		return Plan{}, err
	}

	if !stored {
		switch {
		case out.Expected != nil:
			ref.Source = domain.SourceExpectedIncome
		case out.Average != nil:
			ref.Source = domain.SourceAverageIncome
		default:
			ref.Source = domain.SourceFixed
		}
	}

	out.Reference = ref

	return out, nil
}

// planOccurrences adds the month's income and savings occurrences that are expected or
// realized, valued in the base currency at today's prices (A72).
func (s *Service) planOccurrences(ctx context.Context, booksID int64, out *Plan) error {
	schedules, err := s.repo.Schedules(ctx, booksID)
	if err != nil {
		return err
	}

	byID := make(map[uuid.UUID]domain.Schedule, len(schedules))
	for _, sch := range schedules {
		byID[sch.ID] = sch
		if sch.Kind == domain.Income && out.Expected == nil {
			out.Expected = new(int64)
		}
	}

	os, err := s.repo.Occurrences(ctx, booksID, out.Month, out.Month.AddDate(0, 1, -1), uuid.Nil)
	if err != nil {
		return err
	}

	received, err := s.receivedIncome(ctx, booksID, os, byID)
	if err != nil {
		return err
	}

	today := s.clk.Today(ctx)

	items := make(map[uuid.UUID]int)
	for _, o := range os {
		sch := byID[o.ScheduleID]
		if (o.State != domain.Expected && o.State != domain.Realized) || (sch.Kind != domain.Income && sch.Kind != domain.Savings) {
			continue
		}

		base := o.Amount
		if actual, ok := received[o.ID]; ok {
			base = actual
		}

		amount := base
		if sch.Currency != out.Currency {
			m, err := money.New(base, sch.Currency)
			if err != nil {
				return err
			}

			v, used, err := s.prices.Convert(ctx, m, out.Currency, today)
			if err != nil {
				return err
			}

			amount, out.Prices = v.Amount(), append(out.Prices, used...)
		}

		if sch.Kind == domain.Savings {
			out.Savings += amount
			continue
		}

		*out.Expected += amount

		i, ok := items[sch.ID]
		if !ok {
			i = len(out.ExpectedItems)
			items[sch.ID] = i
			out.ExpectedItems = append(out.ExpectedItems, PlanIncome{ScheduleID: sch.ID, Description: sch.Description})
		}

		out.ExpectedItems[i].Amount += amount
	}

	return nil
}

// receivedIncome returns, by occurrence id, the amount each realized income occurrence moved,
// read with one TransactionFacts call; an occurrence whose transaction is missing from the
// facts has no entry.
func (s *Service) receivedIncome(
	ctx context.Context,
	booksID int64,
	occurrences []domain.Occurrence,
	schedules map[uuid.UUID]domain.Schedule,
) (map[uuid.UUID]int64, error) {
	var ids []uuid.UUID
	for _, o := range occurrences {
		if o.State == domain.Realized && schedules[o.ScheduleID].Kind == domain.Income {
			ids = append(ids, o.TransactionID)
		}
	}

	if len(ids) == 0 {
		return nil, nil
	}

	facts, err := s.ledger.TransactionFacts(ctx, booksID, ids)
	if err != nil {
		return nil, err
	}

	byID := make(map[uuid.UUID]domain.Transaction, len(facts))
	for _, t := range facts {
		byID[t.ID] = t
	}

	out := make(map[uuid.UUID]int64, len(ids))

	for _, o := range occurrences {
		t, ok := byID[o.TransactionID]
		if o.State != domain.Realized || !ok {
			continue
		}

		if amount, found := domain.ActualAmount(t, schedules[o.ScheduleID]); found {
			out[o.ID] = amount
		}
	}

	return out, nil
}

// PlanAmount is the amount a plan save sets on a category from its month on.
type PlanAmount struct {
	CategoryID uuid.UUID
	Amount     money.Money
}

// SaveBudgetPlan stores the reference choice and sets each listed category's amount from month
// on, in one transaction (A130): the version of month is replaced, a category without a budget
// gets one when its amount is above zero, and versions of other months stay.
// fixed is read only with SourceFixed. targetBP is the savings target in basis points; nil
// clears it (A187).
func (s *Service) SaveBudgetPlan(
	ctx context.Context,
	booksID int64,
	month time.Time,
	source domain.ReferenceSource,
	fixed *money.Money,
	targetBP *int,
	amounts []PlanAmount,
) (Plan, error) {
	month = domain.MonthOf(month)
	if month.Before(domain.MonthOf(s.clk.Today(ctx))) || month.After(s.horizon(ctx)) {
		return Plan{}, &domain.FieldError{Field: "month", Message: "must be from the current month to today + 12 months", Err: domain.ErrValidation}
	}

	if targetBP != nil && (*targetBP < 0 || *targetBP > basisPoints) {
		return Plan{}, &domain.FieldError{Field: "savings_target_bp", Message: "must be from 0 to 10000", Err: domain.ErrValidation}
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return Plan{}, err
	}

	ref := domain.Reference{Source: source}
	if targetBP != nil {
		ref.TargetBP, ref.HasTarget = *targetBP, true
	}

	if source == domain.SourceFixed {
		if fixed == nil {
			return Plan{}, &domain.FieldError{Field: "fixed", Message: "is required with the fixed source", Err: domain.ErrValidation}
		}

		if err := checkBudgetAmount(*fixed, base); err != nil {
			if fe, ok := errors.AsType[*domain.FieldError](err); ok {
				fe.Field = "fixed" + strings.TrimPrefix(fe.Field, "amount")
			}

			return Plan{}, err
		}

		ref.Fixed, ref.HasFixed = fixed.Amount(), true
	}

	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return Plan{}, err
	}

	byID := make(map[uuid.UUID]Account, len(facts))
	for _, a := range facts {
		byID[a.ID] = a
	}

	seen := make(map[uuid.UUID]bool, len(amounts))
	for i, a := range amounts {
		prefix := fmt.Sprintf("amounts[%d].", i)
		if c, ok := byID[a.CategoryID]; !ok || c.Class != "expense" || c.Closed {
			return Plan{}, &domain.FieldError{Field: prefix + "category_id", Message: "must be an open expense category of the book", Err: domain.ErrValidation}
		}

		if seen[a.CategoryID] {
			return Plan{}, &domain.FieldError{Field: prefix + "category_id", Message: "is listed twice", Err: domain.ErrValidation}
		}

		seen[a.CategoryID] = true
		if err := checkBudgetAmount(a.Amount, base); err != nil {
			if fe, ok := errors.AsType[*domain.FieldError](err); ok {
				fe.Field = prefix + fe.Field
			}

			return Plan{}, err
		}
	}

	err = s.repo.InTx(ctx, func(repo Repository) error {
		budgets, err := repo.Budgets(ctx, booksID)
		if err != nil {
			return err
		}

		byCategory := make(map[uuid.UUID]uuid.UUID, len(budgets))
		for _, b := range budgets {
			byCategory[b.CategoryID] = b.ID
		}

		for _, a := range amounts {
			version := domain.BudgetAmount{EffectiveFrom: month, Amount: a.Amount.Amount()}

			id, ok := byCategory[a.CategoryID]
			if !ok {
				if version.Amount == 0 {
					continue
				}

				b := domain.Budget{CategoryID: a.CategoryID, Currency: base, Amounts: []domain.BudgetAmount{version}}
				if _, err := repo.InsertBudget(ctx, booksID, b); err != nil {
					return err
				}

				continue
			}

			if _, err := repo.LockBudget(ctx, booksID, id); err != nil {
				return err
			}

			if err := repo.UpsertBudgetAmount(ctx, booksID, id, version); err != nil {
				return err
			}
		}

		return repo.SaveBudgetReference(ctx, booksID, ref, base)
	})
	if err != nil {
		return Plan{}, err
	}

	return s.BudgetPlan(ctx, booksID, month)
}
