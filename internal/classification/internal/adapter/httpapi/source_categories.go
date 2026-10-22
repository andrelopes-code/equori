package httpapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
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

func (s *Server) ListSourceCategories(ctx context.Context, req ListSourceCategoriesRequestObject) (ListSourceCategoriesResponseObject, error) {
	p, err := listPage[app.NameKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	cs, next, err := s.svc.ListSourceCategories(ctx, auth.MustUserID(ctx), p)
	if err != nil {
		return nil, err
	}
	out := ListSourceCategories200JSONResponse{Items: make([]SourceCategory, len(cs))}
	for i, c := range cs {
		out.Items[i] = toSourceCategoryAPI(c)
	}
	out.NextCursor, err = page.Next(next)
	return out, err
}

func (s *Server) MapSourceCategory(ctx context.Context, req MapSourceCategoryRequestObject) (MapSourceCategoryResponseObject, error) {
	var category uuid.UUID
	if req.Body.CategoryId != nil {
		category = *req.Body.CategoryId
	}
	c, err := s.svc.MapSourceCategory(ctx, auth.MustUserID(ctx), req.Id, category)
	if err != nil {
		return nil, err
	}
	return MapSourceCategory200JSONResponse(toSourceCategoryAPI(c)), nil
}
