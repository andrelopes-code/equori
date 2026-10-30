package identity_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

// S186: the first-user setup creates the member, its book and the owner membership.
func TestSetupCreatesBooks(t *testing.T) {
	h := apitest.Empty(t)
	token := startSetup(t, h)
	withDefault, _ := regions(t)

	body := setupBody(token, "ann@example.com", withDefault)
	body["base_currency"] = "BRL"

	r := h.Call(jarClient(t), http.MethodPost, "/api/v1/setup", body)
	if r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	h.Dispatch()

	var booksID int64

	var role, region string

	err := h.Pool.QueryRow(t.Context(), `SELECT ms.books_id, ms.role, b.region FROM identity_membership ms
		JOIN identity_books b ON b.id = ms.books_id WHERE ms.member_id = $1`, h.MemberIDOf("ann@example.com")).Scan(&booksID, &role, &region)
	if err != nil || role != "owner" || region != withDefault {
		t.Fatalf("membership = %d, %q, %q, %v; want owner of a book in %q", booksID, role, region, err, withDefault)
	}

	var base string
	if err := h.Pool.QueryRow(t.Context(), `SELECT base_currency FROM ledger_settings WHERE user_id = $1`, booksID).Scan(&base); err != nil || base != "BRL" {
		t.Errorf("base_currency = %q, %v; want BRL", base, err)
	}
}

// S191: a session ends when its membership is deleted.
func TestDeletedMembershipEndsSession(t *testing.T) {
	h := apitest.Empty(t)
	c := h.Login("ann@example.com")

	if r := h.Call(c, http.MethodGet, "/api/v1/me", nil); r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	if _, err := h.Pool.Exec(t.Context(), `DELETE FROM identity_membership WHERE member_id = $1`, h.MemberIDOf("ann@example.com")); err != nil {
		t.Fatal(err)
	}

	r := h.Call(c, http.MethodGet, "/api/v1/me", nil)
	h.ExpectProblem(r, http.StatusUnauthorized, "unauthenticated", "")
}

// BK12: the login picks an owner membership first, any membership next, none is a failure.
func TestLoginBooksOrder(t *testing.T) {
	for _, tt := range []struct {
		name   string
		change string
		status int
	}{
		{"owner only", "", http.StatusNoContent},
		{"write only", `UPDATE identity_membership SET role = 'write'`, http.StatusNoContent},
		{"none", `DELETE FROM identity_membership`, http.StatusUnauthorized},
	} {
		t.Run(tt.name, func(t *testing.T) {
			h := apitest.Empty(t)
			email := "ann@example.com"

			if _, err := h.App.Identity.CreateUser(t.Context(), email, apitest.Password, "admin", locale.Locale{Language: "pt", Region: "BR"}, "BRL"); err != nil {
				t.Fatal(err)
			}

			if tt.change != "" {
				if _, err := h.Pool.Exec(t.Context(), tt.change); err != nil {
					t.Fatal(err)
				}
			}

			r := h.Call(jarClient(t), http.MethodPost, "/api/v1/session", map[string]string{"email": email, "password": apitest.Password})
			if r.Status != tt.status {
				t.Fatalf("status %d: %s; want %d", r.Status, r.Body, tt.status)
			}

			if tt.status == http.StatusUnauthorized {
				h.ExpectProblem(r, http.StatusUnauthorized, "invalid_credentials", "")
			}
		})
	}
}
