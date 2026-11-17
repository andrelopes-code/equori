package app

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/planning/domain"
)

// BucketVersions returns every version of the bucket method by start month (A240).
func (s *Service) BucketVersions(ctx context.Context, booksID int64) ([]domain.Method, error) {
	return s.repo.BucketMethods(ctx, booksID)
}

// DeleteBucketVersion deletes the version that starts in from; ErrNotFound without it (A240).
func (s *Service) DeleteBucketVersion(ctx context.Context, booksID int64, from time.Time) error {
	return s.repo.InTx(ctx, func(repo Repository) error {
		deleted, err := repo.DeleteBucketMethod(ctx, booksID, domain.MonthOf(from))
		if err != nil {
			return err
		}

		if !deleted {
			return ErrNotFound
		}

		return dropLeadingEmpty(ctx, repo, booksID)
	})
}
