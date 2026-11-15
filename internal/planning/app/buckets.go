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

// SaveBudgetBuckets replaces the book's bucket method (income buckets A229); an empty list
// removes it.
func (s *Service) SaveBudgetBuckets(
	ctx context.Context,
	booksID int64,
	buckets []domain.Bucket,
) error {
	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return err
	}

	expense := make(map[uuid.UUID]bool, len(facts))
	for _, a := range facts {
		expense[a.ID] = a.Class == "expense"
	}

	checked, err := domain.CheckBuckets(buckets, func(id uuid.UUID) bool { return expense[id] })
	if err != nil {
		return err
	}

	return s.repo.InTx(ctx, func(repo Repository) error {
		return repo.SaveBuckets(ctx, booksID, checked)
	})
}

// BudgetBuckets returns the book's bucket method in order; empty without one (A229).
func (s *Service) BudgetBuckets(ctx context.Context, booksID int64) ([]domain.Bucket, error) {
	return s.repo.Buckets(ctx, booksID)
}

// keepBucketTarget replaces the savings target of a plan save with the stored one while a
// bucket takes the savings: the plan reads the bucket's share then, and a save of that share
// would overwrite the target the book returns to without the split (A231).
func (s *Service) keepBucketTarget(
	ctx context.Context,
	booksID int64,
	ref *domain.Reference,
) error {
	method, err := s.repo.Buckets(ctx, booksID)
	if err != nil {
		return err
	}

	if !slices.ContainsFunc(method, func(b domain.Bucket) bool { return b.TakesSavings }) {
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
	method, err := s.repo.Buckets(ctx, booksID)
	if err != nil || len(method) == 0 {
		return err
	}

	parents := make(map[uuid.UUID]uuid.UUID, len(categories))
	for _, c := range categories {
		parents[c.ID] = c.ParentID
	}

	resolve := domain.BucketResolver(method, parents)
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
		if b.TakesSavings {
			out.Buckets[i].Planned, out.Buckets[i].Spent = out.Savings, out.SavingsRealized
			out.Reference.TargetBP, out.Reference.HasTarget = b.ShareBP, true
		}
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
