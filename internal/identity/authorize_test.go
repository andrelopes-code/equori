package identity_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// TestBookRoles covers S192 and HA11.
func TestBookRoles(t *testing.T) {
	t.Parallel()

	h := apitest.New(t)
	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")
	writer := h.JoinAs("writer@example.com", h.OwnerID(), "write")

	type want struct {
		status int
		code   string
	}

	tests := []struct {
		name, method, path string
		body               any
		reader, writer     want
		owner              want
	}{
		{
			name: "read operation", method: http.MethodGet, path: "/api/v1/accounts",
			reader: want{http.StatusOK, ""}, writer: want{http.StatusOK, ""}, owner: want{http.StatusOK, ""},
		},
		{
			name: "write operation", method: http.MethodPost, path: "/api/v1/accounts",
			body:   map[string]any{"name": "<role>", "class": "asset", "kind": "cash", "currency": "BRL"},
			reader: want{http.StatusForbidden, "book_role_required"}, writer: want{http.StatusCreated, ""}, owner: want{http.StatusCreated, ""},
		},
		{
			name: "owner operation", method: http.MethodPatch, path: "/api/v1/books/current",
			body:   map[string]any{"region": "BR", "time_zone": nil},
			reader: want{http.StatusForbidden, "book_role_required"}, writer: want{http.StatusForbidden, "book_role_required"}, owner: want{http.StatusOK, ""},
		},
		{
			name: "role before the contract", method: http.MethodPost, path: "/api/v1/accounts",
			body:   map[string]any{"colour": "red"},
			reader: want{http.StatusForbidden, "book_role_required"}, writer: want{http.StatusBadRequest, "invalid_request"}, owner: want{http.StatusBadRequest, "invalid_request"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for who, c := range map[string]struct {
				client *http.Client
				want   want
			}{
				"reader": {reader, tt.reader},
				"writer": {writer, tt.writer},
				"owner":  {h.Client, tt.owner},
			} {
				body := tt.body
				if m, ok := body.(map[string]any); ok && m["name"] == "<role>" {
					body = map[string]any{"name": who, "class": m["class"], "kind": m["kind"], "currency": m["currency"]}
				}

				r := h.Call(c.client, tt.method, tt.path, body)
				if r.Status != c.want.status {
					t.Errorf("%s: status %d, want %d: %s", who, r.Status, c.want.status, r.Body)
					continue
				}

				if c.want.code != "" {
					h.ExpectProblem(r, c.want.status, c.want.code, "")
				}
			}
		})
	}
}

// TestRoleChangeAppliesAtOnce covers the role change of spec section 9.
func TestRoleChangeAppliesAtOnce(t *testing.T) {
	t.Parallel()

	h := apitest.New(t)
	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")
	body := map[string]any{"name": "Wallet", "class": "asset", "kind": "cash", "currency": "BRL"}

	h.ExpectProblem(h.Call(reader, http.MethodPost, "/api/v1/accounts", body), http.StatusForbidden, "book_role_required", "")

	if _, err := h.Pool.Exec(t.Context(),
		`UPDATE identity_membership SET role = 'write' WHERE member_id = $1`, h.MemberIDOf("reader@example.com")); err != nil {
		t.Fatal(err)
	}

	if r := h.Call(reader, http.MethodPost, "/api/v1/accounts", body); r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
}

// TestPublicOperations covers HA10.
func TestPublicOperations(t *testing.T) {
	t.Parallel()

	h := apitest.New(t)
	anonymous := &http.Client{}

	if r := h.Call(anonymous, http.MethodGet, "/api/v1/setup", nil); r.Status != http.StatusOK {
		t.Fatalf("setup status %d: %s", r.Status, r.Body)
	}

	h.ExpectProblem(
		h.Call(anonymous, http.MethodPost, "/api/v1/session", map[string]string{"email": "owner@example.com", "password": "wrong password!"}),
		http.StatusUnauthorized, "invalid_credentials", "")
	h.ExpectProblem(h.Call(anonymous, http.MethodGet, "/api/v1/accounts", nil), http.StatusUnauthorized, "unauthenticated", "")
}
