package toolapi

import (
	"bytes"
	"context"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/app"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func findSuggestion(ctx context.Context, svc *app.Service, booksID int64, id uuid.UUID) (app.Suggestion, error) {
	r := page.Request[app.SuggestionKey]{Limit: page.MaxLimit}
	for {
		items, next, err := svc.ListSuggestions(ctx, booksID, "", r)
		if err != nil {
			return app.Suggestion{}, err
		}

		if i := slices.IndexFunc(items, func(s app.Suggestion) bool { return s.ID == id }); i >= 0 {
			return items[i], nil
		}

		if next == nil {
			return app.Suggestion{}, notFound()
		}

		r.After = next
	}
}

func findSourceCategory(ctx context.Context, svc *app.Service, booksID int64, id uuid.UUID) (app.SourceCategory, error) {
	r := page.Request[app.NameKey]{Limit: page.MaxLimit}
	for {
		items, next, err := svc.ListSourceCategories(ctx, booksID, r)
		if err != nil {
			return app.SourceCategory{}, err
		}

		if i := slices.IndexFunc(items, func(c app.SourceCategory) bool { return c.ID == id }); i >= 0 {
			return items[i], nil
		}

		if next == nil {
			return app.SourceCategory{}, notFound()
		}

		r.After = next
	}
}

func compareIDs(a, b uuid.UUID) int { return bytes.Compare(a[:], b[:]) }
