package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

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
		if o.State != domain.Realized || !ok || schedules[o.ScheduleID].Kind != domain.Income {
			continue
		}

		if amount, found := domain.ActualAmount(t, schedules[o.ScheduleID]); found {
			out[o.ID] = amount
		}
	}

	return out, nil
}
