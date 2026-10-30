package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
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

func (s *Server) ListMyBooks(ctx context.Context, _ ListMyBooksRequestObject) (ListMyBooksResponseObject, error) {
	books, err := s.svc.Books(ctx, auth.MustMemberID(ctx), auth.MustBooksID(ctx))
	if err != nil {
		return nil, err
	}

	items := make([]BooksMembership, 0, len(books))
	for _, b := range books {
		items = append(items, toAPIBooksMembership(b))
	}

	return ListMyBooks200JSONResponse{Items: items}, nil
}

func (s *Server) CreateBooks(ctx context.Context, req CreateBooksRequestObject) (CreateBooksResponseObject, error) {
	if req.Body == nil {
		return nil, errInvalidRequest
	}

	b := req.Body

	created, err := s.svc.CreateBooks(ctx, auth.MustMemberID(ctx), b.Name, b.Region, money.Currency(deref(b.BaseCurrency)))
	if err != nil {
		return nil, err
	}

	return CreateBooks201JSONResponse(toAPIBooksMembership(created)), nil
}

func (s *Server) SwitchBooks(ctx context.Context, req SwitchBooksRequestObject) (SwitchBooksResponseObject, error) {
	if req.Body == nil {
		return nil, errInvalidRequest
	}

	if req.Params.EquoriSession == nil {
		return nil, app.ErrUnauthenticated
	}

	if err := s.svc.SwitchBooks(ctx, auth.MustMemberID(ctx), *req.Params.EquoriSession, req.Body.BooksId); err != nil {
		return nil, err
	}

	return SwitchBooks204Response{}, nil
}

func toAPIBooksMembership(b app.BooksMembership) BooksMembership {
	return BooksMembership{Id: b.ID, Name: b.Name, Role: BookRole(b.Role), Active: b.Active}
}

func toAPIBooksSettings(b app.BooksSettings) BooksSettings {
	return BooksSettings{Name: b.Name, Region: b.Region, TimeZone: b.TimeZone, DefaultTimeZone: b.DefaultTimeZone}
}
