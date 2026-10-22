package ledger_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestTagsInAnyScript(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-22"))
	checking := h.Account("Checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	var created struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{
		"date": "2026-10-02", "description": "test", "tags": []string{"Café", "праздник", "a b"},
		"postings": []map[string]any{apitest.Posting(checking, -100), apitest.Posting(food, 100)},
	}, http.StatusCreated, &created)
	var got struct {
		Tags []string `json:"tags"`
	}
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+created.ID, nil, http.StatusOK, &got)
	if want := []string{"a-b", "café", "праздник"}; !slices.Equal(got.Tags, want) {
		t.Fatalf("tags = %q, want %q", got.Tags, want)
	}
}
