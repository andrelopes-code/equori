package ledger_test

import (
	"net/http"
	"net/url"
	"slices"
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
		{"other user", other, "q=mercado", []string{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := list(tt.client, tt.query); !slices.Equal(got, tt.want) {
				t.Fatalf("ids = %v, want %v", got, tt.want)
			}
		})
	}

	t.Run("empty q is rejected", func(t *testing.T) {
		h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/transactions?q=", nil), http.StatusBadRequest, "invalid_request", "q")
	})
}
