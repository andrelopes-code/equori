package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
)

func (r *Repository) BucketMethods(ctx context.Context, booksID int64) ([]domain.Method, error) {
	froms, err := r.q.ListBucketMethods(ctx, booksID)
	if err != nil {
		return nil, fmt.Errorf("list bucket methods: %w", err)
	}

	if len(froms) == 0 {
		return nil, nil
	}

	rows, err := r.q.ListBuckets(ctx, booksID)
	if err != nil {
		return nil, fmt.Errorf("list buckets: %w", err)
	}

	links, err := r.q.ListBucketCategories(ctx, booksID)
	if err != nil {
		return nil, fmt.Errorf("list bucket categories: %w", err)
	}

	return assembleMethods(froms, rows, links), nil
}

// DeleteBucketMethod deletes the version of from with its buckets; run it inside InTx.
func (r *Repository) DeleteBucketMethod(
	ctx context.Context,
	booksID int64,
	from time.Time,
) (bool, error) {
	n, err := r.q.DeleteBucketMethod(ctx, DeleteBucketMethodParams{
		BooksID:       booksID,
		EffectiveFrom: from,
	})
	if err != nil {
		return false, fmt.Errorf("delete bucket method: %w", err)
	}

	return n > 0, nil
}

// SaveBucketMethod replaces the version of method.From; run it inside InTx.
func (r *Repository) SaveBucketMethod(
	ctx context.Context,
	booksID int64,
	method domain.Method,
) error {
	if _, err := r.DeleteBucketMethod(ctx, booksID, method.From); err != nil {
		return err
	}

	err := r.q.InsertBucketMethod(ctx, InsertBucketMethodParams{
		BooksID:       booksID,
		EffectiveFrom: method.From,
	})
	if err != nil {
		return fmt.Errorf("insert bucket method: %w", err)
	}

	for i, b := range method.Buckets {
		if err := r.insertBucket(ctx, booksID, method.From, i, b); err != nil {
			return err
		}
	}

	return nil
}

func (r *Repository) insertBucket(
	ctx context.Context,
	booksID int64,
	from time.Time,
	position int,
	b domain.Bucket,
) error {
	lineage := b.ID
	if lineage == uuid.Nil {
		lineage = uuid.Must(uuid.NewV7())
	}

	//nolint:gosec // CheckBuckets keeps the position below 10 and the share within 0 to 10000
	id, err := r.q.InsertBucket(ctx, InsertBucketParams{
		BooksID:       booksID,
		EffectiveFrom: from,
		LineageID:     lineage,
		Position:      int32(position),
		Name:          b.Name,
		ShareBp:       int32(b.ShareBP),
		TakesSavings:  b.TakesSavings,
		TakesGoals:    b.TakesGoals,
		AtLeast:       b.AtLeast,
	})
	if err != nil {
		return fmt.Errorf("insert bucket: %w", err)
	}

	for _, c := range b.Categories {
		err := r.q.InsertBucketCategory(ctx, InsertBucketCategoryParams{
			BooksID:       booksID,
			EffectiveFrom: from,
			CategoryID:    c,
			BucketID:      id,
		})
		if err != nil {
			return fmt.Errorf("insert bucket category: %w", err)
		}
	}

	return nil
}

// assembleMethods groups the bucket rows by version and attaches their categories.
func assembleMethods(
	froms []time.Time,
	rows []ListBucketsRow,
	links []ListBucketCategoriesRow,
) []domain.Method {
	out := make([]domain.Method, len(froms))
	versions := make(map[time.Time]int, len(froms))

	for i, from := range froms {
		out[i] = domain.Method{From: from}
		versions[from] = i
	}

	type place struct{ version, bucket int }

	index := make(map[uuid.UUID]place, len(rows))

	for _, row := range rows {
		m := &out[versions[row.EffectiveFrom]]
		index[row.ID] = place{versions[row.EffectiveFrom], len(m.Buckets)}
		m.Buckets = append(m.Buckets, domain.Bucket{
			ID:           row.LineageID,
			Name:         row.Name,
			ShareBP:      int(row.ShareBp),
			TakesSavings: row.TakesSavings,
			TakesGoals:   row.TakesGoals,
			AtLeast:      row.AtLeast,
			Categories:   []uuid.UUID{},
		})
	}

	for _, l := range links {
		p := index[l.BucketID]
		b := &out[p.version].Buckets[p.bucket]
		b.Categories = append(b.Categories, l.CategoryID)
	}

	return out
}
