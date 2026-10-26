package ledger_test

import (
	"encoding/json/jsontext"
	"net/http"
	"slices"
	"strings"
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

// growingLists records at least three items in each list of ADR 007, C8, other
// than transactions, and returns the path of each list.
func growingLists(t *testing.T) (*apitest.Harness, cardSetup, map[string]string) {
	t.Helper()
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

	return h, c, map[string]string{
		"accounts":           "/api/v1/accounts",
		"institutions":       "/api/v1/institutions",
		"payees":             "/api/v1/payees",
		"tags":               "/api/v1/tags",
		"statements":         "/api/v1/accounts/" + c.card + "/statements",
		"balance assertions": "/api/v1/accounts/" + c.checking + "/balance-assertions",
		"attachments":        "/api/v1/transactions/" + tx + "/attachments",
	}
}

// ADR 007, C8: lists that grow with use are paginated by cursor.
func TestGrowingListsPaginate(t *testing.T) {
	t.Parallel()
	h, _, lists := growingLists(t)
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

// N23: every list of ADR 007, C8 pages by cursor under the rules of ADR 005,
// section 4, and applies its documented filters.
func TestN23EveryGrowingListPaginates(t *testing.T) {
	t.Parallel()
	h, c, lists := growingLists(t)
	lists["transactions"] = "/api/v1/transactions"
	type filter struct {
		query   string
		want    int
		eachHas string
	}
	filters := map[string]filter{
		"transactions": {"account_id=" + c.checking, 2, c.checking},
		"statements":   {"from=2026-11&to=2026-11", 1, `"reference":"2026-11"`},
	}
	for name, path := range lists {
		t.Run(name, func(t *testing.T) {
			var first, second pageOf
			h.MustDo(http.MethodGet, path+"?limit=2", nil, http.StatusOK, &first)
			if len(first.Items) != 2 || first.NextCursor == "" {
				t.Fatalf("limit=2: %d items, next_cursor %q", len(first.Items), first.NextCursor)
			}
			h.MustDo(http.MethodGet, path+"?limit=2&cursor="+first.NextCursor, nil, http.StatusOK, &second)
			if len(second.Items) == 0 {
				t.Fatal("page 2 is empty")
			}
			for _, it := range second.Items {
				for _, seen := range first.Items {
					if string(it) == string(seen) {
						t.Fatalf("page 2 repeats %s", it)
					}
				}
			}
			// walk follows next_cursor until it is absent on the last page.
			walk(t, h, path)
			for _, limit := range []string{"0", "201"} {
				h.ExpectProblem(h.Do(http.MethodGet, path+"?limit="+limit, nil), http.StatusBadRequest, "invalid_request", "limit")
			}
			h.ExpectProblem(h.Do(http.MethodGet, path+"?cursor=not-a-cursor", nil), http.StatusBadRequest, "invalid_request", "cursor")

			f, ok := filters[name]
			if !ok {
				return
			}
			var filtered pageOf
			h.MustDo(http.MethodGet, path+"?limit=200&"+f.query, nil, http.StatusOK, &filtered)
			if len(filtered.Items) != f.want || filtered.NextCursor != "" {
				t.Fatalf("%s: %d items, next_cursor %q; want %d items", f.query, len(filtered.Items), filtered.NextCursor, f.want)
			}
			for _, it := range filtered.Items {
				if !strings.Contains(string(it), f.eachHas) {
					t.Fatalf("%s returned %s", f.query, it)
				}
			}
		})
	}
}
