package app

import (
	"context"

	"github.com/google/uuid"
)

// causeMerge is the cause method of the versions a category merge creates (A75); the
// transaction keeps the method it had.
const causeMerge = "merge"

// HandleCategoriesMerged rewrites rule actions, suggestions, source mappings and
// categorization rows that name from (A75).
func (s *Service) HandleCategoriesMerged(ctx context.Context, userID int64, from, into uuid.UUID) error {
	return s.repo.MergeCategory(ctx, userID, from, into)
}
