package identity_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type booksMembership struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Role   string `json:"role"`
	Active bool   `json:"active"`
}

type accountName struct {
	Name string `json:"name"`
}

type meView struct {
	BooksID  int64  `json:"books_id"`
	BookRole string `json:"book_role"`
	Role     string `json:"role"`
}

// HA4, HA5, HA6: a member lists, creates and switches its books.
func TestMyBooks(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	owned := h.OwnerID()
	_, without := regions(t)

	// GET /accounts lists the categories and system accounts the ledger provisions for each book.
	var accounts struct {
		Items []accountName `json:"items"`
	}

	h.MustDo(http.MethodGet, "/api/v1/accounts", nil, http.StatusOK, &accounts)
	provisioned := len(accounts.Items)
	h.Account("Only O", "asset", "checking", nil)

	var me meView
	h.MustDo(http.MethodGet, "/api/v1/me", nil, http.StatusOK, &me)

	if me.BooksID != owned || me.BookRole != "owner" {
		t.Fatalf("me = %+v, want books_id %d and book_role owner", me, owned)
	}

	var created booksMembership
	h.MustDo(http.MethodPost, "/api/v1/books", map[string]any{"name": "Casal", "region": "BR"}, http.StatusCreated, &created)

	if created.ID == 0 || created.Name != "Casal" || created.Role != "owner" || created.Active {
		t.Fatalf("created = %+v, want name Casal, role owner, active false", created)
	}

	h.Dispatch()

	var base string
	if err := h.Pool.QueryRow(t.Context(), `SELECT base_currency FROM ledger_settings WHERE books_id = $1`, created.ID).Scan(&base); err != nil || base != "BRL" {
		t.Fatalf("base_currency = %q, %v; want BRL", base, err)
	}

	var unnamed booksMembership
	h.MustDo(http.MethodPost, "/api/v1/books", map[string]any{"region": "PT", "base_currency": "EUR"}, http.StatusCreated, &unnamed)

	if unnamed.Name != "owner@example.com" {
		t.Errorf("name = %q, want owner@example.com", unnamed.Name)
	}

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/books", map[string]any{"region": without}), http.StatusUnprocessableEntity, "validation_failed", "base_currency")

	var list struct {
		Items []booksMembership `json:"items"`
	}

	h.MustDo(http.MethodGet, "/api/v1/me/books", nil, http.StatusOK, &list)

	want := []booksMembership{
		{ID: owned, Name: "owner@example.com", Role: "owner", Active: true},
		{ID: created.ID, Name: "Casal", Role: "owner"},
		{ID: unnamed.ID, Name: "owner@example.com", Role: "owner"},
	}
	if !slices.Equal(list.Items, want) {
		t.Fatalf("books = %+v, want %+v", list.Items, want)
	}

	if r := h.Do(http.MethodPut, "/api/v1/session/books", map[string]any{"books_id": created.ID}); r.Status != http.StatusNoContent {
		t.Fatalf("switch status %d: %s", r.Status, r.Body)
	}

	h.MustDo(http.MethodGet, "/api/v1/me", nil, http.StatusOK, &me)

	if me.BooksID != created.ID {
		t.Errorf("books_id = %d, want %d", me.BooksID, created.ID)
	}

	// C and O are both BR with BRL, so the ledger provisions them equally.
	h.MustDo(http.MethodGet, "/api/v1/accounts", nil, http.StatusOK, &accounts)

	if len(accounts.Items) != provisioned || slices.Contains(accounts.Items, accountName{"Only O"}) {
		t.Errorf("accounts of C = %+v, want %d provisioned items without Only O", accounts.Items, provisioned)
	}
}

// S193, HA4, HA7: a books ID without a membership of the member is 404, also for an admin.
func TestSwitchToForeignBooks(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	other := h.Login("other@example.com")

	var acct struct {
		ID string `json:"id"`
	}

	r := h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "X", "class": "asset", "kind": "cash", "currency": "BRL"})
	if r.Status != http.StatusCreated {
		t.Fatalf("create account status %d: %s", r.Status, r.Body)
	}

	r.Decode(t, &acct)

	h.ExpectProblem(h.Do(http.MethodPut, "/api/v1/session/books", map[string]any{"books_id": h.BooksIDOf("other@example.com")}), http.StatusNotFound, "books_not_found", "")

	if r := h.Do(http.MethodGet, "/api/v1/accounts/"+acct.ID, nil); r.Status != http.StatusNotFound {
		t.Errorf("foreign account status %d, want 404: %s", r.Status, r.Body)
	}

	h.ExpectProblem(h.Do(http.MethodPut, "/api/v1/session/books", map[string]any{"books_id": 999999}), http.StatusNotFound, "books_not_found", "")
}

// HA4: JoinAs gives a member the role in an existing book.
func TestJoinAs(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	c := h.JoinAs("bob@example.com", h.OwnerID(), "read")

	var me meView

	r := h.Call(c, http.MethodGet, "/api/v1/me", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	r.Decode(t, &me)

	if me.BooksID != h.OwnerID() || me.BookRole != "read" || me.Role != "member" {
		t.Errorf("me = %+v, want books_id %d, book_role read, role member", me, h.OwnerID())
	}
}
