package httpapi

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toSourceCategoryAPI(c app.SourceCategory) SourceCategory {
	out := SourceCategory{
		Id: c.ID, Aggregator: c.Aggregator, ExternalId: c.ExternalID, Name: c.Name, Count: c.Count,
	}
	if c.CategoryID != uuid.Nil {
		out.CategoryId = &c.CategoryID
	}

	return out
}

func (s *Server) listSourceCategories(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (SourceCategoryList, error) {
	params, err := httpserver.Query[ListSourceCategoriesParams](r)
	if err != nil {
		return SourceCategoryList{}, err
	}

	p, err := listPage[app.NameKey](params.Limit, params.Cursor)
	if err != nil {
		return SourceCategoryList{}, err
	}

	cs, next, err := s.svc.ListSourceCategories(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return SourceCategoryList{}, err
	}

	out := SourceCategoryList{Items: make([]SourceCategory, len(cs))}
	for i, c := range cs {
		out.Items[i] = toSourceCategoryAPI(c)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) mapSourceCategory(
	ctx context.Context, r *http.Request, in MapSourceCategoryJSONRequestBody,
) (SourceCategory, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return SourceCategory{}, err
	}

	var category uuid.UUID
	if in.CategoryId != nil {
		category = *in.CategoryId
	}

	c, err := s.svc.MapSourceCategory(ctx, auth.MustBooksID(ctx), id, category)
	if err != nil {
		return SourceCategory{}, err
	}

	return toSourceCategoryAPI(c), nil
}
