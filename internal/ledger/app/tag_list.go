package app

import (
	"context"

	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (s *Service) ListTags(ctx context.Context, booksID int64, p page.Request[TagKey]) ([]string, *TagKey, error) {
	return s.repo.ListTags(ctx, booksID, p)
}
