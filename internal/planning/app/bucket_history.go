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
// to Received (A235).
type BucketMonth struct {
	Month             time.Time
	From              time.Time
	HasMethod         bool
	Received, Outside int64
	Unallocated       int64
	Real              []int64
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

	var goals, savings map[time.Time]int64
	if holdsBucket(out.Methods, func(b domain.Bucket) bool { return b.TakesGoals }) {
		goals, err = s.goalInflows(ctx, booksID, facts, out.Currency, from, to)
		if err != nil {
			return err
		}
	}

	if holdsBucket(out.Methods, func(b domain.Bucket) bool { return b.TakesSavings }) {
		savings, err = s.savingsInflows(ctx, booksID, facts, out.Currency, from, to)
		if err != nil {
			return err
		}
	}

	parents := expenseParents(facts)
	for _, wm := range months {
		resolve := domain.BucketResolver(wm.method.Buckets, parents)
		month := bucketMonth(wm.month, wm.method.Buckets, resolve, expense, income)
		month.HasMethod = wm.ok

		if wm.ok {
			month.From = wm.method.From
		}

		addInflows(&month, wm.method.Buckets, goals[wm.month], savings[wm.month])
		out.Months = append(out.Months, month)
	}

	return nil
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
func addInflows(month *BucketMonth, method []domain.Bucket, goals, savings int64) {
	for i, b := range method {
		if b.TakesGoals {
			month.Real[i] += goals
		}

		if b.TakesSavings {
			month.Real[i] += savings
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
