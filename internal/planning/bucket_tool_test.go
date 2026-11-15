package planning_test

import (
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// S438 through the assistant: save_buckets previews the method, writes it, and the plan of
// get_budgets_and_goals lists it.
func TestSaveBucketsTool(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	food := f.h.Account("Food", "expense", "", nil)
	args := map[string]any{
		"action": "save_buckets",
		"buckets": []map[string]any{
			{"name": "Needs", "share_bp": 7000, "category_ids": []string{f.rent, food}},
			{"name": "Freedom", "share_bp": 3000, "takes_savings": true},
		},
	}

	p, r := preview(t, f.h, "manage_budget_or_goal", args)
	if r.IsError {
		t.Fatalf("preview = error %s", r.Content)
	}

	want := tool.Preview{
		Action: "manage_budget_or_goal.save_buckets",
		Target: "Income split",
		Changes: []tool.Change{
			{Field: "name", After: tool.TextValue("Needs")},
			{Field: "rate", After: tool.TextValue("7000 bp of the reference")},
			{Field: "category", After: tool.TextValue("Rent, Food")},
			{Field: "name", After: tool.TextValue("Freedom")},
			{Field: "rate", After: tool.TextValue("3000 bp of the reference and the savings")},
		},
	}
	if !reflect.DeepEqual(p, want) {
		t.Errorf("preview = %+v, want %+v", p, want)
	}

	if got := f.bucketPlan("2026-11"); got.Buckets != nil {
		t.Fatalf("buckets after the preview = %+v", got.Buckets)
	}

	toolOutput(t, f.h, "manage_budget_or_goal", args, &toolManaged{})

	var out struct {
		Plan struct {
			Buckets []struct {
				Name       string   `json:"name"`
				ShareBP    int      `json:"share_bp"`
				Categories []string `json:"categories"`
			} `json:"buckets"`
		} `json:"plan"`
	}
	toolOutput(
		t,
		f.h,
		"get_budgets_and_goals",
		map[string]any{"month": "2026-11", "kind": "plan"},
		&out,
	)

	if b := out.Plan.Buckets; len(b) != 2 || b[0].Name != "Needs" || b[0].ShareBP != 7000 ||
		!reflect.DeepEqual(b[0].Categories, []string{"Rent", "Food"}) {
		t.Errorf("plan buckets = %+v", b)
	}
}

// S443 through the assistant: an empty list previews a destructive removal and removes the split.
func TestRemoveBucketsTool(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	f.saveBuckets(bucket("All", 10000, false, f.rent))

	args := map[string]any{"action": "save_buckets", "buckets": []map[string]any{}}

	p, r := preview(t, f.h, "manage_budget_or_goal", args)
	if r.IsError {
		t.Fatalf("preview = error %s", r.Content)
	}

	want := tool.Preview{
		Action:      "manage_budget_or_goal.save_buckets",
		Target:      "Income split",
		Destructive: true,
		Changes:     []tool.Change{{Field: "name", Before: tool.TextValue("All")}},
	}
	if !reflect.DeepEqual(p, want) {
		t.Errorf("preview = %+v, want %+v", p, want)
	}

	toolOutput(t, f.h, "manage_budget_or_goal", args, &toolManaged{})

	if got := f.bucketPlan("2026-11"); got.Buckets != nil {
		t.Errorf("buckets after removal = %+v", got.Buckets)
	}
}
