package identity_test

import (
	"fmt"
	"net/http"
	"sync"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type memberItem struct {
	MemberID int64  `json:"member_id"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}

// HA19: a member of any role lists the memberships of the active book.
func TestListMembers(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	writer := h.JoinAs("writer@example.com", h.OwnerID(), "write")

	var list struct {
		Items []memberItem `json:"items"`
	}

	r := h.Call(writer, http.MethodGet, "/api/v1/books/current/members", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}

	r.Decode(t, &list)

	want := []memberItem{
		{MemberID: h.MemberIDOf("owner@example.com"), Email: "owner@example.com", Role: "owner"},
		{MemberID: h.MemberIDOf("writer@example.com"), Email: "writer@example.com", Role: "write"},
	}

	if len(list.Items) != len(want) {
		t.Fatalf("items = %+v, want %+v", list.Items, want)
	}

	for i := range want {
		if list.Items[i] != want[i] {
			t.Errorf("items[%d] = %+v, want %+v", i, list.Items[i], want[i])
		}
	}
}

// HA20, HA22: an owner changes and removes a membership; removal ends its sessions and tokens.
func TestChangeAndRemoveMember(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	writer := h.JoinAs("writer@example.com", h.OwnerID(), "write")
	path := fmt.Sprintf("/api/v1/books/current/members/%d", h.MemberIDOf("writer@example.com"))

	expectStatus(t, h.Do(http.MethodPatch, path, map[string]string{"role": "read"}), http.StatusNoContent)
	h.ExpectProblem(h.Call(writer, http.MethodPost, "/api/v1/accounts", map[string]any{}), http.StatusForbidden, "book_role_required", "")
	h.ExpectProblem(
		h.Do(http.MethodPatch, "/api/v1/books/current/members/999999", map[string]string{"role": "read"}),
		http.StatusNotFound, "member_not_found", "",
	)

	token := h.Call(writer, http.MethodPost, "/api/v1/access-tokens",
		map[string]any{"name": "Claude Code", "scope": "read", "expires_in_days": 90})
	expectStatus(t, token, http.StatusCreated)

	expectStatus(t, h.Do(http.MethodDelete, path, nil), http.StatusNoContent)
	h.ExpectProblem(h.Call(writer, http.MethodGet, "/api/v1/me", nil), http.StatusUnauthorized, "unauthenticated", "")

	var tokens int
	if err := h.Pool.QueryRow(t.Context(),
		`SELECT count(*) FROM identity_access_token WHERE member_id = $1 AND books_id = $2`,
		h.MemberIDOf("writer@example.com"), h.OwnerID()).Scan(&tokens); err != nil || tokens != 0 {
		t.Fatalf("access tokens = %d, %v; want 0", tokens, err)
	}

	h.ExpectProblem(h.Do(http.MethodDelete, path, nil), http.StatusNotFound, "member_not_found", "")
}

// S196, HA21: the book keeps one owner.
func TestLastOwner(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.JoinAs("writer@example.com", h.OwnerID(), "write")
	ownerPath := fmt.Sprintf("/api/v1/books/current/members/%d", h.MemberIDOf("owner@example.com"))
	writerPath := fmt.Sprintf("/api/v1/books/current/members/%d", h.MemberIDOf("writer@example.com"))

	h.ExpectProblem(h.Do(http.MethodPatch, ownerPath, map[string]string{"role": "write"}), http.StatusConflict, "last_owner", "")
	h.ExpectProblem(h.Do(http.MethodDelete, "/api/v1/books/current/membership", nil), http.StatusConflict, "last_owner", "")

	expectStatus(t, h.Do(http.MethodPatch, writerPath, map[string]string{"role": "owner"}), http.StatusNoContent)
	expectStatus(t, h.Do(http.MethodPatch, ownerPath, map[string]string{"role": "write"}), http.StatusNoContent)
}

// HA20: a member leaves the active book and the next login opens its own book.
func TestLeaveBooks(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	writer := h.JoinAs("writer@example.com", h.OwnerID(), "write")

	var own int64
	if err := h.Pool.QueryRow(t.Context(),
		`SELECT books_id FROM identity_membership WHERE member_id = $1 AND role = 'owner'`,
		h.MemberIDOf("writer@example.com")).Scan(&own); err != nil {
		t.Fatal(err)
	}

	r := h.Call(writer, http.MethodDelete, "/api/v1/books/current/membership", nil)
	expectStatus(t, r, http.StatusNoContent)

	cookies := (&http.Response{Header: r.Header}).Cookies()
	if len(cookies) != 1 || cookies[0].Name != "equori_session" || cookies[0].Expires.Unix() != 0 {
		t.Errorf("cookies = %+v, want equori_session expired at the Unix epoch", cookies)
	}

	var left int
	if err := h.Pool.QueryRow(t.Context(),
		`SELECT count(*) FROM identity_membership WHERE member_id = $1 AND books_id = $2`,
		h.MemberIDOf("writer@example.com"), h.OwnerID()).Scan(&left); err != nil || left != 0 {
		t.Fatalf("memberships of the left book = %d, %v; want 0", left, err)
	}

	var me meView

	r = h.Call(h.SignIn("writer@example.com"), http.MethodGet, "/api/v1/me", nil)
	expectStatus(t, r, http.StatusOK)
	r.Decode(t, &me)

	if me.BooksID != own {
		t.Errorf("books_id = %d, want %d", me.BooksID, own)
	}
}

// HA21: two simultaneous demotions leave one owner.
func TestConcurrentDemotions(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	writer := h.JoinAs("writer@example.com", h.OwnerID(), "write")
	ownerID := h.MemberIDOf("owner@example.com")
	writerID := h.MemberIDOf("writer@example.com")

	expectStatus(t, h.Do(http.MethodPatch, fmt.Sprintf("/api/v1/books/current/members/%d", writerID), map[string]string{"role": "owner"}), http.StatusNoContent)

	owner := h.SignIn("owner@example.com")

	for _, c := range []*http.Client{owner, writer} {
		expectStatus(t, h.Call(c, http.MethodGet, "/api/v1/me", nil), http.StatusOK)
	}

	start := make(chan struct{})
	results := make([]apitest.Response, 2)

	var wg sync.WaitGroup

	for i, call := range []struct {
		client   *http.Client
		memberID int64
	}{{owner, writerID}, {writer, ownerID}} {
		wg.Add(1)

		go func() {
			defer wg.Done()

			<-start

			results[i] = h.Call(call.client, http.MethodPatch,
				fmt.Sprintf("/api/v1/books/current/members/%d", call.memberID), map[string]string{"role": "write"})
		}()
	}

	close(start)
	wg.Wait()

	// The loser meets its new role at Authorize (403) or the lock (409).
	switch {
	case results[0].Status == http.StatusNoContent:
		expectLoser(t, h, results[1])
	case results[1].Status == http.StatusNoContent:
		expectLoser(t, h, results[0])
	default:
		t.Fatalf("statuses = %d and %d, want one 204", results[0].Status, results[1].Status)
	}

	var owners int
	if err := h.Pool.QueryRow(t.Context(),
		`SELECT count(*) FROM identity_membership WHERE books_id = $1 AND role = 'owner'`, h.OwnerID()).Scan(&owners); err != nil || owners != 1 {
		t.Fatalf("owners = %d, %v; want 1", owners, err)
	}
}

func expectStatus(t *testing.T, r apitest.Response, want int) {
	t.Helper()

	if r.Status != want {
		t.Fatalf("status = %d, want %d: %s", r.Status, want, r.Body)
	}
}

func expectLoser(t *testing.T, h *apitest.Harness, r apitest.Response) {
	t.Helper()

	if r.Status == http.StatusConflict {
		h.ExpectProblem(r, http.StatusConflict, "last_owner", "")
		return
	}

	h.ExpectProblem(r, http.StatusForbidden, "book_role_required", "")
}
