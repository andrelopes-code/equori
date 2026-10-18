package ledger_test

import (
	"net/http"
	"net/url"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestListTransactionsSearch(t *testing.T) {
	h := apitest.New(t)
	checking := h.Account("Checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	var payee idOnly
	h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": "Padaria Real"}, http.StatusCreated, &payee)

	record := func(date, description string, extra map[string]any, foodMemo string) string {
		t.Helper()
		foodPosting := apitest.Posting(food, 100)
		if foodMemo != "" {
			foodPosting["memo"] = foodMemo
		}
		body := tx(date, apitest.Posting(checking, -100), foodPosting)
		body["description"] = description
		for k, v := range extra {
			body[k] = v
		}
		var out idOnly
		h.MustDo(http.MethodPost, "/api/v1/transactions", body, http.StatusCreated, &out)
		return out.ID
	}
	a := record("2026-10-01", "Mercado Central", nil, "")
	b := record("2026-10-02", "x", map[string]any{"payee_id": payee.ID}, "")
	c := record("2026-10-03", "y", nil, "pão de queijo")
	d := record("2026-10-04", "50% off", nil, "")
	e := record("2026-10-05", "Feira 1", nil, "")
	f := record("2026-10-06", "Feira 2", nil, "")
	g := record("2026-10-07", "Feira 3", nil, "")

	list := func(c *http.Client, query string) []string {
		t.Helper()
		r := h.Call(c, http.MethodGet, "/api/v1/transactions?"+query, nil)
		if r.Status != http.StatusOK {
			t.Fatalf("GET transactions?%s = %d: %s", query, r.Status, r.Body)
		}
		var page struct {
			Items []idOnly `json:"items"`
		}
		r.Decode(t, &page)
		ids := make([]string, len(page.Items))
		for i, it := range page.Items {
			ids[i] = it.ID
		}
		return ids
	}

	other := h.Login("other@example.com")
	var otherChecking, otherFood idOnly
	for name, out := range map[string]*idOnly{"Checking": &otherChecking, "Food": &otherFood} {
		class, kind := "expense", ""
		if name == "Checking" {
			class, kind = "asset", "checking"
		}
		body := map[string]any{"name": name, "class": class, "currency": "BRL"}
		if kind != "" {
			body["kind"] = kind
		}
		r := h.Call(other, http.MethodPost, "/api/v1/accounts", body)
		if r.Status != http.StatusCreated {
			t.Fatalf("other user account %s = %d: %s", name, r.Status, r.Body)
		}
		r.Decode(t, out)
	}
	otherBody := tx("2026-10-01", apitest.Posting(otherChecking.ID, -100), apitest.Posting(otherFood.ID, 100))
	otherBody["description"] = "Mercado Central"
	r := h.Call(other, http.MethodPost, "/api/v1/transactions", otherBody)
	if r.Status != http.StatusCreated {
		t.Fatalf("other user transaction = %d: %s", r.Status, r.Body)
	}
	var otherTx idOnly
	r.Decode(t, &otherTx)

	tests := []struct {
		name   string
		client *http.Client
		query  string
		want   []string
	}{
		{"description is case-insensitive", h.Client, "q=mercado", []string{a}},
		{"payee name", h.Client, "q=PADARIA", []string{b}},
		{"posting memo", h.Client, "q=queijo", []string{c}},
		{"percent is literal", h.Client, "q=" + url.QueryEscape("%"), []string{d}},
		{"underscore is literal", h.Client, "q=_", []string{}},
		{"combined with account filter", h.Client, "q=mercado&account_id=" + food, []string{a}},
		{"other user sees only its own match", other, "q=mercado", []string{otherTx.ID}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := list(tt.client, tt.query); !slices.Equal(got, tt.want) {
				t.Fatalf("ids = %v, want %v", got, tt.want)
			}
		})
	}

	t.Run("cursor pagination keeps the search", func(t *testing.T) {
		// Newest first: Feira 3, Feira 2, Feira 1.
		if got, want := list(h.Client, "q=feira"), []string{g, f, e}; !slices.Equal(got, want) {
			t.Fatalf("unpaged ids = %v, want %v", got, want)
		}
		var first struct {
			Items      []idOnly `json:"items"`
			NextCursor string   `json:"next_cursor"`
		}
		h.MustDo(http.MethodGet, "/api/v1/transactions?q=feira&limit=2", nil, http.StatusOK, &first)
		if len(first.Items) != 2 || first.Items[0].ID != g || first.Items[1].ID != f || first.NextCursor == "" {
			t.Fatalf("first page = %+v, want [%s %s] with a cursor", first, g, f)
		}
		var second struct {
			Items      []idOnly `json:"items"`
			NextCursor string   `json:"next_cursor"`
		}
		h.MustDo(http.MethodGet, "/api/v1/transactions?q=feira&limit=2&cursor="+url.QueryEscape(first.NextCursor), nil, http.StatusOK, &second)
		if len(second.Items) != 1 || second.Items[0].ID != e || second.NextCursor != "" {
			t.Fatalf("second page = %+v, want [%s] without a cursor", second, e)
		}
	})

	t.Run("q of 101 characters is rejected", func(t *testing.T) {
		h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/transactions?q="+strings.Repeat("a", 101), nil), http.StatusBadRequest, "invalid_request", "q")
	})

	t.Run("q of 100 characters is accepted", func(t *testing.T) {
		if got := list(h.Client, "q="+strings.Repeat("a", 100)); len(got) != 0 {
			t.Fatalf("ids = %v, want none", got)
		}
	})

	t.Run("empty q is rejected", func(t *testing.T) {
		h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/transactions?q=", nil), http.StatusBadRequest, "invalid_request", "q")
	})
}
