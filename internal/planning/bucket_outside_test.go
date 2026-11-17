package planning_test

import (
	"net/http"
	"reflect"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type outsidePlanView struct {
	OutsideCategoryIDs *[]string `json:"outside_category_ids"`
}

func (f fixture) outside(month string) *[]string {
	f.h.T().Helper()
	var out outsidePlanView
	f.h.MustDo(http.MethodGet, "/api/v1/budget-plan?month="+month, nil, http.StatusOK, &out)

	return out.OutsideCategoryIDs
}

// S532: an open expense category that neither sits in a bucket nor has an ancestor in one is
// outside the method of the plan's month, in name order; a subcategory of a placed root is not
// (A236).
func TestS532CategoriesOutsideTheMethod(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	pets := f.h.Account("Pets", "expense", "", nil)
	gym := f.h.Account("Gym", "expense", "", nil)
	f.h.Account("Utilities", "expense", "", map[string]any{"parent_id": f.rent})
	f.saveBuckets(bucket("Needs", 10000, false, f.rent))

	if got := f.outside("2026-11"); got == nil || !slices.Equal(*got, []string{gym, pets}) {
		t.Fatalf("outside = %v, want Gym then Pets", got)
	}

	var out struct {
		Plan struct {
			OutsideCategories []struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"outside_categories"`
		} `json:"plan"`
	}
	toolOutput(
		t,
		f.h,
		"get_budgets_and_goals",
		map[string]any{"month": "2026-11", "kind": "plan"},
		&out,
	)

	if o := out.Plan.OutsideCategories; len(o) != 2 || o[0].ID != gym || o[0].Name != "Gym" ||
		o[1].Name != "Pets" {
		t.Errorf("tool outside categories = %+v", o)
	}

	f.saveBuckets(bucket("Needs", 10000, false, f.rent, gym))

	if got := f.outside("2026-11"); got == nil || !slices.Equal(*got, []string{pets}) {
		t.Errorf("outside after placing Gym = %v, want Pets", got)
	}
}

// S533: a closed category and the uncategorized expense category are not listed; a month without
// a split has no list; a category placed from 2026-11 on is outside in the plan of 2026-10; a
// reader reads the field (A236).
func TestS533OutsideListBounds(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	old := f.h.Account("Old", "expense", "", nil)
	gym := f.h.Account("Gym", "expense", "", nil)

	if got := f.outside("2026-11"); got != nil {
		t.Fatalf("outside without a split = %v, want none", *got)
	}

	f.h.MustDo(
		http.MethodPost,
		"/api/v1/accounts/"+old+"/close",
		map[string]string{"closed_on": "2026-11-01"},
		http.StatusOK,
		nil,
	)
	f.saveBucketsFrom("2026-09", bucket("Needs", 10000, false, f.rent))
	f.saveBucketsFrom("2026-11", bucket("Needs", 10000, false, f.rent, gym))

	if got := f.outside("2026-11"); got == nil || len(*got) != 0 {
		t.Errorf("outside in 2026-11 = %v, want an empty list", got)
	}

	if got := f.outside("2026-10"); got == nil || !slices.Equal(*got, []string{gym}) {
		t.Errorf("outside in 2026-10 = %v, want Gym", got)
	}

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")

	r := f.h.Call(reader, http.MethodGet, "/api/v1/budget-plan?month=2026-10", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("reader GET = %d: %s", r.Status, r.Body)
	}

	var seen outsidePlanView
	r.Decode(t, &seen)

	if seen.OutsideCategoryIDs == nil || !slices.Equal(*seen.OutsideCategoryIDs, []string{gym}) {
		t.Errorf("reader outside = %v, want Gym", seen.OutsideCategoryIDs)
	}
}

// A236 through the assistant: save_buckets previews the categories the call leaves outside.
func TestSaveBucketsPreviewsTheOutsideCategories(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	f.h.Account("Pets", "expense", "", nil)
	f.h.Account("Gym", "expense", "", nil)
	args := map[string]any{
		"action": "save_buckets",
		"buckets": []map[string]any{
			{"name": "Needs", "share_bp": 10000, "category_ids": []string{f.rent}},
		},
	}

	p, r := preview(t, f.h, "manage_budget_or_goal", args)
	if r.IsError {
		t.Fatalf("preview = error %s", r.Content)
	}

	want := []tool.Change{
		{Field: "name", After: tool.TextValue("Needs")},
		{Field: "rate", After: tool.TextValue("10000 bp of the reference")},
		{Field: "category", After: tool.TextValue("Rent")},
		{Field: "category", After: tool.TextValue("Outside the split: Gym, Pets")},
	}
	if !reflect.DeepEqual(p.Changes, want) {
		t.Errorf("changes = %+v, want %+v", p.Changes, want)
	}
}
