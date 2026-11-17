package app

import (
	"cmp"
	"context"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
)

// OutsideCategories returns the categories that buckets would leave outside the split (A236).
func (s *Service) OutsideCategories(
	ctx context.Context,
	booksID int64,
	buckets []domain.Bucket,
) ([]uuid.UUID, error) {
	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return nil, err
	}

	return outsideCategories(facts, buckets), nil
}

// outsideCategories returns the open expense categories without a system role that resolve to
// no bucket, by name; an empty list when none is outside (A236).
func outsideCategories(facts []Account, buckets []domain.Bucket) []uuid.UUID {
	resolve := domain.BucketResolver(buckets, expenseParents(facts))

	var outside []Account

	for _, a := range facts {
		if a.Class != "expense" || a.Closed || a.SystemRole != "" {
			continue
		}

		if _, ok := resolve(a.ID); !ok {
			outside = append(outside, a)
		}
	}

	slices.SortFunc(outside, func(a, b Account) int {
		return cmp.Or(cmp.Compare(a.Name, b.Name), cmp.Compare(a.ID.String(), b.ID.String()))
	})

	ids := make([]uuid.UUID, len(outside))
	for i, a := range outside {
		ids[i] = a.ID
	}

	return ids
}
