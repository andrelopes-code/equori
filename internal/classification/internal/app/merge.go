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
func (s *Service) HandleCategoriesMerged(ctx context.Context, booksID int64, from, into uuid.UUID) error {
	return s.repo.MergeCategory(ctx, booksID, from, into)
}

// HandleTagRenamed rewrites the rules that add the tag from after a tag rename or merge.
func (s *Service) HandleTagRenamed(ctx context.Context, booksID int64, from, into string) error {
	return s.repo.RenameRuleTag(ctx, booksID, from, into)
}

// HandlePayeesMerged rewrites aliases, rules, suggestions and match keys that name the payee
// from (A82).
func (s *Service) HandlePayeesMerged(ctx context.Context, booksID int64, from, into uuid.UUID) error {
	return s.repo.MergePayee(ctx, booksID, from, into)
}
