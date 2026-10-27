package mcp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Review of phase 3: only a refused token answers 401; a failing verification is a server error.
func TestAuthenticateStatus(t *testing.T) {
	t.Parallel()
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	for _, tt := range []struct {
		name string
		err  error
		want int
	}{
		{"valid", nil, http.StatusOK},
		{"refused", ErrInvalidToken, http.StatusUnauthorized},
		{"database down", errors.New("connection refused"), http.StatusInternalServerError},
	} {
		h := authenticate(func(context.Context, string) (Grant, error) { return Grant{UserID: 1}, tt.err }, next)
		r := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/mcp", nil)
		r.Header.Set("Authorization", "Bearer eqt_x")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != tt.want {
			t.Errorf("%s: status %d, want %d", tt.name, w.Code, tt.want)
		}
	}
}
