package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

// createSession answers 204 with the session cookie, or 202 with the second factor challenge and
// the pending login cookie.
func (s *Server) createSession(w http.ResponseWriter, r *http.Request) {
	b, ok := decodeBody[CreateSessionJSONRequestBody](s, w, r)
	if !ok {
		return
	}

	ctx := r.Context()

	session, pending, err := s.svc.Login(ctx, b.Email, b.Password, r.Header.Get("Origin"))
	switch {
	case errors.Is(err, app.ErrInvalidCredentials), errors.Is(err, app.ErrTooManyAttempts):
		s.log.WarnContext(ctx, "login failed", "email", b.Email, "reason", err.Error(),
			"request_id", httpserver.RequestID(ctx))
		s.errs.Write(w, r, err)

		return
	case err != nil:
		s.errs.Write(w, r, err)
		return
	}

	if pending != nil {
		s.writePendingLogin(w, r, pending)
		return
	}

	s.log.InfoContext(
		ctx,
		"login succeeded",
		"member_id",
		session.MemberID,
		"books_id",
		session.BooksID,
		"method",
		app.MethodPassword,
		"request_id",
		httpserver.RequestID(ctx),
	)

	w.Header().Set("Set-Cookie", s.cookie(r, session.Token, session.ExpiresAt))
	w.WriteHeader(http.StatusNoContent)
}

// deleteSession answers 204 with the expired session cookie.
func (s *Server) deleteSession(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(CookieName); err == nil {
		if err := s.svc.Logout(r.Context(), c.Value); err != nil {
			s.errs.Write(w, r, err)
			return
		}
	}

	w.Header().Set("Set-Cookie", s.cookie(r, "", time.Unix(0, 0)))
	w.WriteHeader(http.StatusNoContent)
}
