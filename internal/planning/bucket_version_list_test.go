package planning_test

import (
	"net/http"
	"testing"
)

const bucketVersionsPath = bucketsPath + "/versions"

type versionListView struct {
	Versions []methodView `json:"versions"`
}

func TestS545DeleteVersion(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-17")
	f.saveBucketsFrom("2026-09", bucket("A", 10000, false))
	f.saveBucketsFrom("2026-11", bucket("B", 10000, false))

	got := f.versions()
	if len(got.Versions) != 2 || *got.Versions[0].From != "2026-09" ||
		got.Versions[0].Buckets[0].Name != "A" || *got.Versions[1].From != "2026-11" ||
		got.Versions[1].Buckets[0].Name != "B" {
		t.Fatalf("versions = %+v, want A from 2026-09 then B from 2026-11", got.Versions)
	}

	f.h.MustDo(http.MethodDelete, bucketVersionsPath+"/2026-11", nil, http.StatusNoContent, nil)

	if m := f.method("2026-11"); len(m.Buckets) != 1 || m.Buckets[0].Name != "A" {
		t.Errorf("method of 2026-11 = %+v, want A", m)
	}

	f.h.ExpectProblem(
		f.h.Do(http.MethodDelete, bucketVersionsPath+"/2026-11", nil),
		http.StatusNotFound,
		"not_found",
		"",
	)
	f.h.ExpectProblem(
		f.h.Do(http.MethodDelete, bucketVersionsPath+"/2026-13", nil),
		http.StatusBadRequest,
		"invalid_request",
		"from",
	)
}

func TestS546DeleteLeavesNoLeadingEmptyVersion(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-17")
	f.saveBucketsFrom("2026-09", bucket("A", 10000, false))
	f.saveBucketsFrom("2026-11")

	f.h.MustDo(http.MethodDelete, bucketVersionsPath+"/2026-09", nil, http.StatusNoContent, nil)

	if got := f.versions(); len(got.Versions) != 0 {
		t.Errorf("versions = %+v, want none", got.Versions)
	}
}

func TestBucketVersionRoles(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-17")
	f.saveBucketsFrom("2026-09", bucket("A", 10000, false))
	f.saveBucketsFrom("2026-11", bucket("B", 10000, false))

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	if r := f.h.Call(reader, http.MethodGet, bucketVersionsPath, nil); r.Status != http.StatusOK {
		t.Fatalf("reader GET = %d: %s", r.Status, r.Body)
	}

	f.h.ExpectProblem(
		f.h.Call(reader, http.MethodDelete, bucketVersionsPath+"/2026-11", nil),
		http.StatusForbidden,
		"book_role_required",
		"",
	)

	writer := f.h.JoinAs("writer@example.com", f.h.OwnerID(), "write")
	path := bucketVersionsPath + "/2026-11"

	if r := f.h.Call(writer, http.MethodDelete, path, nil); r.Status != http.StatusNoContent {
		t.Fatalf("writer DELETE = %d: %s", r.Status, r.Body)
	}

	anonymous := &http.Client{}
	f.h.ExpectProblem(
		f.h.Call(anonymous, http.MethodGet, bucketVersionsPath, nil),
		http.StatusUnauthorized,
		"unauthenticated",
		"",
	)
	f.h.ExpectProblem(
		f.h.Call(anonymous, http.MethodDelete, bucketVersionsPath+"/2026-09", nil),
		http.StatusUnauthorized,
		"unauthenticated",
		"",
	)
}

// A240 through the assistant: save_buckets takes from and the id of a bucket it continues.
func TestSaveBucketsToolFrom(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-17")
	f.saveBucketsFrom("2026-09", bucket("Needs", 10000, false))

	args := map[string]any{
		"action": "save_buckets",
		"month":  "2026-10",
		"buckets": []map[string]any{
			{"name": " needs ", "share_bp": 6000},
			{"name": "Rest", "share_bp": 4000},
		},
	}

	p, r := preview(t, f.h, "manage_budget_or_goal", args)
	if r.IsError {
		t.Fatalf("preview = error %s", r.Content)
	}

	if p.Changes[0].Field != "date" || p.Changes[0].After.Date != "2026-10-01" {
		t.Errorf("first change = %+v, want date 2026-10-01", p.Changes[0])
	}

	toolOutput(t, f.h, "manage_budget_or_goal", args, &toolManaged{})

	versions := f.versions().Versions
	if len(versions) != 2 || *versions[1].From != "2026-10" || len(versions[1].Buckets) != 2 {
		t.Fatalf("versions = %+v, want 2026-09 and 2026-10 with 2 buckets", versions)
	}

	first, second := versions[0].Buckets[0], versions[1].Buckets
	if second[0].ID != first.ID || second[1].ID == "" || second[1].ID == first.ID {
		t.Errorf("ids = %s, %s, want %s kept and a new id", second[0].ID, second[1].ID, first.ID)
	}

	if old := f.method("2026-09"); old.Buckets[0].Name != "Needs" {
		t.Errorf("method of 2026-09 = %+v, want Needs", old)
	}
}

// A240 through the assistant: kind split lists the versions; kind plan names the version it reads.
func TestBucketVersionsTool(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-17")
	f.saveBucketsFrom("2026-09", bucket("Needs", 6000, false), bucket("Rest", 4000, false))
	f.saveBucketsFrom("2026-11", bucket("Needs", 5000, false), bucket("Rest", 5000, false))

	var split struct {
		Versions []struct {
			From    string `json:"from"`
			Buckets []struct {
				Name    string `json:"name"`
				ShareBP int    `json:"share_bp"`
			} `json:"buckets"`
		} `json:"versions"`
	}
	toolOutput(
		t,
		f.h,
		"get_budgets_and_goals",
		map[string]any{"month": "2026-11", "kind": "split"},
		&split,
	)

	if len(split.Versions) != 2 || split.Versions[0].From != "2026-09" ||
		split.Versions[0].Buckets[0].ShareBP != 6000 || split.Versions[1].From != "2026-11" ||
		split.Versions[1].Buckets[1].Name != "Rest" {
		t.Errorf("versions = %+v, want 2026-09 and 2026-11", split.Versions)
	}

	var plan struct {
		Plan struct {
			BucketsFrom string `json:"buckets_from"`
		} `json:"plan"`
	}
	toolOutput(
		t,
		f.h,
		"get_budgets_and_goals",
		map[string]any{"month": "2026-10", "kind": "plan"},
		&plan,
	)

	if plan.Plan.BucketsFrom != "2026-09" {
		t.Errorf("buckets_from = %q, want 2026-09", plan.Plan.BucketsFrom)
	}
}

func (f fixture) versions() versionListView {
	f.h.T().Helper()

	var out versionListView
	f.h.MustDo(http.MethodGet, bucketVersionsPath, nil, http.StatusOK, &out)

	return out
}
