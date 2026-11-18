package planning_test

import (
	"testing"
)

// TestDeleteBucketVersionTool deletes the version of 2026-11 through the tool: its months fall
// to the version of 2026-09 (S540 figures).
func TestDeleteBucketVersionTool(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-17")
	f.saveBucketsFrom("2026-09", bucket("Needs", 6000, false), bucket("Wants", 4000, false))
	f.saveBucketsFrom("2026-11", bucket("Needs", 5000, false), bucket("Wants", 5000, false))
	args := map[string]any{"action": "delete_bucket_version", "month": "2026-11"}

	if r := f.h.Tool("manage_budget_or_goal", args); r.IsError {
		t.Fatalf("delete = %s", r.Content)
	}

	got := f.bucketPlan("2026-11")
	if len(got.Buckets) != 2 || got.Buckets[0].ShareBP != 6000 || got.Buckets[1].ShareBP != 4000 {
		t.Fatalf("plan of 2026-11 = %+v, want the shares of 2026-09", got.Buckets)
	}

	f.h.ExpectToolError(f.h.Tool("manage_budget_or_goal", args), "not_found", "")
	f.h.ExpectToolError(
		f.h.Tool("manage_budget_or_goal", map[string]any{"action": "delete_bucket_version"}),
		"invalid_arguments",
		"month",
	)
}
