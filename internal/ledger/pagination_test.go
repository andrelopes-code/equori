package ledger_test

import (
	"encoding/json/jsontext"
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type pageOf struct {
	Items      []jsontext.Value `json:"items"`
	NextCursor string           `json:"next_cursor"`
}

// walk reads a list one item per page and returns the raw items in order.
func walk(t *testing.T, h *apitest.Harness, path string) ([]string, string) {
	t.Helper()
	var items []string
	var firstCursor string
	sep := "?"
	if slices.Contains([]byte(path), '?') {
		sep = "&"
	}
	cursor := ""
	for range 100 {
		url := path + sep + "limit=1"
		if cursor != "" {
			url += "&cursor=" + cursor
		}
		var p pageOf
		h.MustDo(http.MethodGet, url, nil, http.StatusOK, &p)
		if len(p.Items) > 1 {
			t.Fatalf("%s returned %d items for limit=1", url, len(p.Items))
		}
		for _, it := range p.Items {
			items = append(items, string(it))
		}
		if p.NextCursor == "" {
			return items, firstCursor
		}
		if firstCursor == "" {
			firstCursor = p.NextCursor
		}
		cursor = p.NextCursor
	}
	t.Fatalf("%s did not end", path)
	return nil, ""
}

// ADR 007, C8: lists that grow with use are paginated by cursor.
func TestGrowingListsPaginate(t *testing.T) {
	c := newCardSetup(t, "2026-12-20")
	h := c.h
	for _, name := range []string{"Caixa", "Banco do Brasil", "Inter"} {
		h.MustDo(http.MethodPost, "/api/v1/institutions", map[string]string{"name": name}, http.StatusCreated, nil)
		h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": name}, http.StatusCreated, nil)
	}
	tx := h.Record("2026-10-01", apitest.Posting(c.checking, -100), apitest.Posting(c.food, 100))
	h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{"date": "2026-10-02", "tags": []string{"b", "a", "c"},
		"postings": []map[string]any{apitest.Posting(c.checking, -1), apitest.Posting(c.food, 1)}}, http.StatusCreated, nil)
	c.purchase("2026-10-14", 100)
	c.purchase("2026-11-14", 100)
	c.purchase("2026-12-14", 100)
	for _, d := range []string{"2026-10-10", "2026-10-20", "2026-10-31"} {
		assertBalance(h, c.checking, d, -101)
	}
	for _, name := range []string{"a.txt", "b.txt", "c.txt"} {
		mustAttach(t, h, tx, name, []byte("receipt "+name))
	}

	lists := map[string]string{
		"accounts":           "/api/v1/accounts",
		"institutions":       "/api/v1/institutions",
		"payees":             "/api/v1/payees",
		"tags":               "/api/v1/tags",
		"statements":         "/api/v1/accounts/" + c.card + "/statements",
		"balance assertions": "/api/v1/accounts/" + c.checking + "/balance-assertions",
		"attachments":        "/api/v1/transactions/" + tx + "/attachments",
	}
	cursors := map[string]string{}
	for name, path := range lists {
		t.Run(name, func(t *testing.T) {
			paged, first := walk(t, h, path)
			var all pageOf
			h.MustDo(http.MethodGet, path+"?limit=200", nil, http.StatusOK, &all)
			want := make([]string, len(all.Items))
			for i, it := range all.Items {
				want[i] = string(it)
			}
			if len(want) < 3 || !slices.Equal(paged, want) || all.NextCursor != "" {
				t.Fatalf("pages = %v\nwant %v", paged, want)
			}
			cursors[name] = first
		})
	}
	// Review Focus 4: a cursor of one list is rejected by every other list.
	for from, cursor := range cursors {
		for to, path := range lists {
			if from == to {
				continue
			}
			h.ExpectProblem(h.Do(http.MethodGet, path+"?cursor="+cursor, nil), http.StatusBadRequest, "invalid_request", "cursor")
		}
	}
}
