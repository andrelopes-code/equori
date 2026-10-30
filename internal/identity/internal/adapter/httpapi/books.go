package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) GetCurrentBooks(ctx context.Context, _ GetCurrentBooksRequestObject) (GetCurrentBooksResponseObject, error) {
	settings, err := s.svc.BooksSettings(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return nil, err
	}

	return GetCurrentBooks200JSONResponse(toAPIBooksSettings(settings)), nil
}

func (s *Server) UpdateCurrentBooks(ctx context.Context, req UpdateCurrentBooksRequestObject) (UpdateCurrentBooksResponseObject, error) {
	if req.Body == nil {
		return nil, errInvalidRequest
	}

	settings, err := s.svc.UpdateBooksSettings(ctx, auth.MustBooksID(ctx), req.Body.Region, req.Body.TimeZone, req.Body.Name)
	if err != nil {
		return nil, err
	}

	return UpdateCurrentBooks200JSONResponse(toAPIBooksSettings(settings)), nil
}

func toAPIBooksSettings(b app.BooksSettings) BooksSettings {
	return BooksSettings{Name: b.Name, Region: b.Region, TimeZone: b.TimeZone, DefaultTimeZone: b.DefaultTimeZone}
}
