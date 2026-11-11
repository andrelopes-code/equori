package httpapi

import (
	"context"
	"net/http"
	"strings"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/clock"
)

type memberKey struct{}

// Authorize is the single authorization point for /api/ (HA9). required returns the x-book-role of
// the operation r matches, and whether r matches one. Deny by default: a path without an operation
// needs a session, and an operation without x-book-role is 403.
func (s *Server) Authorize(next http.Handler, required func(*http.Request) (role string, matched bool)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role, matched := required(r)
		if !isAPI(r) || (matched && role == rolePublic) {
			next.ServeHTTP(w, r)
			return
		}

		cookie, err := r.Cookie(CookieName)
		if err != nil {
			s.errs.Write(w, r, app.ErrUnauthenticated)
			return
		}

		access, err := s.svc.Authenticate(r.Context(), cookie.Value)
		if err != nil {
			s.errs.Write(w, r, err)
			return
		}

		if matched && !access.Role.Allows(auth.BookRole(role)) {
			s.errs.Write(w, r, app.ErrBookRoleRequired)
			return
		}

		loc, err := s.svc.Location(r.Context(), access.BooksID)
		if err != nil {
			s.errs.Write(w, r, err)
			return
		}

		ctx := clock.WithLocation(auth.WithIdentity(r.Context(), access.Member.ID, access.BooksID, access.Role), loc)
		ctx = context.WithValue(ctx, memberKey{}, access.Member)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func isAPI(r *http.Request) bool {
	return strings.HasPrefix(r.URL.Path, "/api/")
}
