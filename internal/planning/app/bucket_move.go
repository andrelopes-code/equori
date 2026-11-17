package app

import (
	"context"
	"slices"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
)

// NoBucket is the bucket name that removes the placement of a category (A237).
const NoBucket = "none"

// CategoryMove is the method of the current month with one category moved: the buckets to save,
// the name of the bucket the category resolves to before and after, empty when outside, and the
// number of categories outside the split after the move (A237).
type CategoryMove struct {
	Buckets       []domain.Bucket
	Before, After string
	Outside       int
}

// PlanCategoryMove returns the method of the current month with category placed in the bucket
// named bucket, ignoring case, or in none for NoBucket. It stores nothing (A237).
func (s *Service) PlanCategoryMove(
	ctx context.Context,
	booksID int64,
	category uuid.UUID,
	bucket string,
) (CategoryMove, error) {
	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return CategoryMove{}, err
	}

	parents := expenseParents(facts)
	if _, ok := parents[category]; !ok {
		return CategoryMove{}, moveError("category_id", "must be an expense category of the book")
	}

	method, ok, err := s.methodOf(ctx, booksID, domain.MonthOf(s.clk.Today(ctx)))
	if err != nil {
		return CategoryMove{}, err
	}

	if !ok {
		return CategoryMove{}, moveError("bucket", "the current month has no income split")
	}

	target := slices.IndexFunc(method.Buckets, func(b domain.Bucket) bool {
		return strings.EqualFold(strings.TrimSpace(b.Name), strings.TrimSpace(bucket))
	})
	if target < 0 && bucket != NoBucket {
		return CategoryMove{}, moveError("bucket", "must be a bucket name of the split, or none")
	}

	out := CategoryMove{
		Buckets: moveCategory(method.Buckets, category, target),
		Before:  resolvedName(method.Buckets, parents, category),
	}
	out.After = resolvedName(out.Buckets, parents, category)
	out.Outside = len(outsideCategories(facts, out.Buckets))

	return out, nil
}

// moveCategory returns buckets with category removed from each and added to the bucket at
// target; a negative target adds it to none. The input is not changed.
func moveCategory(buckets []domain.Bucket, category uuid.UUID, target int) []domain.Bucket {
	out := slices.Clone(buckets)
	for i, b := range out {
		out[i].Categories = slices.DeleteFunc(
			slices.Clone(b.Categories),
			func(id uuid.UUID) bool { return id == category },
		)
		if i == target {
			out[i].Categories = append(out[i].Categories, category)
		}
	}

	return out
}

// resolvedName returns the name of the bucket category resolves to; empty when outside.
func resolvedName(
	buckets []domain.Bucket,
	parents map[uuid.UUID]uuid.UUID,
	category uuid.UUID,
) string {
	i, ok := domain.BucketResolver(buckets, parents)(category)
	if !ok {
		return ""
	}

	return buckets[i].Name
}

func moveError(field, message string) error {
	return &domain.FieldError{Field: field, Message: message, Err: domain.ErrValidation}
}
