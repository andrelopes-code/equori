package identity_test

import (
	"errors"
	"net/http"
	"regexp"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/identity"
)

type accessToken struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Scope      string     `json:"scope"`
	Token      *string    `json:"token"`
	CreatedAt  time.Time  `json:"created_at"`
	ExpiresAt  time.Time  `json:"expires_at"`
	LastUsedAt *time.Time `json:"last_used_at"`
}

func createToken(t *testing.T, h *apitest.Harness, c *http.Client, scope string) accessToken {
	t.Helper()
	r := h.Call(c, http.MethodPost, "/api/v1/access-tokens", map[string]any{"name": "Claude Code", "scope": scope, "expires_in_days": 90})
	if r.Status != http.StatusCreated {
		t.Fatalf("create: status %d: %s", r.Status, r.Body)
	}
	var tok accessToken
	r.Decode(t, &tok)
	return tok
}

func listTokens(t *testing.T, h *apitest.Harness, c *http.Client) []map[string]any {
	t.Helper()
	r := h.Call(c, http.MethodGet, "/api/v1/access-tokens", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("list: status %d: %s", r.Status, r.Body)
	}
	var page struct {
		Items []map[string]any `json:"items"`
	}
	r.Decode(t, &page)
	return page.Items
}

// Design 2026-10-26 X5-X10, X13.
func TestAccessTokens(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	tok := createToken(t, h, h.Client, "read")
	if tok.Token == nil || !regexp.MustCompile(`^eqt_[A-Z2-7]{52}$`).MatchString(*tok.Token) || tok.Scope != "read" ||
		!tok.ExpiresAt.Equal(tok.CreatedAt.AddDate(0, 0, 90)) {
		t.Fatalf("created = %+v", tok)
	}
	items := listTokens(t, h, h.Client)
	if len(items) != 1 || items[0]["id"] != tok.ID || items[0]["name"] != "Claude Code" {
		t.Fatalf("list = %v", items)
	}
	if _, ok := items[0]["token"]; ok {
		t.Fatalf("list shows the token text: %v", items[0])
	}

	other := h.Login("bob@example.com")
	if items := listTokens(t, h, other); len(items) != 0 {
		t.Fatalf("other user lists %v", items)
	}
	h.ExpectProblem(h.Call(other, http.MethodDelete, "/api/v1/access-tokens/"+tok.ID, nil), http.StatusNotFound, "access_token_not_found", "")

	// X13: a token never opens /api/.
	req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, h.URL()+"/api/v1/accounts", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+*tok.Token)
	if r := h.Send(http.DefaultClient, req); r.Status != http.StatusUnauthorized {
		t.Fatalf("bearer on /api/: status %d", r.Status)
	}

	if r := h.Call(h.Client, http.MethodDelete, "/api/v1/access-tokens/"+tok.ID, nil); r.Status != http.StatusNoContent {
		t.Fatalf("delete: status %d: %s", r.Status, r.Body)
	}
	if items := listTokens(t, h, h.Client); len(items) != 0 {
		t.Fatalf("list after delete = %v", items)
	}
	if _, err := h.App.Identity.VerifyAccessToken(t.Context(), *tok.Token); !errors.Is(err, identity.ErrInvalidAccessToken) {
		t.Fatalf("verify a deleted token: %v", err)
	}
}

func TestAccessTokenExpiryChoices(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	r := h.Call(h.Client, http.MethodPost, "/api/v1/access-tokens", map[string]any{"name": "x", "scope": "read", "expires_in_days": 7})
	h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "expires_in_days")
}

func TestVerifyAccessToken(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	tok := createToken(t, h, h.Client, "write")
	grant, err := h.App.Identity.VerifyAccessToken(t.Context(), *tok.Token)
	if err != nil || grant.UserID != h.OwnerID() || grant.Scope != "write" || grant.TokenID.String() != tok.ID {
		t.Fatalf("grant = %+v, %v", grant, err)
	}
	var first time.Time
	if err := h.Pool.QueryRow(t.Context(), `SELECT last_used_at FROM identity_access_token`).Scan(&first); err != nil {
		t.Fatal(err)
	}
	if _, err := h.App.Identity.VerifyAccessToken(t.Context(), *tok.Token); err != nil {
		t.Fatal(err)
	}
	var second time.Time
	if err := h.Pool.QueryRow(t.Context(), `SELECT last_used_at FROM identity_access_token`).Scan(&second); err != nil || !second.Equal(first) {
		t.Fatalf("last_used_at moved within a minute: %v -> %v, %v", first, second, err)
	}
	for _, text := range []string{"", "eqt_unknown", "Bearer " + *tok.Token} {
		if _, err := h.App.Identity.VerifyAccessToken(t.Context(), text); !errors.Is(err, identity.ErrInvalidAccessToken) {
			t.Errorf("verify %q: %v", text, err)
		}
	}
	if _, err := h.Pool.Exec(t.Context(), `UPDATE identity_access_token
		SET created_at = created_at - interval '2 days', expires_at = created_at - interval '2 days' + interval '1 second'`); err != nil {
		t.Fatal(err)
	}
	if _, err := h.App.Identity.VerifyAccessToken(t.Context(), *tok.Token); !errors.Is(err, identity.ErrInvalidAccessToken) {
		t.Fatalf("verify an expired token: %v", err)
	}
}
