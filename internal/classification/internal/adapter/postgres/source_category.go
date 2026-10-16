package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toSourceCategory(row ClassificationSourceCategory) app.SourceCategory {
	return app.SourceCategory{
		ID: row.ID, Provider: row.Provider, ExternalID: row.ExternalID, Name: row.Name,
		Count: int(row.SeenCount), CategoryID: row.CategoryID.UUID,
	}
}

func (r *Repository) CountSourceCategories(ctx context.Context, userID int64, seen []app.SourceCategory) error {
	for _, c := range seen {
		if err := r.q.CountSourceCategory(ctx, CountSourceCategoryParams{
			UserID: userID, Provider: c.Provider, ExternalID: c.ExternalID, Name: c.Name, Seen: int32(c.Count), //nolint:gosec // lines of one sync
		}); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) MappedSourceCategories(ctx context.Context, userID int64, provider string, externalIDs []string) (map[string]uuid.UUID, error) {
	rows, err := r.q.MappedSourceCategories(ctx, MappedSourceCategoriesParams{UserID: userID, Provider: provider, ExternalIds: externalIDs})
	if err != nil {
		return nil, err
	}
	out := make(map[string]uuid.UUID, len(rows))
	for _, row := range rows {
		out[row.ExternalID] = row.CategoryID
	}
	return out, nil
}

func (r *Repository) ListSourceCategories(ctx context.Context, userID int64, p page.Request[app.NameKey]) ([]app.SourceCategory, *app.NameKey, error) {
	params := ListSourceCategoriesParams{UserID: userID, RowLimit: int32(p.Limit + 1)} //nolint:gosec // limit is at most page.MaxLimit
	if p.After != nil {
		params.AfterName, params.AfterID = &p.After.Name, uuid.NullUUID{UUID: p.After.ID, Valid: true}
	}
	rows, err := r.q.ListSourceCategories(ctx, params)
	if err != nil {
		return nil, nil, err
	}
	kept, more := page.Trim(rows, p.Limit)
	out := make([]app.SourceCategory, len(kept))
	for i, row := range kept {
		out[i] = toSourceCategory(row)
	}
	if !more {
		return out, nil, nil
	}
	last := kept[len(kept)-1]
	return out, &app.NameKey{Name: last.Name, ID: last.ID}, nil
}

func (r *Repository) MapSourceCategory(ctx context.Context, userID int64, id, categoryID uuid.UUID) (app.SourceCategory, error) {
	row, err := r.q.MapSourceCategory(ctx, MapSourceCategoryParams{UserID: userID, ID: id, CategoryID: uuid.NullUUID{UUID: categoryID, Valid: categoryID != uuid.Nil}})
	if err != nil {
		return app.SourceCategory{}, notFound(err)
	}
	return toSourceCategory(row), nil
}
