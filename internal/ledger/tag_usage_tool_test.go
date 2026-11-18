package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// TestTagUsageTool counts the transactions that carry one tag.
func TestTagUsageTool(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)

	for _, date := range []string{"2026-10-20", "2026-10-21"} {
		h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{
			"date": date, "description": "x", "tags": []string{"trip"},
			"postings": []map[string]any{
				apitest.Posting(checking, -100), apitest.Posting(food, 100),
			},
		}, http.StatusCreated, nil)
	}

	var out struct {
		TagUsage struct {
			Name         string `json:"name"`
			Transactions int    `json:"transactions"`
		} `json:"tag_usage"`
	}
	toolOutput(t, h, "list_payees_and_tags", map[string]any{
		"kind": "tag_usage", "query": "trip",
	}, &out)

	if out.TagUsage.Name != "trip" || out.TagUsage.Transactions != 2 {
		t.Fatalf("tag usage = %+v, want trip in 2 transactions", out.TagUsage)
	}

	h.ExpectToolError(
		h.Tool("list_payees_and_tags", map[string]any{"kind": "tag_usage", "query": "nope"}),
		"not_found",
		"",
	)
	h.ExpectToolError(
		h.Tool("list_payees_and_tags", map[string]any{"kind": "tag_usage"}),
		"invalid_arguments",
		"query",
	)
}
