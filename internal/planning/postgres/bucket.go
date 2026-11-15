package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
)

func (r *Repository) Buckets(ctx context.Context, booksID int64) ([]domain.Bucket, error) {
	rows, err := r.q.ListBuckets(ctx, booksID)
	if err != nil {
		return nil, fmt.Errorf("list buckets: %w", err)
	}

	if len(rows) == 0 {
		return nil, nil
	}

	links, err := r.q.ListBucketCategories(ctx, booksID)
	if err != nil {
		return nil, fmt.Errorf("list bucket categories: %w", err)
	}

	index := make(map[uuid.UUID]int, len(rows))

	out := make([]domain.Bucket, len(rows))
	for i, row := range rows {
		index[row.ID] = i
		out[i] = domain.Bucket{
			ID:           row.ID,
			Name:         row.Name,
			ShareBP:      int(row.ShareBp),
			TakesSavings: row.TakesSavings,
			Categories:   []uuid.UUID{},
		}
	}

	for _, l := range links {
		b := &out[index[l.BucketID]]
		b.Categories = append(b.Categories, l.CategoryID)
	}

	return out, nil
}

// SaveBuckets replaces the stored method with buckets; run it inside InTx.
func (r *Repository) SaveBuckets(
	ctx context.Context,
	booksID int64,
	buckets []domain.Bucket,
) error {
	if err := r.q.DeleteBuckets(ctx, booksID); err != nil {
		return fmt.Errorf("delete buckets: %w", err)
	}

	for i, b := range buckets {
		//nolint:gosec // CheckBuckets keeps the position below 10 and the share within 0 to 10000
		id, err := r.q.InsertBucket(ctx, InsertBucketParams{
			BooksID:      booksID,
			Position:     int32(i),
			Name:         b.Name,
			ShareBp:      int32(b.ShareBP),
			TakesSavings: b.TakesSavings,
		})
		if err != nil {
			return fmt.Errorf("insert bucket: %w", err)
		}

		for _, c := range b.Categories {
			err := r.q.InsertBucketCategory(ctx, InsertBucketCategoryParams{
				BooksID:    booksID,
				CategoryID: c,
				BucketID:   id,
			})
			if err != nil {
				return fmt.Errorf("insert bucket category: %w", err)
			}
		}
	}

	return nil
}
