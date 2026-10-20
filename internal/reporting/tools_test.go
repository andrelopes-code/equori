package reporting_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type toolCategory struct {
	AccountID    string     `json:"account_id"`
	Name         string     `json:"name"`
	ParentID     string     `json:"parent_id"`
	Total        tool.Money `json:"total"`
	SubtreeTotal tool.Money `json:"subtree_total"`
}

func TestCategoryTotalsTool(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-20"))
	checking := h.Account("Checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	groceries := h.Account("Groceries", "expense", "", map[string]any{"parent_id": food})
	closed := h.Account("Closed", "expense", "", nil)
	h.MustDo(http.MethodPost, "/api/v1/accounts/"+closed+"/close", map[string]string{"closed_on": "2026-10-20"}, http.StatusOK, nil)
	h.Record("2026-10-05", apitest.Posting(checking, -1000), apitest.Posting(groceries, 1000))
	h.Dispatch()

	r := h.Tool("get_category_totals", map[string]any{"class": "expense", "from": "2026-10-01", "to": "2026-10-31"})
	if r.IsError {
		t.Fatalf("get_category_totals = error %s", r.Content)
	}
	var got struct {
		From       string         `json:"from"`
		To         string         `json:"to"`
		Categories []toolCategory `json:"categories"`
	}
	if err := json.Unmarshal(r.Content, &got); err != nil {
		t.Fatal(err)
	}
	if got.From != "2026-10-01" || got.To != "2026-10-31" {
		t.Errorf("period = %s to %s", got.From, got.To)
	}
	brl := func(amount string) tool.Money { return tool.Money{Amount: amount, Currency: "BRL"} }
	want := map[string]toolCategory{
		food:      {AccountID: food, Name: "Food", Total: brl("0.00"), SubtreeTotal: brl("10.00")},
		groceries: {AccountID: groceries, Name: "Groceries", ParentID: food, Total: brl("10.00"), SubtreeTotal: brl("10.00")},
	}
	seen := 0
	for _, c := range got.Categories {
		if c.AccountID == closed {
			t.Errorf("closed category with zero totals is listed: %+v", c)
		}
		if w, ok := want[c.AccountID]; ok {
			seen++
			if c != w {
				t.Errorf("category = %+v, want %+v", c, w)
			}
			continue
		}
		if c.Total != brl("0.00") || c.SubtreeTotal != brl("0.00") {
			t.Errorf("unexpected total in %+v", c)
		}
	}
	if seen != len(want) {
		t.Errorf("categories = %+v, want Food and Groceries", got.Categories)
	}

	h.ExpectToolError(h.Tool("get_category_totals", map[string]any{"class": "expense", "from": "2026-01-01", "to": "2027-01-10"}), "invalid_request", "to")
	h.ExpectToolError(h.Tool("get_category_totals", map[string]any{"from": "2026-10-01", "to": "2026-10-31"}), "invalid_arguments", "")
}
