package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

func (s *Server) getCurrentUser(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (User, error) {
	user, ok := ctx.Value(memberKey{}).(domain.Member)
	if !ok {
		return User{}, app.ErrUnauthenticated
	}

	l, err := s.svc.Profile(ctx, auth.MustBooksID(ctx), user.ID)
	if err != nil {
		return User{}, err
	}

	return toAPIUser(user, l, auth.MustBooksID(ctx), auth.MustBookRole(ctx)), nil
}

func (s *Server) updateCurrentUser(
	ctx context.Context,
	_ *http.Request,
	in UpdateCurrentUserJSONRequestBody,
) (User, error) {
	user, ok := ctx.Value(memberKey{}).(domain.Member)
	if !ok {
		return User{}, app.ErrUnauthenticated
	}

	if in.DisplayName != nil {
		name, err := s.svc.SetDisplayName(ctx, user.ID, *in.DisplayName)
		if err != nil {
			return User{}, err
		}

		user.DisplayName = name
	}

	l, err := s.svc.UpdateProfile(ctx, auth.MustBooksID(ctx), user.ID, deref(in.Language), "")
	if err != nil {
		return User{}, err
	}

	return toAPIUser(user, l, auth.MustBooksID(ctx), auth.MustBookRole(ctx)), nil
}

func toAPIUser(u domain.Member, l locale.Locale, booksID int64, role auth.BookRole) User {
	return User{
		Id:          u.ID,
		Email:       u.Email,
		DisplayName: optional(u.DisplayName),
		Role:        UserRole(u.Role),
		Language:    l.Language,
		Region:      l.Region,
		BooksId:     booksID,
		BookRole:    BookRole(role),
	}
}
