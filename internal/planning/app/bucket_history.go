package app

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// bucketHistoryMonths is the window of the bucket history: the month asked and the five before.
const bucketHistoryMonths = 6

// BucketHistory is the income split of the months of the window (income buckets A233).
type BucketHistory struct {
	Currency money.Currency
	Methods  []domain.Method // the methods of the window's months, by From, each once
	Months   []BucketMonth
}

// BucketMonth holds the income received in a month, the real amount of each bucket in the order
// of the month's method and the spending outside the split. From is zero without a split.
// Unallocated is the income that no bucket and no spending took: with Real and Outside it sums
// to Received (A235). Retained is the yield and the realized gain that stayed in the investments,
// left out of Received (planning coherence A252). Covered holds, per bucket, the spending that the
// accumulated balance of rollover budgets paid; Deposited and Withdrawn hold what went into the
// goal set and what left it, for the bucket that takes goals (A254). GoalPaid holds, per bucket, the
// spending of its categories that a goal paid (A256).
type BucketMonth struct {
	Month             time.Time
	From              time.Time
	HasMethod         bool
	Received, Outside int64
	Unallocated       int64
	Retained          int64
	Real              []int64
	Covered           []int64
	GoalPaid          []int64

	Deposited, Withdrawn int64
}

// BucketHistory returns the bucket figures of month and the five months before it.
func (s *Service) BucketHistory(
	ctx context.Context,
	booksID int64,
	month time.Time,
) (BucketHistory, error) {
	month = domain.MonthOf(month)
	if err := s.checkBucketMonth(ctx, month); err != nil {
		return BucketHistory{}, err
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return BucketHistory{}, err
	}

	versions, err := s.repo.BucketMethods(ctx, booksID)
	if err != nil {
		return BucketHistory{}, err
	}

	out := BucketHistory{Currency: base}
	err = s.addBucketMonths(ctx, booksID, month, versions, &out)

	return out, err
}

// addBucketMonths reads the window's own postings and adds one BucketMonth per month to out.
func (s *Service) addBucketMonths(
	ctx context.Context,
	booksID int64,
	month time.Time,
	versions []domain.Method,
	out *BucketHistory,
) error {
	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return err
	}

	from, to := month.AddDate(0, 1-bucketHistoryMonths, 0), month.AddDate(0, 1, 0)

	expense, err := s.ledger.OwnCategoryMonthlyTotals(ctx, booksID, "expense", from, to)
	if err != nil {
		return err
	}

	income, err := s.ledger.OwnCategoryMonthlyTotals(ctx, booksID, "income", from, to)
	if err != nil {
		return err
	}

	months := windowMethods(versions, from, to)
	out.Methods = distinctMethods(months)

	figures, err := s.windowFigures(ctx, booksID, facts, months, *out, expense, from, to)
	if err != nil {
		return err
	}

	parents := expenseParents(facts)
	for _, wm := range months {
		resolve := domain.BucketResolver(wm.method.Buckets, parents)
		month := bucketMonth(wm.month, wm.method.Buckets, resolve, expense, income)
		month.HasMethod = wm.ok
		month.Retained = figures.retained[wm.month]
		month.Covered = figures.covered[wm.month]
		month.GoalPaid = bucketPaid(figures.paid, resolve, len(wm.method.Buckets), wm.month)
		month.Received -= month.Retained

		if wm.ok {
			month.From = wm.method.From
		}

		addInflows(&month, wm.method.Buckets, figures.goals[wm.month], figures.savings[wm.month])
		out.Months = append(out.Months, month)
	}

	return nil
}

// windowFigures holds, by month of the window, what the history reads beside the own postings:
// the flows into the goal set and into the savings set, the retained income (A252) and the
// spending covered by accumulated balances, by bucket (A254). paid holds the expenses a goal
// pays by category and month (A256).
type windowFigures struct {
	goals, savings map[time.Time]flow
	retained       map[time.Time]int64
	covered        map[time.Time][]int64
	paid           map[uuid.UUID]map[time.Time]int64
}

func (s *Service) windowFigures(
	ctx context.Context,
	booksID int64,
	facts []Account,
	months []windowMethod,
	history BucketHistory,
	expense map[uuid.UUID]map[time.Time]int64,
	from, to time.Time,
) (windowFigures, error) {
	var (
		out windowFigures
		err error
	)

	out.goals, out.savings, err = s.windowInflows(ctx, booksID, facts, history, from, to)
	if err != nil {
		return windowFigures{}, err
	}

	out.retained, err = s.retainedIncome(ctx, booksID, facts, from, to)
	if err != nil {
		return windowFigures{}, err
	}

	budgets, err := s.repo.Budgets(ctx, booksID)
	if err != nil {
		return windowFigures{}, err
	}

	// The balance a rollover budget carries into the window depends on what goals paid since its
	// first amount (A257).
	since := from
	for _, b := range budgets {
		if b.Rollover && len(b.Amounts) > 0 && b.Amounts[0].EffectiveFrom.Before(since) {
			since = b.Amounts[0].EffectiveFrom
		}
	}

	paid, err := s.goalPaid(ctx, booksID, facts, history.Currency, since, to)
	if err != nil {
		return windowFigures{}, err
	}

	out.paid = paidByCategory(paid)
	out.covered, err = s.coveredSpending(
		ctx,
		booksID,
		facts,
		months,
		budgets,
		expense,
		out.paid,
		to,
	)

	return out, err
}

