package mcp

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"
)

type grantKey struct{}

func grantFrom(ctx context.Context) (Grant, bool) {
	g, ok := ctx.Value(grantKey{}).(Grant)
	return g, ok
}

// authenticate refuses a foreign Origin (X3) and any request without a valid bearer token in the
// Authorization header (X11); the query string and the session cookie are never read.
func authenticate(verify Verify, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin != "" {
			if u, err := url.Parse(origin); err != nil || u.Host != r.Host {
				http.Error(w, "origin not allowed", http.StatusForbidden)
				return
			}
		}
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || token == "" {
			unauthorized(w)
			return
		}
		g, err := verify(r.Context(), token)
		if errors.Is(err, ErrInvalidToken) {
			unauthorized(w)
			return
		}
		if err != nil {
			http.Error(w, "the token could not be verified", http.StatusInternalServerError)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), grantKey{}, g)))
	})
}

func unauthorized(w http.ResponseWriter) {
	w.Header().Set("WWW-Authenticate", "Bearer")
	http.Error(w, "a valid access token is required", http.StatusUnauthorized)
}
