package app

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
)

// PlanBucket is a bucket of the book's method with its figures of the plan's month (A230).
type PlanBucket struct {
	domain.Bucket

	Planned, Spent int64
}

// SaveBudgetBuckets replaces the version of the bucket method that starts in from, the current
// month when nil, or adds it; an empty list ends the split from that month (A240).
func (s *Service) SaveBudgetBuckets(
	ctx context.Context,
	booksID int64,
	from *time.Time,
	buckets []domain.Bucket,
) error {
	start := domain.MonthOf(s.clk.Today(ctx))
	if from != nil {
		start = domain.MonthOf(*from)
	}

	if start.After(s.horizon(ctx)) {
		return &domain.FieldError{
			Field:   "from",
			Message: "must be at most today + 12 months",
			Err:     domain.ErrValidation,
		}
	}

	expense, err := s.expenseCategories(ctx, booksID)
	if err != nil {
		return err
	}

	return s.repo.InTx(ctx, func(repo Repository) error {
		versions, err := repo.BucketMethods(ctx, booksID)
		if err != nil {
			return err
		}

		checked, err := domain.CheckBuckets(buckets, expense, knownBucketIDs(versions))
		if err != nil {
			return err
		}

		err = repo.SaveBucketMethod(ctx, booksID, domain.Method{From: start, Buckets: checked})
		if err != nil {
			return err
		}

		return dropLeadingEmpty(ctx, repo, booksID)
	})
}

// BudgetBuckets returns the method in force in month, the current month when nil; the zero
// Method without a split (A240).
func (s *Service) BudgetBuckets(
	ctx context.Context,
	booksID int64,
	month *time.Time,
) (domain.Method, error) {
	at := domain.MonthOf(s.clk.Today(ctx))
	if month != nil {
		at = domain.MonthOf(*month)
	}

	if at.After(s.horizon(ctx)) {
		return domain.Method{}, &domain.FieldError{
			Field:   "month",
			Message: "must be at most today + 12 months",
			Err:     domain.ErrValidation,
		}
	}

	method, _, err := s.methodOf(ctx, booksID, at)

	return method, err
}

// methodOf returns the method in force in month; false without a split.
func (s *Service) methodOf(
	ctx context.Context,
	booksID int64,
	month time.Time,
) (domain.Method, bool, error) {
	versions, err := s.repo.BucketMethods(ctx, booksID)
	if err != nil {
		return domain.Method{}, false, err
	}

	method, ok := domain.MethodAt(versions, month)
	if !ok {
		return domain.Method{}, false, nil
	}

	return method, true, nil
}

// keepBucketTarget replaces the savings target of a plan save of month with the stored one while
// a bucket takes the savings: the plan reads the bucket's share then, and a save of that share
// would overwrite the target the book returns to without the split (A231).
func (s *Service) keepBucketTarget(
	ctx context.Context,
	booksID int64,
	month time.Time,
	ref *domain.Reference,
) error {
	method, _, err := s.methodOf(ctx, booksID, month)
	if err != nil {
		return err
	}

	if !slices.ContainsFunc(method.Buckets, func(b domain.Bucket) bool { return b.TakesSavings }) {
		return nil
	}

	stored, _, err := s.repo.BudgetReference(ctx, booksID)
	if err != nil {
		return err
	}

	ref.TargetBP, ref.HasTarget = stored.TargetBP, stored.HasTarget

	return nil
}

// BucketTargets returns the target of each bucket; false without a reference (A230).
func (p Plan) BucketTargets() ([]int64, bool) {
	ref, ok := p.ReferenceAmount()
	if !ok {
		return nil, false
	}

	method := make([]domain.Bucket, len(p.Buckets))
	for i, b := range p.Buckets {
		method[i] = b.Bucket
	}

	return domain.BucketTargets(ref, method), true
}

// planBuckets adds the book's bucket method with its planned and spent amounts of the month,
// and sets the savings target to the share of the bucket that takes savings (A230, A231).
func (s *Service) planBuckets(
	ctx context.Context,
	booksID int64,
	out *Plan,
	categories []domain.PlanCategory,
	own map[uuid.UUID]map[time.Time]int64,
) error {
	found, ok, err := s.methodOf(ctx, booksID, out.Month)
	if err != nil || !ok {
		return err
	}

	method := found.Buckets
	out.BucketsFrom = found.From

	resolve := domain.BucketResolver(method, planParents(categories))
	out.Buckets = make([]PlanBucket, len(method))
	add := func(category uuid.UUID, planned, spent int64) {
		if i, ok := resolve(category); ok {
			out.Buckets[i].Planned += planned
			out.Buckets[i].Spent += spent

			return
		}

		out.OutsidePlanned += planned
		out.OutsideSpent += spent
	}

	for i, b := range method {
		out.Buckets[i].Bucket = b
		if !b.TakesSavings {
			continue
		}

		saved, err := s.monthSavings(ctx, booksID, out.Month)
		if err != nil {
			return err
		}

		out.Buckets[i].Planned, out.Buckets[i].Spent = out.Savings, saved
		out.Reference.TargetBP, out.Reference.HasTarget = b.ShareBP, true
	}

	for _, r := range out.Rows {
		if r.Counted {
			add(r.CategoryID, r.Planned, 0)
		}
	}

	for _, c := range categories {
		add(c.ID, 0, own[c.ID][out.Month])
	}

	return nil
}

// planParents maps each category of the plan to its parent.
func planParents(categories []domain.PlanCategory) map[uuid.UUID]uuid.UUID {
	parents := make(map[uuid.UUID]uuid.UUID, len(categories))
	for _, c := range categories {
		parents[c.ID] = c.ParentID
	}

	return parents
}

// monthSavings returns what went into the book's savings accounts in month (A233).
func (s *Service) monthSavings(
	ctx context.Context,
	booksID int64,
	month time.Time,
) (int64, error) {
	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return 0, err
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return 0, err
	}

	got, err := s.savingsInflows(ctx, booksID, facts, base, month, month.AddDate(0, 1, 0))

	return got[month], err
}

// expenseCategories returns the expense categories of the book by id.
func (s *Service) expenseCategories(
	ctx context.Context,
	booksID int64,
) (func(uuid.UUID) bool, error) {
	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return nil, err
	}

	expense := make(map[uuid.UUID]bool, len(facts))
	for _, a := range facts {
		expense[a.ID] = a.Class == "expense"
	}

	return func(id uuid.UUID) bool { return expense[id] }, nil
}

// knownBucketIDs reports whether an id belongs to a bucket of any version.
func knownBucketIDs(versions []domain.Method) func(uuid.UUID) bool {
	known := make(map[uuid.UUID]bool)

	for _, v := range versions {
		for _, b := range v.Buckets {
			known[b.ID] = true
		}
	}

	return func(id uuid.UUID) bool { return known[id] }
}

// dropLeadingEmpty deletes each version without buckets that no version with buckets precedes
// (A240, normal form).
func dropLeadingEmpty(ctx context.Context, repo Repository, booksID int64) error {
	versions, err := repo.BucketMethods(ctx, booksID)
	if err != nil {
		return err
	}

	for _, from := range domain.LeadingEmpty(versions) {
		if _, err := repo.DeleteBucketMethod(ctx, booksID, from); err != nil {
			return err
		}
	}

	return nil
}
