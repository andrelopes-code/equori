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
	Buckets  []domain.Bucket
	Months   []BucketMonth
}

// BucketMonth holds the income received in a month, the real amount of each bucket in method
// order and the spending outside the split.
type BucketMonth struct {
	Month             time.Time
	Received, Outside int64
	Real              []int64
}

// BucketHistory returns the bucket figures of month and the five months before it.
func (s *Service) BucketHistory(
	ctx context.Context,
	booksID int64,
	month time.Time,
) (BucketHistory, error) {
	month = domain.MonthOf(month)
	if month.After(s.horizon(ctx)) {
		return BucketHistory{}, &domain.FieldError{
			Field:   "month",
			Message: "must be at most today + 12 months",
			Err:     domain.ErrValidation,
		}
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return BucketHistory{}, err
	}

	method, err := s.repo.Buckets(ctx, booksID)
	if err != nil {
		return BucketHistory{}, err
	}

	out := BucketHistory{Currency: base, Buckets: method}
	err = s.addBucketMonths(ctx, booksID, month, &out)

	return out, err
}

// addBucketMonths reads the window's own postings and adds one BucketMonth per month to out.
func (s *Service) addBucketMonths(
	ctx context.Context,
	booksID int64,
	month time.Time,
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

	var goals, savings map[time.Time]int64
	if slices.ContainsFunc(out.Buckets, func(b domain.Bucket) bool { return b.TakesGoals }) {
		goals, err = s.goalInflows(ctx, booksID, facts, out.Currency, from, to)
		if err != nil {
			return err
		}
	}

	if slices.ContainsFunc(out.Buckets, func(b domain.Bucket) bool { return b.TakesSavings }) {
		savings, err = s.savingsInflows(ctx, booksID, facts, out.Currency, from, to)
		if err != nil {
			return err
		}
	}

	resolve := domain.BucketResolver(out.Buckets, expenseParents(facts))
	for m := from; m.Before(to); m = m.AddDate(0, 1, 0) {
		month := bucketMonth(m, out.Buckets, resolve, expense, income)
		addInflows(&month, out.Buckets, goals[m], savings[m])
		out.Months = append(out.Months, month)
	}

	return nil
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
// neither adds nothing.
func addInflows(month *BucketMonth, method []domain.Bucket, goals, savings int64) {
	for i, b := range method {
		if b.TakesGoals {
			month.Real[i] += goals
		}

		if b.TakesSavings {
			month.Real[i] += savings
		}
	}
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
