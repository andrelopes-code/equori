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

// S543: a category that moves to another bucket in a later version is read in each month through
// the version of that month (A242).
func TestS543CategoryChangesBucket(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-17")
	food := f.h.Account("Food", "expense", "", nil)
	f.saveBucketsFrom("2026-09", bucket("Needs", 6000, false, food), bucket("Fun", 4000, false))

	needs := f.method("2026-09").Buckets[0].ID
	fun := f.method("2026-09").Buckets[1].ID
	f.saveBucketsFrom(
		"2026-11",
		withBucketID(needs, bucket("Needs", 6000, false)),
		withBucketID(fun, bucket("Fun", 4000, false, food)),
	)
	f.pay("2026-10-06", 10000, food, "")
	f.pay("2026-11-03", 4000, food, "")

	got := f.history("2026-11")

	october, november := got.Months[4], got.Months[5]
	if october.From == nil || *october.From != "2026-09" ||
		october.Buckets[0].Real.Amount != 10000 || october.Buckets[1].Real.Amount != 0 {
		t.Errorf("october = %+v, want from 2026-09 and [10000 0]", october)
	}

	if november.From == nil || *november.From != "2026-11" ||
		november.Buckets[0].Real.Amount != 0 || november.Buckets[1].Real.Amount != 4000 {
		t.Errorf("november = %+v, want from 2026-11 and [0 4000]", november)
	}
}

func TestS548HistoryAcrossVersions(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-17")
	food := f.h.Account("Food", "expense", "", nil)
	f.saveBucketsFrom("2026-09", bucket("Needs", 6000, false, food), bucket("Fun", 4000, false))
	f.saveBucketsFrom("2026-11", bucket("Needs", 5000, false, food), bucket("Fun", 5000, false))
	f.pay("2026-11-03", 4000, food, "")

	got := f.history("2026-11")
	if len(got.Methods) != 2 || *got.Methods[0].From != "2026-09" ||
		*got.Methods[1].From != "2026-11" {
		t.Fatalf("methods = %+v, want 2026-09 and 2026-11", got.Methods)
	}

	for _, m := range got.Months {
		wantFrom := "2026-09"
		if m.Month >= "2026-11" {
			wantFrom = "2026-11"
		}

		if m.From == nil || *m.From != wantFrom {
			t.Fatalf("month %s from = %v, want %s", m.Month, m.From, wantFrom)
		}

		method := got.Methods[0]
		if wantFrom == "2026-11" {
			method = got.Methods[1]
		}

		for i, b := range m.Buckets {
			if b.ID != method.Buckets[i].ID {
				t.Errorf(
					"month %s bucket %d id = %s, want %s",
					m.Month,
					i,
					b.ID,
					method.Buckets[i].ID,
				)
			}
		}
	}

	g := newFixture(t, "2026-11-17")
	gfood := g.h.Account("Food", "expense", "", nil)
	g.saveBucketsFrom("2026-09", bucket("Needs", 10000, false, gfood))
	g.saveBucketsFrom("2026-11")
	g.pay("2026-11-03", 4000, gfood, "")

	ended := g.history("2026-11")
	if len(ended.Methods) != 1 {
		t.Errorf("methods with an end version = %+v, want 1", ended.Methods)
	}

	november := ended.Months[5]
	if november.From != nil || len(november.Buckets) != 0 || november.Outside.Amount != 4000 {
		t.Errorf("november = %+v, want no from, no bucket and outside 4000", november)
	}
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

func (f fixture) history(month string) bucketHistoryView {
	f.h.T().Helper()

	var out bucketHistoryView
	f.h.MustDo(http.MethodGet, bucketsPath+"/history?month="+month, nil, http.StatusOK, &out)

	return out
}

func withBucketID(id string, b map[string]any) map[string]any {
	b["id"] = id

	return b
}
