package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type methodView struct {
	From    *string      `json:"from"`
	Buckets []bucketView `json:"buckets"`
}

func TestS540MethodPerMonth(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-17")
	f.saveBucketsFrom("2026-09", bucket("Needs", 6000, false), bucket("Wants", 4000, false))
	f.saveBucketsFrom("2026-11", bucket("Needs", 5000, false), bucket("Wants", 5000, false))

	tests := []struct {
		month  string
		shares []int
	}{
		{"2026-10", []int{6000, 4000}},
		{"2026-11", []int{5000, 5000}},
		{"2026-12", []int{5000, 5000}},
	}
	for _, tt := range tests {
		got := f.bucketPlan(tt.month)
		if len(got.Buckets) != 2 || got.Buckets[0].ShareBP != tt.shares[0] ||
			got.Buckets[1].ShareBP != tt.shares[1] {
			t.Errorf("plan of %s buckets = %+v, want shares %v", tt.month, got.Buckets, tt.shares)
		}
	}
}

func TestS541FirstVersionCoversEarlierMonths(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-17")
	f.saveBuckets(bucket("Needs", 6000, false), bucket("Wants", 4000, false))

	got := f.method("2026-06")
	if len(got.Buckets) != 2 || got.From == nil || *got.From != "2026-11" {
		t.Errorf("method of 2026-06 = %+v, want 2 buckets from 2026-11", got)
	}
}

func TestS542SaveWithoutFromStartsThisMonth(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-17")
	f.saveBucketsFrom("2026-09", bucket("A", 10000, false))
	f.saveBuckets(bucket("B", 10000, false))

	older := f.method("2026-10")
	if len(older.Buckets) != 1 || older.Buckets[0].Name != "A" || *older.From != "2026-09" {
		t.Errorf("method of 2026-10 = %+v, want A from 2026-09", older)
	}

	current := f.method("")
	if len(current.Buckets) != 1 || current.Buckets[0].Name != "B" || *current.From != "2026-11" {
		t.Errorf("current method = %+v, want B from 2026-11", current)
	}

	f.h.ExpectProblem(
		f.h.Do(http.MethodPut, bucketsPath, map[string]any{
			"from":    "2027-12",
			"buckets": []map[string]any{bucket("C", 10000, false)},
		}),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"from",
	)
}

func TestS544EndOfTheSplit(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-17")
	f.saveBucketsFrom("2026-09", bucket("Needs", 10000, false))
	f.saveBucketsFrom("2026-11")

	if got := f.bucketPlan("2026-11"); len(got.Buckets) != 0 {
		t.Errorf("plan of 2026-11 buckets = %+v, want none", got.Buckets)
	}

	if got := f.bucketPlan("2026-10"); len(got.Buckets) != 1 || got.Buckets[0].Name != "Needs" {
		t.Errorf("plan of 2026-10 buckets = %+v, want Needs", got.Buckets)
	}

	g := newFixture(t, "2026-11-17")
	g.saveBuckets()

	got := g.method("")
	if got.Buckets == nil || len(got.Buckets) != 0 || got.From != nil {
		t.Errorf("method of a book without versions = %+v, want an empty list without from", got)
	}
}

func TestS547BucketIdentity(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-17")
	f.saveBucketsFrom("2026-09", bucket("Needs", 10000, false))

	x := f.method("2026-09").Buckets[0].ID

	withID := func(id, name string, share int) map[string]any {
		b := bucket(name, share, false)
		b["id"] = id

		return b
	}
	f.saveBucketsFrom("2026-11", withID(x, "Fixed", 6000), bucket("New", 4000, false))

	november := f.method("2026-11").Buckets
	if len(november) != 2 || november[0].ID != x || november[1].ID == x || november[1].ID == "" {
		t.Errorf("method of 2026-11 = %+v, want %s first and a new id second", november, x)
	}

	october := f.method("2026-10").Buckets
	if len(october) != 1 || october[0].ID != x || october[0].Name != "Needs" {
		t.Errorf("method of 2026-10 = %+v, want %s named Needs", october, x)
	}

	f.saveBucketsFrom("2026-11", withID(x, "Fixed", 6000), bucket("New", 4000, false))

	if got := f.method("2026-11").Buckets; got[0].ID != x {
		t.Errorf("first id after a replace = %s, want %s", got[0].ID, x)
	}

	save := func(buckets ...map[string]any) apitest.Response {
		return f.h.Do(http.MethodPut, bucketsPath, map[string]any{"buckets": buckets})
	}
	f.h.ExpectProblem(
		save(withID("0198f3a2-7c1e-7b52-9a31-5d2f0c9e4b11", "A", 10000)),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"buckets[0].id",
	)
	f.h.ExpectProblem(
		save(withID(x, "A", 5000), withID(x, "B", 5000)),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"buckets[1].id",
	)
}

func (f fixture) saveBucketsFrom(from string, buckets ...map[string]any) {
	f.h.T().Helper()

	if buckets == nil {
		buckets = []map[string]any{}
	}

	f.h.MustDo(
		http.MethodPut,
		bucketsPath,
		map[string]any{"from": from, "buckets": buckets},
		http.StatusNoContent,
		nil,
	)
}

func (f fixture) method(month string) methodView {
	f.h.T().Helper()

	path := bucketsPath
	if month != "" {
		path += "?month=" + month
	}

	var out methodView
	f.h.MustDo(http.MethodGet, path, nil, http.StatusOK, &out)

	return out
}
