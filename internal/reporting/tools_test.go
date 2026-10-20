package reporting_test

import (
	"encoding/json"
	"maps"
	"net/http"
	"reflect"
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

	// A refund on Hotel cancels Flights: Travel's subtree sums to zero, yet Travel stays as
	// the parent of categories with activity.
	travel := h.Account("Travel", "expense", "", nil)
	flights := h.Account("Flights", "expense", "", map[string]any{"parent_id": travel})
	hotel := h.Account("Hotel", "expense", "", map[string]any{"parent_id": travel})
	h.Record("2026-10-06", apitest.Posting(checking, -1000), apitest.Posting(flights, 1000))
	h.Record("2026-10-07", apitest.Posting(checking, 1000), apitest.Posting(hotel, -1000))
	h.Dispatch()

	type output struct {
		From       string         `json:"from"`
		To         string         `json:"to"`
		Categories []toolCategory `json:"categories"`
		NextCursor string         `json:"next_cursor"`
	}
	period := map[string]any{"class": "expense", "from": "2026-10-01", "to": "2026-10-31"}
	var got output
	if r := h.Tool("get_category_totals", period); r.IsError {
		t.Fatalf("get_category_totals = error %s", r.Content)
	} else if err := json.Unmarshal(r.Content, &got); err != nil {
		t.Fatal(err)
	}
	brl := func(amount string) tool.Money { return tool.Money{Amount: amount, Currency: "BRL"} }
	want := output{From: "2026-10-01", To: "2026-10-31", Categories: []toolCategory{
		{AccountID: flights, Name: "Flights", ParentID: travel, Total: brl("10.00"), SubtreeTotal: brl("10.00")},
		{AccountID: food, Name: "Food", Total: brl("0.00"), SubtreeTotal: brl("10.00")},
		{AccountID: groceries, Name: "Groceries", ParentID: food, Total: brl("10.00"), SubtreeTotal: brl("10.00")},
		{AccountID: hotel, Name: "Hotel", ParentID: travel, Total: brl("-10.00"), SubtreeTotal: brl("-10.00")},
		{AccountID: travel, Name: "Travel", Total: brl("0.00"), SubtreeTotal: brl("0.00")},
	}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("get_category_totals = %+v\nwant %+v", got, want)
	}

	var paged []toolCategory
	cursor := ""
	for {
		args := maps.Clone(period)
		args["limit"] = 2
		if cursor != "" {
			args["cursor"] = cursor
		}
		var p output
		r := h.Tool("get_category_totals", args)
		if err := json.Unmarshal(r.Content, &p); r.IsError || err != nil {
			t.Fatalf("page = %s, %v", r.Content, err)
		}
		paged = append(paged, p.Categories...)
		if cursor = p.NextCursor; cursor == "" {
			break
		}
	}
	if !reflect.DeepEqual(paged, want.Categories) {
		t.Errorf("pages of two = %+v", paged)
	}

	h.ExpectToolError(h.Tool("get_category_totals", map[string]any{"class": "expense", "from": "2026-01-01", "to": "2027-01-10"}), "invalid_request", "to")
	h.ExpectToolError(h.Tool("get_category_totals", map[string]any{"from": "2026-10-01", "to": "2026-10-31"}), "invalid_arguments", "")
}
