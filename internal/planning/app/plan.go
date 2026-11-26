package app

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// BudgetPlan returns the plan of month for the book.
func (s *Service) BudgetPlan(ctx context.Context, booksID int64, month time.Time) (Plan, error) {
	month = domain.MonthOf(month)
	if month.After(s.horizon(ctx)) {
		return Plan{}, &domain.FieldError{
			Field:   "month",
			Message: "must be at most today + 12 months",
			Err:     domain.ErrValidation,
		}
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

	accounts, err := s.classifyAccounts(ctx, booksID, month, facts, &out)
	if err != nil {
		return Plan{}, err
	}

	totals, err := s.loadLedgerTotals(ctx, booksID, month, accounts.flow)
	if err != nil {
		return Plan{}, err
	}

	budgets, err := s.expenseBudgets(ctx, booksID, accounts.expense)
	if err != nil {
		return Plan{}, err
	}

	out.Rows, out.AverageMonths = planRows(month, accounts, totals, budgets)
	out.Planned = sumPlanned(out.Rows)
	applyIncomeHistory(&out, totals.income, month)

	if err := s.addPlanFigures(ctx, booksID, &out, accounts, totals); err != nil {
		return Plan{}, err
	}

	return out, nil
}

// addPlanFigures adds the month's occurrences, the reference and the bucket figures to out.
func (s *Service) addPlanFigures(
	ctx context.Context,
	booksID int64,
	out *Plan,
	accounts planAccounts,
	totals ledgerTotals,
) error {
	if err := s.planOccurrences(ctx, booksID, out, accounts.facts); err != nil {
		return err
	}

	if err := s.resolveReference(ctx, booksID, out); err != nil {
		return err
	}

	return s.planBuckets(ctx, booksID, out, accounts, totals.own)
}

// planAccounts holds the accounts of the book that the plan reads.
type planAccounts struct {
	facts      []Account
	categories []domain.PlanCategory
	flow       []uuid.UUID
	expense    map[uuid.UUID]bool
}

// classifyAccounts splits the accounts into expense categories and income and expense flow
// accounts, and adds the prior installments of the base-currency credit cards to out.
func (s *Service) classifyAccounts(
	ctx context.Context,
	booksID int64,
	month time.Time,
	facts []Account,
	out *Plan,
) (planAccounts, error) {
	accounts := planAccounts{facts: facts}

	accounts.expense = make(map[uuid.UUID]bool)
	for _, a := range facts {
		switch {
		case a.Class == "expense":
			accounts.categories = append(
				accounts.categories,
				domain.PlanCategory{ID: a.ID, ParentID: a.ParentID, Open: !a.Closed},
			)
			accounts.expense[a.ID] = true
			accounts.flow = append(accounts.flow, a.ID)
		case a.Class == "income":
			accounts.flow = append(accounts.flow, a.ID)
		case a.Kind == "credit_card" && a.Instrument == out.Currency:
			items, err := s.ledger.PriorInstallments(ctx, booksID, a.ID, month)
			if err != nil {
				return planAccounts{}, err
			}

			for _, in := range items {
				out.Installments += in.Amount
			}

			out.InstallmentItems = append(out.InstallmentItems, items...)
		}
	}

	return accounts, nil
}

// ledgerTotals holds the ledger reads of the plan.
type ledgerTotals struct {
	own, income map[uuid.UUID]map[time.Time]int64
	first       time.Time
	hasPostings bool
}

// loadLedgerTotals reads the own postings of the three months before month and of month, by
// category, and the first posting of the flow accounts.
func (s *Service) loadLedgerTotals(
	ctx context.Context,
	booksID int64,
	month time.Time,
	flowAccounts []uuid.UUID,
) (ledgerTotals, error) {
	from, to := month.AddDate(0, -3, 0), month.AddDate(0, 1, 0)

	own, err := s.ledger.OwnCategoryMonthlyTotals(ctx, booksID, "expense", from, to)
	if err != nil {
		return ledgerTotals{}, err
	}

	income, err := s.ledger.OwnCategoryMonthlyTotals(ctx, booksID, "income", from, to)
	if err != nil {
		return ledgerTotals{}, err
	}

	first, hasPostings, err := s.ledger.FirstPosting(ctx, booksID, flowAccounts)
	if err != nil {
		return ledgerTotals{}, err
	}

	return ledgerTotals{own: own, income: income, first: first, hasPostings: hasPostings}, nil
}

// expenseBudgets returns the budgets of the expense categories.
func (s *Service) expenseBudgets(
	ctx context.Context,
	booksID int64,
	expense map[uuid.UUID]bool,
) ([]domain.Budget, error) {
	budgets, err := s.repo.Budgets(ctx, booksID)
	if err != nil {
		return nil, err
	}

	var expenseBudgets []domain.Budget
	for _, b := range budgets {
		if expense[b.CategoryID] {
			expenseBudgets = append(expenseBudgets, b)
		}
	}

	return expenseBudgets, nil
}

// sumPlanned adds the planned amount of the rows that count.
func sumPlanned(rows []domain.PlanRow) int64 {
	var planned int64
	for _, r := range rows {
		if r.Counted {
			planned += r.Planned
		}
	}

	return planned
}

// planRows computes the rows of the plan and the number of months its averages span.
func planRows(
	month time.Time,
	accounts planAccounts,
	totals ledgerTotals,
	budgets []domain.Budget,
) ([]domain.PlanRow, int) {
	return domain.PlanRows(domain.PlanInput{
		Month:        month,
		Categories:   accounts.categories,
		Budgets:      budgets,
		Own:          totals.own,
		FirstPosting: totals.first,
		HasPostings:  totals.hasPostings,
	})
}

// applyIncomeHistory sets out.Received and the average income of the months the average spans.
// Income postings are negative; the plan reads earnings as positive.
func applyIncomeHistory(out *Plan, income map[uuid.UUID]map[time.Time]int64, month time.Time) {
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
}

// resolveReference sets out.Reference to the stored one, or to the source the plan data implies.
func (s *Service) resolveReference(ctx context.Context, booksID int64, out *Plan) error {
	ref, stored, err := s.repo.BudgetReference(ctx, booksID)
	if err != nil {
		return err
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

	return nil
}

// planOccurrences adds the month's income occurrences and planned movements that are expected
// or realized, valued in the base currency at today's prices (A72).
func (s *Service) planOccurrences(
	ctx context.Context,
	booksID int64,
	out *Plan,
	facts []Account,
) error {
	sets, err := s.accountSets(ctx, booksID, facts)
	if err != nil {
		return err
	}

	schedules, err := s.repo.Schedules(ctx, booksID)
	if err != nil {
		return err
	}

	byID := indexSchedules(schedules)
	if slices.ContainsFunc(
		schedules,
		func(sch domain.Schedule) bool { return sch.Kind == domain.Income },
	) {
		out.Expected = new(int64)
	}

	os, err := s.repo.Occurrences(ctx, booksID, out.Month, out.Month.AddDate(0, 1, -1), uuid.Nil)
	if err != nil {
		return err
	}

	received, err := s.receivedIncome(ctx, booksID, os, byID)
	if err != nil {
		return err
	}

	return s.addOccurrences(ctx, out, os, byID, received, sets)
}

// addOccurrences adds the income occurrences and the planned movements of os to the plan.
func (s *Service) addOccurrences(
	ctx context.Context,
	out *Plan,
	os []domain.Occurrence,
	byID map[uuid.UUID]domain.Schedule,
	received map[uuid.UUID]int64,
	sets accountSets,
) error {
	today := s.clk.Today(ctx)

	items := make(map[uuid.UUID]int)
	for _, o := range os {
		sch := byID[o.ScheduleID]
		if (o.State != domain.Expected && o.State != domain.Realized) ||
			(sch.Kind != domain.Income && !movesMoney(sch.Kind)) {
			continue
		}

		base := o.Amount
		if actual, ok := received[o.ID]; ok {
			base = actual
		}

		amount, err := s.occurrenceAmount(ctx, out, sch, base, today)
		if err != nil {
			return err
		}

		if movesMoney(sch.Kind) {
			addPlannedMovement(out, sets, sch, amount)
			continue
		}

		addIncomeItem(out, items, sch, amount)
	}

	return nil
}

// indexSchedules keys the schedules by id.
func indexSchedules(schedules []domain.Schedule) map[uuid.UUID]domain.Schedule {
	byID := make(map[uuid.UUID]domain.Schedule, len(schedules))
	for _, sch := range schedules {
		byID[sch.ID] = sch
	}

	return byID
}

// occurrenceAmount values base in the base currency at today's prices and records the prices
// used in out.
func (s *Service) occurrenceAmount(
	ctx context.Context,
	out *Plan,
	sch domain.Schedule,
	base int64,
	today time.Time,
) (int64, error) {
	if sch.Currency == out.Currency {
		return base, nil
	}

	m, err := money.New(base, sch.Currency)
	if err != nil {
		return 0, err
	}

	v, used, err := s.prices.Convert(ctx, m, out.Currency, today)
	if err != nil {
		return 0, err
	}

	out.Prices = append(out.Prices, used...)

	return v.Amount(), nil
}

// addIncomeItem adds amount to the expected income total and to the item of its schedule.
func addIncomeItem(out *Plan, items map[uuid.UUID]int, sch domain.Schedule, amount int64) {
	*out.Expected += amount

	i, ok := items[sch.ID]
	if !ok {
		i = len(out.ExpectedItems)
		items[sch.ID] = i
		out.ExpectedItems = append(
			out.ExpectedItems,
			PlanIncome{ScheduleID: sch.ID, Description: sch.Description},
		)
	}

	out.ExpectedItems[i].Amount += amount
}
