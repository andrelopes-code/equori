package identity_test

import (
	"net/http"
	"slices"
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

// BK12: an owner membership wins over a membership of a lower books ID.
func TestLoginPrefersOwnerBooks(t *testing.T) {
	h := apitest.Empty(t)
	email := "ann@example.com"

	if _, err := h.App.Identity.CreateUser(t.Context(), email, apitest.Password, "admin", locale.Locale{Language: "pt", Region: "BR"}, "BRL"); err != nil {
		t.Fatal(err)
	}

	writeBooks := h.BooksIDOf(email)
	memberID := h.MemberIDOf(email)

	var ownerBooks int64
	if err := h.Pool.QueryRow(t.Context(), `INSERT INTO identity_books (region) VALUES ('US') RETURNING id`).Scan(&ownerBooks); err != nil {
		t.Fatal(err)
	}

	if _, err := h.Pool.Exec(t.Context(), `UPDATE identity_membership SET role = 'write' WHERE member_id = $1`, memberID); err != nil {
		t.Fatal(err)
	}

	if _, err := h.Pool.Exec(t.Context(), `INSERT INTO identity_membership (member_id, books_id, role) VALUES ($1, $2, 'owner')`, memberID, ownerBooks); err != nil {
		t.Fatal(err)
	}

	r := h.Call(jarClient(t), http.MethodPost, "/api/v1/session", map[string]string{"email": email, "password": apitest.Password})
	if r.Status != http.StatusNoContent {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	var got int64
	if err := h.Pool.QueryRow(t.Context(), `SELECT books_id FROM identity_session WHERE member_id = $1`, memberID).Scan(&got); err != nil {
		t.Fatal(err)
	}

	if ownerBooks <= writeBooks || got != ownerBooks {
		t.Fatalf("session books = %d, want owner books %d (write books %d)", got, ownerBooks, writeBooks)
	}
}

// S187: two members of one instance each see only the rows of their own book.
func TestBooksIsolation(t *testing.T) {
	h := apitest.New(t)
	checking := h.Account("Checking", "asset", "checking", nil)
	other := h.Login("other@example.com")

	r := h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{
		"name":     "Savings",
		"class":    "asset",
		"kind":     "savings",
		"currency": "BRL",
	})
	if r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	var created struct {
		ID string `json:"id"`
	}
	r.Decode(t, &created)
	savings := created.ID

	tests := []struct {
		name    string
		call    func(method, path string) apitest.Response
		holds   string
		lacks   string
		foreign string
	}{
		{
			name:    "owner",
			call:    func(method, path string) apitest.Response { return h.Do(method, path, nil) },
			holds:   "Checking",
			lacks:   "Savings",
			foreign: savings,
		},
		{
			name:    "other",
			call:    func(method, path string) apitest.Response { return h.Call(other, method, path, nil) },
			holds:   "Savings",
			lacks:   "Checking",
			foreign: checking,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			list := tt.call(http.MethodGet, "/api/v1/accounts?limit=100")
			if list.Status != http.StatusOK {
				t.Fatalf("status %d: %s", list.Status, list.Body)
			}

			var page struct {
				Items []struct {
					Name string `json:"name"`
				} `json:"items"`
			}
			list.Decode(t, &page)

			names := make([]string, 0, len(page.Items))
			for _, item := range page.Items {
				names = append(names, item.Name)
			}

			if !slices.Contains(names, tt.holds) || slices.Contains(names, tt.lacks) {
				t.Errorf("names = %v; want %q and not %q", names, tt.holds, tt.lacks)
			}

			get := tt.call(http.MethodGet, "/api/v1/accounts/"+tt.foreign)
			h.ExpectProblem(get, http.StatusNotFound, "not_found", "")
		})
	}
}
