package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) getCurrentBooks(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (BooksSettings, error) {
	settings, err := s.svc.BooksSettings(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return BooksSettings{}, err
	}

	return toAPIBooksSettings(settings), nil
}

func (s *Server) updateCurrentBooks(
	ctx context.Context,
	_ *http.Request,
	in UpdateCurrentBooksJSONRequestBody,
) (BooksSettings, error) {
	settings, err := s.svc.UpdateBooksSettings(
		ctx,
		auth.MustBooksID(ctx),
		in.Region,
		in.TimeZone,
		in.Name,
	)
	if err != nil {
		return BooksSettings{}, err
	}

	return toAPIBooksSettings(settings), nil
}

func (s *Server) listMyBooks(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (BooksMembershipList, error) {
	books, err := s.svc.Books(ctx, auth.MustMemberID(ctx), auth.MustBooksID(ctx))
	if err != nil {
		return BooksMembershipList{}, err
	}

	items := make([]BooksMembership, 0, len(books))
	for _, b := range books {
		items = append(items, toAPIBooksMembership(b))
	}

	return BooksMembershipList{Items: items}, nil
}

func (s *Server) createBooks(
	ctx context.Context,
	_ *http.Request,
	in CreateBooksJSONRequestBody,
) (BooksMembership, error) {
	created, err := s.svc.CreateBooks(
		ctx,
		auth.MustMemberID(ctx),
		in.Name,
		in.Region,
		money.Currency(deref(in.BaseCurrency)),
	)
	if err != nil {
		return BooksMembership{}, err
	}

	return toAPIBooksMembership(created), nil
}

func (s *Server) switchBooks(
	ctx context.Context,
	r *http.Request,
	in SwitchBooksJSONRequestBody,
) (httpserver.None, error) {
	session, err := r.Cookie(CookieName)
	if err != nil {
		return httpserver.None{}, app.ErrUnauthenticated
	}

	if err := s.svc.SwitchBooks(
		ctx,
		auth.MustMemberID(ctx),
		session.Value,
		in.BooksId,
	); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func toAPIBooksMembership(b app.BooksMembership) BooksMembership {
	return BooksMembership{Id: b.ID, Name: b.Name, Role: BookRole(b.Role), Active: b.Active}
}

func toAPIBooksSettings(b app.BooksSettings) BooksSettings {
	return BooksSettings{
		Name:            b.Name,
		Region:          b.Region,
		TimeZone:        b.TimeZone,
		DefaultTimeZone: b.DefaultTimeZone,
	}
}
