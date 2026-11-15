package planning_test

import (
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
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

// S446 through the assistant: kind split lists six months with each bucket's target on the
// income received, its real amount and whether it kept to the target.
func TestSplitHistoryTool(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	f.h.Record(
		"2026-11-05",
		apitest.Posting(f.checking, 100000),
		apitest.Posting(f.salary, -100000),
	)
	f.pay("2026-11-06", 70000, f.rent, "")
	f.saveBuckets(bucket("Needs", 5000, false, f.rent), bucket("Freedom", 5000, true))

	var out struct {
		Split []struct {
			Month    string     `json:"month"`
			Received toolAmount `json:"received"`
			Buckets  []struct {
				Name   string     `json:"name"`
				Target toolAmount `json:"target"`
				Real   toolAmount `json:"real"`
				Kept   bool       `json:"kept"`
			} `json:"buckets"`
		} `json:"split"`
	}
	toolOutput(
		t,
		f.h,
		"get_budgets_and_goals",
		map[string]any{"month": "2026-11", "kind": "split"},
		&out,
	)

	if len(out.Split) != 6 {
		t.Fatalf("split = %+v", out.Split)
	}

	november := out.Split[5].Buckets
	if out.Split[5].Received.Amount != "1000.00" || len(november) != 2 ||
		november[0].Target.Amount != "500.00" || november[0].Real.Amount != "700.00" || november[0].Kept ||
		november[1].Real.Amount != "300.00" || november[1].Kept {
		t.Errorf("november = %+v", out.Split[5])
	}
}

// toolAmount is a tool's money: a decimal string with its currency.
type toolAmount struct {
	Amount   string `json:"amount"`
	Currency string `json:"currency"`
}
