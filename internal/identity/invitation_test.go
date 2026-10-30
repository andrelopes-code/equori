package identity_test

import (
	"net/http"
	"net/http/cookiejar"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type invitationBody struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
	Token     string    `json:"token"`
}

type previewBody struct {
	BooksName    string `json:"books_name"`
	InviterEmail string `json:"inviter_email"`
	Role         string `json:"role"`
	Email        string `json:"email"`
	MemberExists bool   `json:"member_exists"`
}

// S194, HA24 to HA26: an owner invites a new email; the acceptance creates the member in the book.
func TestInviteNewMember(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	var created invitationBody

	r := h.Do(http.MethodPost, "/api/v1/books/current/invitations", map[string]string{"email": "new@example.com", "role": "write"})
	expectStatus(t, r, http.StatusCreated)
	r.Decode(t, &created)

	if created.Email != "new@example.com" || created.Role != "write" || created.Token == "" ||
		created.ExpiresAt.Sub(created.CreatedAt) != 168*time.Hour {
		t.Fatalf("created = %+v", created)
	}

	tok := created.Token

	var list struct {
		Items []map[string]any `json:"items"`
	}

	r = h.Do(http.MethodGet, "/api/v1/books/current/invitations", nil)
	expectStatus(t, r, http.StatusOK)
	r.Decode(t, &list)

	if len(list.Items) != 1 {
		t.Fatalf("items = %+v, want 1", list.Items)
	}

	if _, ok := list.Items[0]["token"]; ok {
		t.Errorf("the list holds a token: %+v", list.Items[0])
	}

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}

	anon := &http.Client{Jar: jar}

	var preview previewBody

	r = h.Call(anon, http.MethodPost, "/api/v1/invitations/preview", map[string]string{"token": tok})
	expectStatus(t, r, http.StatusOK)
	r.Decode(t, &preview)

	if want := (previewBody{BooksName: "owner@example.com", InviterEmail: "owner@example.com", Role: "write", Email: "new@example.com"}); preview != want {
		t.Fatalf("preview = %+v, want %+v", preview, want)
	}

	accept := "/api/v1/invitations/accept"
	h.ExpectProblem(h.Call(anon, http.MethodPost, accept, map[string]string{"token": tok}), http.StatusUnprocessableEntity, "validation_failed", "password")
	h.ExpectProblem(
		h.Call(anon, http.MethodPost, accept, map[string]string{"token": tok, "password": "short", "language": "en"}),
		http.StatusUnprocessableEntity, "validation_failed", "password",
	)
	h.ExpectProblem(
		h.Call(anon, http.MethodPost, accept, map[string]string{"token": tok, "password": apitest.Password}),
		http.StatusUnprocessableEntity, "validation_failed", "language",
	)

	r = h.Call(anon, http.MethodPost, accept, map[string]string{"token": tok, "password": apitest.Password, "language": "en"})
	expectStatus(t, r, http.StatusNoContent)

	var me struct {
		Role     string `json:"role"`
		Language string `json:"language"`
		BooksID  int64  `json:"books_id"`
		BookRole string `json:"book_role"`
	}

	r = h.Call(anon, http.MethodGet, "/api/v1/me", nil)
	expectStatus(t, r, http.StatusOK)
	r.Decode(t, &me)

	if want := (struct {
		Role     string `json:"role"`
		Language string `json:"language"`
		BooksID  int64  `json:"books_id"`
		BookRole string `json:"book_role"`
	}{"member", "en", h.OwnerID(), "write"}); me != want {
		t.Fatalf("me = %+v, want %+v", me, want)
	}

	expectStatus(t, h.Call(anon, http.MethodGet, "/api/v1/accounts", nil), http.StatusOK)
	h.ExpectProblem(h.Call(anon, http.MethodPost, accept, map[string]string{"token": tok}), http.StatusNotFound, "invitation_not_found", "")

	r = h.Do(http.MethodGet, "/api/v1/books/current/invitations", nil)
	expectStatus(t, r, http.StatusOK)
	r.Decode(t, &list)

	if len(list.Items) != 0 {
		t.Fatalf("items = %+v, want 0", list.Items)
	}
}

// S195: an existing member accepts with its own session and the session moves to the book.
func TestInviteExistingMember(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	bob := h.Login("bob@example.com")
	bobBooks := h.BooksIDOf("bob@example.com")
	tok := invite(t, h, "bob@example.com", "read")

	var preview previewBody

	r := h.Call(&http.Client{}, http.MethodPost, "/api/v1/invitations/preview", map[string]string{"token": tok})
	expectStatus(t, r, http.StatusOK)
	r.Decode(t, &preview)

	if !preview.MemberExists {
		t.Fatalf("preview = %+v, want member_exists", preview)
	}

	accept := "/api/v1/invitations/accept"
	h.ExpectProblem(h.Call(&http.Client{}, http.MethodPost, accept, map[string]string{"token": tok}), http.StatusUnauthorized, "unauthenticated", "")
	expectStatus(t, h.Call(bob, http.MethodPost, accept, map[string]string{"token": tok}), http.StatusNoContent)

	var books struct {
		Items []struct {
			ID     int64 `json:"id"`
			Active bool  `json:"active"`
		} `json:"items"`
	}

	r = h.Call(bob, http.MethodGet, "/api/v1/me/books", nil)
	expectStatus(t, r, http.StatusOK)
	r.Decode(t, &books)

	got := map[int64]bool{}
	for _, b := range books.Items {
		got[b.ID] = b.Active
	}

	if len(got) != 2 || got[bobBooks] || !got[h.OwnerID()] {
		t.Fatalf("books = %+v, want %d inactive and %d active", books.Items, bobBooks, h.OwnerID())
	}

	expectStatus(t, h.Call(bob, http.MethodPut, "/api/v1/session/books", map[string]int64{"books_id": bobBooks}), http.StatusNoContent)

	var me struct {
		BooksID int64 `json:"books_id"`
	}

	r = h.Call(h.SignIn("bob@example.com"), http.MethodGet, "/api/v1/me", nil)
	expectStatus(t, r, http.StatusOK)
	r.Decode(t, &me)

	if me.BooksID != bobBooks {
		t.Fatalf("books_id = %d, want %d", me.BooksID, bobBooks)
	}
}

