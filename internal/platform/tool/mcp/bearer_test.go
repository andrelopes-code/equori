package mcp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/auth"
)

// Review of phase 3: only a refused token answers 401; a failing verification is a server error.
func TestAuthenticateStatus(t *testing.T) {
	t.Parallel()

	next := http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) },
	)
	for _, tt := range []struct {
		name string
		err  error
		want int
	}{
		{"valid", nil, http.StatusOK},
		{"refused", ErrInvalidToken, http.StatusUnauthorized},
		{"database down", errors.New("connection refused"), http.StatusInternalServerError},
	} {
		h := authenticate(
			func(context.Context, string) (Grant, error) { return Grant{MemberID: 1, BooksID: 1}, tt.err },
			next,
		)
		r := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/mcp", nil)
		r.Header.Set("Authorization", "Bearer eqt_x")

		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)

		if w.Code != tt.want {
			t.Errorf("%s: status %d, want %d", tt.name, w.Code, tt.want)
		}
	}
}

// ADR 024 X20: a handler beside /mcp reads the member, the book and the role of the token's
// grant, as a tool call does.
func TestIdentified(t *testing.T) {
	t.Parallel()

	var member, books int64

	var role auth.BookRole

	h := Identified(
		func(context.Context, string) (Grant, error) {
			return Grant{MemberID: 7, BooksID: 3, Role: auth.RoleWrite}, nil
		},
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			member, books = auth.MustMemberID(r.Context()), auth.MustBooksID(r.Context())
			role, _ = auth.CurrentRole(r.Context())
			w.WriteHeader(http.StatusCreated)
		}),
	)

	r := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/mcp/files", nil)
	r.Header.Set("Authorization", "Bearer eqt_x")

	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusCreated || member != 7 || books != 3 || role != auth.RoleWrite {
		t.Errorf("status %d, member %d, books %d, role %q", w.Code, member, books, role)
	}

	r = httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/mcp/files", nil)
	w = httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("without a token: status %d, want 401", w.Code)
	}
}
