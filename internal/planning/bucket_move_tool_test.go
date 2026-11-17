package planning_test

import (
	"reflect"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func move(category, bucket string) map[string]any {
	return map[string]any{"action": "move_category", "category_id": category, "bucket": bucket}
}

// bucketOf returns the name of the bucket of the method of month that holds category; empty
// when no bucket does.
func (f fixture) bucketOf(month, category string) string {
	f.h.T().Helper()

	for _, b := range f.method(month).Buckets {
		if slices.Contains(b.CategoryIDs, category) {
			return b.Name
		}
	}

	return ""
}

// S534: move_category places one category in the named bucket and removes it from the previous
// one, as the version of the current month; a subcategory placement overrides its root, and none
// returns the category to its ancestor's bucket (A237).
func TestS534MoveCategory(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	gym := f.h.Account("Gym", "expense", "", nil)
	water := f.h.Account("Water", "expense", "", map[string]any{"parent_id": f.rent})
	f.saveBucketsFrom(
		"2026-09",
		bucket("Needs", 6000, false, f.rent, gym),
		bucket("Wants", 4000, false),
	)

	p, r := preview(t, f.h, "manage_budget_or_goal", move(gym, "wants"))
	if r.IsError {
		t.Fatalf("preview = error %s", r.Content)
	}

	want := tool.Preview{
		Action: "manage_budget_or_goal.move_category",
		Target: "Gym",
		Changes: []tool.Change{
			{Field: "name", Before: tool.TextValue("Needs"), After: tool.TextValue("Wants")},
			{Field: "count", After: tool.TextValue("0 categories outside the split")},
		},
	}
	if !reflect.DeepEqual(p, want) {
		t.Errorf("preview = %+v, want %+v", p, want)
	}

	if got := f.bucketOf("2026-11", gym); got != "Needs" {
		t.Fatalf("bucket after the preview = %q, want Needs", got)
	}

	toolOutput(t, f.h, "manage_budget_or_goal", move(gym, "wants"), &toolManaged{})

	if got := f.bucketOf("2026-11", gym); got != "Wants" {
		t.Errorf("bucket in 2026-11 = %q, want Wants", got)
	}

	if got := f.method("2026-11").From; got == nil || *got != "2026-11" {
		t.Errorf("version of the move starts in %v, want 2026-11", got)
	}

	if got := f.bucketOf("2026-10", gym); got != "Needs" {
		t.Errorf("bucket in 2026-10 = %q, want Needs", got)
	}

	// The buckets keep their ids across the move (A241).
	before, after := f.method("2026-10").Buckets, f.method("2026-11").Buckets
	if len(after) != 2 || after[0].ID != before[0].ID || after[1].ID != before[1].ID {
		t.Errorf("bucket ids after the move = %+v, want those of %+v", after, before)
	}

	toolOutput(t, f.h, "manage_budget_or_goal", move(water, "Wants"), &toolManaged{})

	if got := f.bucketOf("2026-11", water); got != "Wants" {
		t.Errorf("bucket of the subcategory = %q, want Wants", got)
	}

	if got := f.bucketOf("2026-11", f.rent); got != "Needs" {
		t.Errorf("bucket of the root = %q, want Needs", got)
	}

	p, r = preview(t, f.h, "manage_budget_or_goal", move(gym, "none"))
	if r.IsError {
		t.Fatalf("preview of none = error %s", r.Content)
	}

	wantNone := []tool.Change{
		{Field: "name", Before: tool.TextValue("Wants")},
		{Field: "count", After: tool.TextValue("1 category outside the split")},
	}
	if !reflect.DeepEqual(p.Changes, wantNone) {
		t.Errorf("preview of none = %+v, want %+v", p.Changes, wantNone)
	}

	toolOutput(t, f.h, "manage_budget_or_goal", move(water, "none"), &toolManaged{})

	if got := f.bucketOf("2026-11", water); got != "" {
		t.Errorf("placement of the subcategory after none = %q, want none", got)
	}
}

// S534: an unknown bucket name, an income category and a current month without a split are each
// a validation error that stores nothing; a read token has no such action (A237).
func TestS534MoveCategoryErrors(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")

	f.h.ExpectToolError(
		f.h.Tool("manage_budget_or_goal", move(f.rent, "Needs")),
		"validation_failed",
		"bucket",
	)

	if got := f.method("2026-11").Buckets; len(got) != 0 {
		t.Fatalf("method after a move without a split = %+v", got)
	}

	f.saveBuckets(bucket("Needs", 6000, false, f.rent), bucket("Wants", 4000, false))

	for _, tt := range []struct {
		name, category, bucket, field string
	}{
		{"unknown bucket", f.rent, "Dreams", "bucket"},
		{"income category", f.salary, "Wants", "category_id"},
		{"balance account", f.checking, "Wants", "category_id"},
	} {
		f.h.ExpectToolError(
			f.h.Tool("manage_budget_or_goal", move(tt.category, tt.bucket)),
			"validation_failed",
			tt.field,
		)
	}

	if got := f.bucketOf("2026-11", f.rent); got != "Needs" {
		t.Errorf("bucket after the rejected moves = %q, want Needs", got)
	}

	// A read token lists the ReadOnly tools only (TestMCPListsToolsByScope): the action lives in a
	// tool that is not one of them.
	tl, ok := f.h.App.Tools.Tool("manage_budget_or_goal")
	if !ok || tl.Spec().Effect == tool.ReadOnly {
		t.Errorf("manage_budget_or_goal is listed to a read token: ok=%v", ok)
	}
}
