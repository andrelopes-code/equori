package apitest

import (
	"net/http"
	"net/http/cookiejar"

	"github.com/andrelopes-code/equori/internal/identity"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Login is LoginAs for a Brazilian member with BRL as base currency.
func (h *Harness) Login(email string) *http.Client {
	h.t.Helper()
	return h.LoginAs(email, locale.Locale{Language: "pt", Region: "BR"}, "BRL")
}

// LoginAs creates the member, runs the outbox so the ledger provisions it, and returns a client with its session.
func (h *Harness) LoginAs(email string, l locale.Locale, base money.Currency) *http.Client {
	h.t.Helper()
	return h.login(email, identity.RoleAdmin, l, base)
}

// LoginMember is Login for a member with the role member.
func (h *Harness) LoginMember(email string) *http.Client {
	h.t.Helper()
	return h.login(email, identity.RoleMember, locale.Locale{Language: "pt", Region: "BR"}, "BRL")
}

func (h *Harness) login(email, role string, l locale.Locale, base money.Currency) *http.Client {
	h.t.Helper()

	if _, err := h.App.Identity.CreateMember(h.t.Context(), email, Password, role, l, base); err != nil {
		h.t.Fatal(err)
	}

	h.Dispatch()

	return h.SignIn(email)
}

// SignIn returns a new client with the session of POST /api/v1/session for an existing member.
func (h *Harness) SignIn(email string) *http.Client {
	h.t.Helper()

	jar, err := cookiejar.New(nil)
	if err != nil {
		h.t.Fatal(err)
	}

	c := &http.Client{Jar: jar}
	if r := h.Call(c, http.MethodPost, "/api/v1/session", map[string]string{"email": email, "password": Password}); r.Status != http.StatusNoContent {
		h.t.Fatalf("login status %d: %s", r.Status, r.Body)
	}

	return c
}

// JoinAs creates a member with the instance role member and its own book, adds a membership of
// booksID with role, logs in and switches the session to booksID (HA4).
func (h *Harness) JoinAs(email string, booksID int64, role string) *http.Client {
	h.t.Helper()

	c := h.LoginMember(email)

	if _, err := h.Pool.Exec(h.t.Context(),
		`INSERT INTO identity_membership (member_id, books_id, role) VALUES ($1, $2, $3)`, h.MemberIDOf(email), booksID, role); err != nil {
		h.t.Fatal(err)
	}

	if r := h.Call(c, http.MethodPut, "/api/v1/session/books", map[string]int64{"books_id": booksID}); r.Status != http.StatusNoContent {
		h.t.Fatalf("switch books status %d: %s", r.Status, r.Body)
	}

	return c
}

// BooksIDOf returns the books ID that the member with email logs in to (HA3).
func (h *Harness) BooksIDOf(email string) int64 {
	h.t.Helper()

	var id int64
	if err := h.Pool.QueryRow(h.t.Context(),
		`SELECT ms.books_id FROM identity_membership ms JOIN identity_member m ON m.id = ms.member_id
		WHERE m.email = $1 ORDER BY ms.last_active_at DESC, ms.books_id LIMIT 1`, email).Scan(&id); err != nil {
		h.t.Fatal(err)
	}

	return id
}

// MemberIDOf returns the member ID of email.
func (h *Harness) MemberIDOf(email string) int64 {
	h.t.Helper()

	var id int64
	if err := h.Pool.QueryRow(h.t.Context(), `SELECT id FROM identity_member WHERE email = $1`, email).Scan(&id); err != nil {
		h.t.Fatal(err)
	}

	return id
}

// OwnerID returns BooksIDOf("owner@example.com").
func (h *Harness) OwnerID() int64 {
	h.t.Helper()
	return h.BooksIDOf("owner@example.com")
}
