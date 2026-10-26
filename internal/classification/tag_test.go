package classification_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// A rule that adds a tag names the tag's new name after a rename, and the destination,
// once, after a merge.
func TestRuleTagsFollowTagRenameAndMerge(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	b.h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{"date": "2026-10-01", "description": "Hotel", "tags": []string{"trip", "work"},
		"postings": []any{apitest.Posting(b.checking, -100), apitest.Posting(b.travel, 100)}}, http.StatusCreated, nil)
	createRule(t, b.h, "Hotel", []map[string]any{contains("hotel")}, []map[string]any{setCategory(b.travel), {"type": "add_tags", "tags": []any{"trip", "work"}}})
	dispatch(t, b.h)
	tags := func() string { return fmt.Sprint(ruleByName(t, b.h, "Hotel").Actions[1]["tags"]) }

	b.h.MustDo(http.MethodPatch, "/api/v1/tags/trip", map[string]string{"name": "lisbon"}, http.StatusOK, nil)
	dispatch(t, b.h)
	if got := tags(); got != "[lisbon work]" {
		t.Fatalf("rule tags after rename = %s", got)
	}

	b.h.MustDo(http.MethodPost, "/api/v1/tags/lisbon/merge", map[string]string{"into": "work"}, http.StatusOK, nil)
	dispatch(t, b.h)
	if got := tags(); got != "[work]" {
		t.Fatalf("rule tags after merge = %s", got)
	}
}