// bucketPaid sums, by bucket, the expenses of month that a goal pays (A254).
func bucketPaid(
	paid map[uuid.UUID]map[time.Time]int64,
	resolve func(uuid.UUID) (int, bool),
	buckets int,
	month time.Time,
) []int64 {
	out := make([]int64, buckets)

	for category, byMonth := range paid {
		if i, ok := resolve(category); ok {
			out[i] += byMonth[month]
		}
	}

	return out
}

// windowInflows returns what went into the goal set and into the savings set by month, each read
// only when a method of the window holds a bucket that takes it.
func (s *Service) windowInflows(
	ctx context.Context,
	booksID int64,
	facts []Account,
	history BucketHistory,
	from, to time.Time,
) (goals, savings map[time.Time]flow, err error) {
	if holdsBucket(history.Methods, func(b domain.Bucket) bool { return b.TakesGoals }) {
		goals, err = s.goalInflows(ctx, booksID, facts, history.Currency, from, to)
		if err != nil {
			return nil, nil, err
		}
	}

	if holdsBucket(history.Methods, func(b domain.Bucket) bool { return b.TakesSavings }) {
		savings, err = s.savingsInflows(ctx, booksID, facts, history.Currency, from, to)
		if err != nil {
			return nil, nil, err
		}
	}

	return goals, savings, nil
}

// windowMethod is the method in force in one month of the window; ok is false without a split.
type windowMethod struct {
	month  time.Time
	method domain.Method
	ok     bool
}

// windowMethods returns the method of each month in [from, to).
func windowMethods(versions []domain.Method, from, to time.Time) []windowMethod {
	var out []windowMethod

	for m := from; m.Before(to); m = m.AddDate(0, 1, 0) {
		method, ok := domain.MethodAt(versions, m)
		if !ok {
			method = domain.Method{}
		}

		out = append(out, windowMethod{month: m, method: method, ok: ok})
	}

	return out
}

// distinctMethods returns the methods of the months with a split, by From, each once.
func distinctMethods(months []windowMethod) []domain.Method {
	var out []domain.Method

	for _, wm := range months {
		if wm.ok && (len(out) == 0 || !out[len(out)-1].From.Equal(wm.method.From)) {
			out = append(out, wm.method)
		}
	}

	return out
}

// holdsBucket reports whether a bucket of any method satisfies match.
func holdsBucket(methods []domain.Method, match func(domain.Bucket) bool) bool {
	return slices.ContainsFunc(methods, func(m domain.Method) bool {
		return slices.ContainsFunc(m.Buckets, match)
	})
}

// expenseParents maps each expense category of facts to its parent.
func expenseParents(facts []Account) map[uuid.UUID]uuid.UUID {
	parents := make(map[uuid.UUID]uuid.UUID)
	for _, a := range facts {
		if a.Class == "expense" {
			parents[a.ID] = a.ParentID
		}
	}

	return parents
}

// addInflows adds what went into the goals in the month to the bucket that takes the goals and
// what went into the savings to the bucket that takes savings (A233, A234). A bucket that takes
// neither adds nothing. The unallocated income is what the month has left after them (A235).
func addInflows(month *BucketMonth, method []domain.Bucket, goals, savings flow) {
	for i, b := range method {
		if b.TakesGoals {
			month.Real[i] += goals.net()
			month.Deposited, month.Withdrawn = goals.deposited, goals.withdrawn
		}

		if b.TakesSavings {
			month.Real[i] += savings.net()
		}
	}

	month.Unallocated = unallocated(*month)
}

// unallocated returns the income received less the spending and the inflows the month's method
// takes (A235).
func unallocated(month BucketMonth) int64 {
	rest := month.Received - month.Outside
	for _, real := range month.Real {
		rest -= real
	}

	return rest
}

// bucketMonth splits the month's own expense postings over the buckets. Income postings are
// negative; the month reads earnings as positive.
func bucketMonth(
	month time.Time,
	method []domain.Bucket,
	resolve func(uuid.UUID) (int, bool),
	expense, income map[uuid.UUID]map[time.Time]int64,
) BucketMonth {
	out := BucketMonth{Month: month, Real: make([]int64, len(method))}
	for _, byMonth := range income {
		out.Received -= byMonth[month]
	}

	for id, byMonth := range expense {
		amount := byMonth[month]
		if i, ok := resolve(id); ok {
			out.Real[i] += amount
		} else {
			out.Outside += amount
		}
	}

	return out
}
