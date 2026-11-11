package httpapi

import (
	"net/http"
	"time"
)

func (s *Server) cookie(value string, expires time.Time) string {
	//nolint:gosec // G124: Secure is false only when EQUORI_INSECURE_COOKIES=true (ADR 003).
	c := http.Cookie{
		Name:     CookieName,
		Value:    value,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		Secure:   s.secureCookies,
		SameSite: http.SameSiteLaxMode,
	}

	return c.String()
}

// loginCookie is the cookie of a pending login, sent only to the session routes.
func (s *Server) loginCookie(value string, expires time.Time) string {
	//nolint:gosec // G124: Secure is false only when EQUORI_INSECURE_COOKIES=true (ADR 003).
	c := http.Cookie{
		Name:     loginCookieName,
		Value:    value,
		Path:     "/api/v1/session",
		Expires:  expires,
		HttpOnly: true,
		Secure:   s.secureCookies,
		SameSite: http.SameSiteLaxMode,
	}

	return c.String()
}
