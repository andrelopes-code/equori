package httpapi

import (
	"net/http"
	"strings"
	"time"
)

func (s *Server) cookie(r *http.Request, value string, expires time.Time) string {
	//nolint:gosec // G124: Secure is false only for a page over plain HTTP (ADR 003).
	c := http.Cookie{
		Name:     CookieName,
		Value:    value,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		Secure:   s.secure(r),
		SameSite: http.SameSiteLaxMode,
	}

	return c.String()
}

// loginCookie is the cookie of a pending login, sent only to the session routes.
func (s *Server) loginCookie(r *http.Request, value string, expires time.Time) string {
	//nolint:gosec // G124: Secure is false only for a page over plain HTTP (ADR 003).
	c := http.Cookie{
		Name:     loginCookieName,
		Value:    value,
		Path:     "/api/v1/session",
		Expires:  expires,
		HttpOnly: true,
		Secure:   s.secure(r),
		SameSite: http.SameSiteLaxMode,
	}

	return c.String()
}

// secure reads the scheme of the page from Origin, which a browser sends on every unsafe request
// and which stays right behind a proxy that ends TLS.
func (s *Server) secure(r *http.Request) bool {
	return s.secureCookies && !strings.HasPrefix(r.Header.Get("Origin"), "http://")
}
