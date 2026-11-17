package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const bucketEntriesPath = bucketsPath + "/entries"

type entriesView struct {
	Currency string  `json:"currency"`
	Total    money   `json:"total"`
	Entries  []entry `json:"entries"`
}

type entry struct {
	TransactionID string `json:"transaction_id"`
	CategoryID    string `json:"category_id"`
	Date          string `json:"date"`
	Description   string `json:"description"`
	Payee         string `json:"payee"`
	Kind          string `json:"kind"`
	Amount        money  `json:"amount"`
}

// entriesFixture is the book of S446: Needs [food], Fun [fun], Freedom takes the savings.
type entriesFixture struct {
	fixture
	food, fun, gym string
}

func newEntriesFixture(t *testing.T) entriesFixture {
	t.Helper()

	f := newFixture(t, "2026-11-12")
	food := f.h.Account("Food", "expense", "", nil)
	fun := f.h.Account("Fun", "expense", "", map[string]any{"parent_id": food})
	gym := f.h.Account("Gym", "expense", "", nil)
	f.h.Record(
		"2026-10-05",
		apitest.Posting(f.checking, 500000),
		apitest.Posting(f.salary, -500000),
	)
	f.pay("2026-10-06", 120000, food, "")
	f.pay("2026-10-07", 30000, fun, "")
	f.pay("2026-10-08", 10000, gym, "")
	f.pay("2026-10-25", 340000, f.savings, "")
	f.saveBuckets(
		bucket("Needs", 5000, false, food),
		bucket("Fun", 3000, false, fun),
		bucket("Freedom", 2000, true),
	)

	return entriesFixture{fixture: f, food: food, fun: fun, gym: gym}
}

func (f fixture) entries(month, bucket string) entriesView {
	f.h.T().Helper()

	path := bucketEntriesPath + "?month=" + month
	if bucket != "" {
		path += "&bucket=" + bucket
	}

	var out entriesView
	f.h.MustDo(http.MethodGet, path, nil, http.StatusOK, &out)

	return out
}

// S549: the entries of a bucket are its expense postings, the latest first, and sum to its
// real amount in the history (A243).
func TestS549BucketEntries(t *testing.T) {
	t.Parallel()
	f := newEntriesFixture(t)
	needs := f.method("2026-10").Buckets[0].ID

	got := f.entries("2026-10", needs)
	if len(got.Entries) != 1 || got.Total.Amount != 120000 {
		t.Fatalf("entries = %+v, want one of 120000", got)
	}

	e := got.Entries[0]
	if e.Date != "2026-10-06" || e.Kind != "expense" || e.CategoryID != f.food ||
		e.Amount.Amount != 120000 {
		t.Errorf("entry = %+v, want 2026-10-06 expense food 120000", e)
	}

	f.pay("2026-10-20", 5000, f.food, f.landlord)

	got = f.entries("2026-10", needs)
	if len(got.Entries) != 2 || got.Total.Amount != 125000 ||
		got.Entries[0].Date != "2026-10-20" || got.Entries[0].Payee != "Landlord" ||
		got.Entries[1].Date != "2026-10-06" {
		t.Errorf("entries = %+v, want 2026-10-20 with a payee first, total 125000", got)
	}

	outside := f.entries("2026-10", "")
	if len(outside.Entries) != 1 || outside.Entries[0].CategoryID != f.gym ||
		outside.Entries[0].Amount.Amount != 10000 || outside.Total.Amount != 10000 {
		t.Errorf("outside = %+v, want gym 10000", outside)
	}
}

// S550: the entries of the bucket that takes the savings are the transactions into the savings
// accounts (A243).
func TestS550SavingsEntries(t *testing.T) {
	t.Parallel()
	f := newEntriesFixture(t)
	freedom := f.method("2026-10").Buckets[2].ID

	got := f.entries("2026-10", freedom)
	if len(got.Entries) != 1 {
		t.Fatalf("entries = %+v, want one", got)
	}

	e := got.Entries[0]
	if e.Kind != "savings" || e.Date != "2026-10-25" || e.Amount.Amount != 340000 ||
		e.CategoryID != "" || got.Total.Amount != 340000 {
		t.Errorf("entry = %+v total %d, want savings 2026-10-25 340000", e, got.Total.Amount)
	}
}

// The total of the entries of each bucket and of the spending outside equals the history.
func TestBucketEntriesMatchHistory(t *testing.T) {
	t.Parallel()
	f := newEntriesFixture(t)
	f.pay("2026-10-20", 5000, f.food, "")

	h := f.history("2026-10")
	october := h.Months[5]
	method := f.method("2026-10")

	for i, b := range method.Buckets {
		got := f.entries("2026-10", b.ID).Total.Amount
		if want := october.Buckets[i].Real.Amount; got != want {
			t.Errorf("bucket %s total = %d, want %d", b.Name, got, want)
		}
	}

	if got := f.entries("2026-10", "").Total.Amount; got != october.Outside.Amount {
		t.Errorf("outside total = %d, want %d", got, october.Outside.Amount)
	}
}

func TestS551EntriesAccess(t *testing.T) {
	t.Parallel()
	f := newEntriesFixture(t)
	needs := f.method("2026-10").Buckets[0].ID

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	path := bucketEntriesPath + "?month=2026-10&bucket=" + needs

	if r := f.h.Call(reader, http.MethodGet, path, nil); r.Status != http.StatusOK {
		t.Fatalf("reader GET = %d: %s", r.Status, r.Body)
	}

	f.h.ExpectProblem(
		f.h.Call(&http.Client{}, http.MethodGet, path, nil),
		http.StatusUnauthorized,
		"unauthenticated",
		"",
	)
	f.h.ExpectProblem(
		f.h.Do(
			http.MethodGet,
			bucketEntriesPath+"?month=2026-10&bucket=0198f3a2-7c1e-7b52-9a31-5d2f0c9e4b11",
			nil,
		),
		http.StatusNotFound,
		"not_found",
		"",
	)
	f.h.ExpectProblem(
		f.h.Do(http.MethodGet, bucketEntriesPath+"?month=2027-12", nil),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"month",
	)
}