// HA26 and spec section 9: the problems of createInvitation, previewInvitation, acceptInvitation and deleteInvitation.
func TestInvitationProblems(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	bob := h.Login("bob@example.com")
	h.Login("carol@example.com")
	invitations := "/api/v1/books/current/invitations"

	post := func(email, role string) apitest.Response {
		return h.Do(http.MethodPost, invitations, map[string]string{"email": email, "role": role})
	}

	h.ExpectProblem(post("owner@example.com", "read"), http.StatusConflict, "already_member", "")
	h.ExpectProblem(post("not an email", "read"), http.StatusUnprocessableEntity, "validation_failed", "email")

	carolTok := invite(t, h, "carol@example.com", "read")
	accept := "/api/v1/invitations/accept"
	h.ExpectProblem(h.Call(bob, http.MethodPost, accept, map[string]string{"token": carolTok}), http.StatusForbidden, "invitation_email_mismatch", "")

	bobTok := invite(t, h, "bob@example.com", "read")
	expectStatus(t, h.Call(bob, http.MethodPost, accept, map[string]string{"token": bobTok}), http.StatusNoContent)
	h.ExpectProblem(post("bob@example.com", "write"), http.StatusConflict, "already_member", "")

	preview := func(token string) apitest.Response {
		return h.Call(&http.Client{}, http.MethodPost, "/api/v1/invitations/preview", map[string]string{"token": token})
	}

	h.ExpectProblem(preview("unknown"), http.StatusNotFound, "invitation_not_found", "")
	h.ExpectProblem(h.Do(http.MethodDelete, invitations+"/"+uuid.NewString(), nil), http.StatusNotFound, "invitation_not_found", "")

	var list struct {
		Items []invitationBody `json:"items"`
	}

	r := h.Do(http.MethodGet, invitations, nil)
	expectStatus(t, r, http.StatusOK)
	r.Decode(t, &list)

	if len(list.Items) != 1 || list.Items[0].Email != "carol@example.com" {
		t.Fatalf("items = %+v, want the invitation of carol", list.Items)
	}

	expectStatus(t, h.Do(http.MethodDelete, invitations+"/"+list.Items[0].ID, nil), http.StatusNoContent)
	h.ExpectProblem(preview(carolTok), http.StatusNotFound, "invitation_not_found", "")
}

// HA24: an expired invitation is not previewed, listed or kept.
func TestInvitationExpiry(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	tok := invite(t, h, "late@example.com", "read")

	if _, err := h.Pool.Exec(t.Context(), `UPDATE identity_invitation SET expires_at = now() - interval '1 second'`); err != nil {
		t.Fatal(err)
	}

	h.ExpectProblem(
		h.Call(&http.Client{}, http.MethodPost, "/api/v1/invitations/preview", map[string]string{"token": tok}),
		http.StatusNotFound, "invitation_not_found", "",
	)

	var list struct {
		Items []invitationBody `json:"items"`
	}

	r := h.Do(http.MethodGet, "/api/v1/books/current/invitations", nil)
	expectStatus(t, r, http.StatusOK)
	r.Decode(t, &list)

	if len(list.Items) != 0 {
		t.Fatalf("items = %+v, want 0", list.Items)
	}

	var rows int
	if err := h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM identity_invitation`).Scan(&rows); err != nil || rows != 0 {
		t.Fatalf("rows = %d, %v; want 0", rows, err)
	}
}

// HA24: a second invitation of the same email replaces the first.
func TestInvitationReplaced(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	first := invite(t, h, "x@example.com", "read")
	second := invite(t, h, "x@example.com", "write")
	preview := "/api/v1/invitations/preview"

	h.ExpectProblem(h.Call(&http.Client{}, http.MethodPost, preview, map[string]string{"token": first}), http.StatusNotFound, "invitation_not_found", "")

	var p previewBody

	r := h.Call(&http.Client{}, http.MethodPost, preview, map[string]string{"token": second})
	expectStatus(t, r, http.StatusOK)
	r.Decode(t, &p)

	if p.Role != "write" {
		t.Fatalf("preview = %+v, want role write", p)
	}

	var list struct {
		Items []invitationBody `json:"items"`
	}

	r = h.Do(http.MethodGet, "/api/v1/books/current/invitations", nil)
	expectStatus(t, r, http.StatusOK)
	r.Decode(t, &list)

	if len(list.Items) != 1 {
		t.Fatalf("items = %+v, want 1", list.Items)
	}
}

// S192: createInvitation needs the owner role.
func TestInvitationOwnerOnly(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	writer := h.JoinAs("writer@example.com", h.OwnerID(), "write")

	h.ExpectProblem(
		h.Call(writer, http.MethodPost, "/api/v1/books/current/invitations", map[string]string{"email": "x@example.com", "role": "read"}),
		http.StatusForbidden, "book_role_required", "",
	)
}

// invite posts an invitation from the owner and returns its token.
func invite(t *testing.T, h *apitest.Harness, email, role string) string {
	t.Helper()

	r := h.Do(http.MethodPost, "/api/v1/books/current/invitations", map[string]string{"email": email, "role": role})
	expectStatus(t, r, http.StatusCreated)

	var inv invitationBody
	r.Decode(t, &inv)

	return inv.Token
}
