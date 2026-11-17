package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const bucketsPath = "/api/v1/budget-buckets"

type bucketView struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	ShareBP      int      `json:"share_bp"`
	TakesSavings bool     `json:"takes_savings"`
	CategoryIDs  []string `json:"category_ids"`
	Target       *money   `json:"target"`
	Planned      money    `json:"planned"`
	Spent        money    `json:"spent"`
}

type bucketPlanView struct {
	planView

	Buckets        []bucketView `json:"buckets"`
	OutsidePlanned *money       `json:"outside_planned"`
	OutsideSpent   *money       `json:"outside_spent"`
}

func TestS438SaveBucketMethod(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	food := f.h.Account("Food", "expense", "", nil)
	fun := f.h.Account("Fun", "expense", "", nil)

	f.saveBuckets(
		bucket("Needs", 5000, false, f.rent, food),
		bucket("Wants", 3000, false, fun),
		bucket("Savings", 2000, true),
	)

	got := f.bucketPlan("2026-11")

	want := []struct {
		name    string
		share   int
		savings bool
		count   int
	}{
		{"Needs", 5000, false, 2},
		{"Wants", 3000, false, 1},
		{"Savings", 2000, true, 0},
	}
	if len(got.Buckets) != len(want) {
		t.Fatalf("buckets = %+v", got.Buckets)
	}

	for i, w := range want {
		b := got.Buckets[i]
		if b.ID == "" || b.Name != w.name || b.ShareBP != w.share || b.TakesSavings != w.savings ||
			len(b.CategoryIDs) != w.count {
			t.Errorf("bucket %d = %+v, want %+v", i, b, w)
		}
	}
}

func TestS439BucketErrors(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	food := f.h.Account("Food", "expense", "", nil)
	other := f.h.Login("other@example.com")
	var foreign struct {
		ID string `json:"id"`
	}

	r := f.h.Call(
		other,
		http.MethodPost,
		"/api/v1/accounts",
		map[string]any{"name": "Foreign", "class": "expense", "currency": "BRL"},
	)
	if r.Status != http.StatusCreated {
		t.Fatalf("foreign category: %d %s", r.Status, r.Body)
	}

	r.Decode(t, &foreign)

	tests := []struct {
		name    string
		buckets []map[string]any
		field   string
	}{
		{"shares below the whole", []map[string]any{
			bucket("Needs", 5000, false), bucket("Wants", 4999, false),
		}, "buckets"},
		{"name used twice", []map[string]any{
			bucket("Needs", 5000, false), bucket(" needs ", 5000, false),
		}, "buckets[1].name"},
		{"blank name", []map[string]any{bucket("  ", 10000, false)}, "buckets[0].name"},
		{
			"share above the whole",
			[]map[string]any{bucket("Needs", 10001, false)},
			"buckets[0].share_bp",
		},
		{"two savings buckets", []map[string]any{
			bucket("Needs", 5000, true), bucket("Wants", 5000, true),
		}, "buckets[1].takes_savings"},
		{"category twice", []map[string]any{
			bucket("Needs", 5000, false, food), bucket("Wants", 5000, false, food),
		}, "buckets[1].category_ids"},
		{"income category", []map[string]any{
			bucket("Needs", 10000, false, f.salary),
		}, "buckets[0].category_ids"},
		{"category of another book", []map[string]any{
			bucket("Needs", 10000, false, foreign.ID),
		}, "buckets[0].category_ids"},
	}
	for _, tt := range tests {
		t.Log(tt.name)
		f.h.ExpectProblem(
			f.h.Do(http.MethodPut, bucketsPath, map[string]any{"buckets": tt.buckets}),
			http.StatusUnprocessableEntity,
			"validation_failed",
			tt.field,
		)
	}

	if got := f.bucketPlan("2026-11"); got.Buckets != nil {
		t.Errorf("buckets after errors = %+v", got.Buckets)
	}
}

// S440: the targets split the reference by largest remainder.
func TestS440BucketTargets(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	f.savePlan("2026-11", map[string]any{
		"source": "fixed", "fixed": apitest.BRL(100001), "amounts": []map[string]any{},
	})
	f.saveBuckets(bucket("A", 3333, false), bucket("B", 3333, false), bucket("C", 3334, false))

	got := f.bucketPlan("2026-11")
	for i, want := range []int64{33330, 33330, 33341} {
		if amountOf(got.Buckets[i].Target) != want {
			t.Errorf("bucket %d target = %v, want %d", i, got.Buckets[i].Target, want)
		}
	}
}

// S441: a budget counts in its category's bucket; spending counts in the bucket of the category
// it was posted to; a category in no bucket counts outside.
func TestS441BucketPlannedAndSpent(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-10")
	food := f.h.Account("Food", "expense", "", nil)
	restaurants := f.h.Account("Restaurants", "expense", "", map[string]any{"parent_id": food})
	gym := f.h.Account("Gym", "expense", "", nil)
	f.budget(food, 150000, "2026-11", false)
	f.budget(gym, 10000, "2026-11", false)
	f.pay("2026-11-03", 40000, food, "")
	f.pay("2026-11-04", 9000, restaurants, "")
	f.pay("2026-11-05", 7000, gym, "")
	f.pay("2026-10-05", 5000, food, "")

	f.saveBuckets(bucket("Needs", 6000, false, food), bucket("Pleasures", 4000, false, restaurants))

	got := f.bucketPlan("2026-11")
	if got.Buckets[0].Planned.Amount != 150000 || got.Buckets[0].Spent.Amount != 40000 {
		t.Errorf("needs = %+v, want planned 150000 spent 40000", got.Buckets[0])
	}

	if got.Buckets[1].Planned.Amount != 0 || got.Buckets[1].Spent.Amount != 9000 {
		t.Errorf("pleasures = %+v, want planned 0 spent 9000", got.Buckets[1])
	}

	if amountOf(got.OutsidePlanned) != 10000 || amountOf(got.OutsideSpent) != 7000 {
		t.Errorf("outside = %v %v, want 10000 7000", got.OutsidePlanned, got.OutsideSpent)
	}
}

// S442: the savings bucket plans the month's savings, holds what the month left (A233) and sets
// the savings target.
func TestS442SavingsBucket(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	paid := f.schedule("savings", f.checking, f.savings, 50000, monthly("2026-11-01", 10, ""), nil)
	f.schedule("savings", f.checking, f.savings, 30000, monthly("2026-11-01", 20, ""), nil)
	f.pay("2026-11-10", 50000, f.savings, "")
	f.h.Record(
		"2026-11-01",
		apitest.Posting(f.checking, 300000),
		apitest.Posting(f.salary, -300000),
	)
	f.pay("2026-11-01", 40000, f.rent, "")

	if o := f.occurrence(paid, 1); o.State != "realized" {
		t.Fatalf("paid occurrence = %+v, want realized", o)
	}

	f.savePlan("2026-11", map[string]any{
		"source": "fixed", "fixed": apitest.BRL(1000000), "savings_target_bp": 1000,
		"amounts": []map[string]any{},
	})

	f.saveBuckets(bucket("Living", 7500, false), bucket("Freedom", 2500, true))

	got := f.bucketPlan("2026-11")

	freedom := got.Buckets[1]
	// A233: the savings bucket holds what went into the savings accounts, the 500.00 paid.
	if freedom.Planned.Amount != 80000 || freedom.Spent.Amount != 50000 ||
		amountOf(freedom.Target) != 250000 {
		t.Errorf("freedom = %+v, want planned 80000 spent 50000 target 250000", freedom)
	}

	if got.SavingsTargetBP == nil || *got.SavingsTargetBP != 2500 ||
		amountOf(got.SavingsTarget) != 250000 {
		t.Errorf("savings target = %v %v, want 2500 250000", got.SavingsTargetBP, got.SavingsTarget)
	}
}

// S443: an empty list removes the method and the stored savings target applies again.
func TestS443RemoveBucketMethod(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	f.savePlan("2026-11", map[string]any{
		"source": "fixed", "fixed": apitest.BRL(1000000), "savings_target_bp": 1000,
		"amounts": []map[string]any{},
	})
	f.saveBuckets(bucket("Living", 7500, false, f.rent), bucket("Freedom", 2500, true))

	f.saveBuckets()

	got := f.bucketPlan("2026-11")
	if got.Buckets != nil || got.OutsidePlanned != nil || got.OutsideSpent != nil {
		t.Errorf("plan after removal = %+v", got)
	}

	if got.SavingsTargetBP == nil || *got.SavingsTargetBP != 1000 {
		t.Errorf("savings target = %v, want 1000", got.SavingsTargetBP)
	}
}

func TestBucketMethodRoles(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	body := map[string]any{"buckets": []map[string]any{bucket("All", 10000, false)}}

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	f.h.ExpectProblem(
		f.h.Call(reader, http.MethodPut, bucketsPath, body),
		http.StatusForbidden,
		"book_role_required",
		"",
	)

	writer := f.h.JoinAs("writer@example.com", f.h.OwnerID(), "write")
	if r := f.h.Call(writer, http.MethodPut, bucketsPath, body); r.Status != http.StatusNoContent {
		t.Fatalf("writer PUT = %d: %s", r.Status, r.Body)
	}

	f.h.ExpectProblem(
		f.h.Call(&http.Client{}, http.MethodPut, bucketsPath, body),
		http.StatusUnauthorized,
		"unauthenticated",
		"",
	)
}

func (f fixture) saveBuckets(buckets ...map[string]any) {
	f.h.T().Helper()

	if buckets == nil {
		buckets = []map[string]any{}
	}

	f.h.MustDo(
		http.MethodPut,
		bucketsPath,
		map[string]any{"buckets": buckets},
		http.StatusNoContent,
		nil,
	)
}

func (f fixture) bucketPlan(month string) bucketPlanView {
	f.h.T().Helper()
	var out bucketPlanView
	f.h.MustDo(http.MethodGet, "/api/v1/budget-plan?month="+month, nil, http.StatusOK, &out)

	return out
}

func bucket(name string, share int, savings bool, categories ...string) map[string]any {
	if categories == nil {
		categories = []string{}
	}

	return map[string]any{
		"name":          name,
		"share_bp":      share,
		"takes_savings": savings,
		"category_ids":  categories,
	}
}

// The database rejects a bucket without a book, a second savings bucket, a name used twice
// ignoring case, a category of another book (income buckets B1), and a bucket taking both the
// goals and the savings or a second goals bucket (A234). A version needs a book and a start on
// the first of a month; one name may repeat across versions (A240).
func TestBucketSchema(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	f.saveBuckets(bucket("Needs", 10000, true, f.rent))
	book := f.h.OwnerID()
	f.h.Login("other@example.com")
	other := f.h.BooksIDOf("other@example.com")
	ctx := t.Context()

	exec := func(query string, args ...any) error {
		_, err := f.h.Pool.Exec(ctx, query, args...)

		return err
	}
	if err := exec(
		`INSERT INTO planning_bucket_method (books_id, effective_from) VALUES ($1, '2026-11-01')`,
		other,
	); err != nil {
		t.Fatal(err)
	}

	insert := func(books any, name string, savings bool) error {
		return exec(
			`INSERT INTO planning_bucket
				(books_id, effective_from, lineage_id, position, name, share_bp, takes_savings)
			VALUES ($1, '2026-11-01', gen_random_uuid(), 5, $2, 0, $3)`,
			books,
			name,
			savings,
		)
	}

	tests := []struct {
		name string
		err  error
	}{
		{"without a book", insert(nil, "Wants", false)},
		{"second savings bucket", insert(book, "Wants", true)},
		{"name used twice", insert(book, "NEEDS", false)},
		{"goals and savings on one bucket", exec(`INSERT INTO planning_bucket
			(books_id, effective_from, lineage_id, position, name, share_bp, takes_savings, takes_goals)
			VALUES ($1, '2026-11-01', gen_random_uuid(), 6, 'Both', 0, true, true)`, other)},
		{"second goals bucket", exec(`INSERT INTO planning_bucket
			(books_id, effective_from, lineage_id, position, name, share_bp, takes_goals)
			VALUES ($1, '2026-11-01', gen_random_uuid(), 7, 'G1', 0, true),
				($1, '2026-11-01', gen_random_uuid(), 8, 'G2', 0, true)`, other)},
		{"category of another book", exec(`WITH b AS (
				INSERT INTO planning_bucket
					(books_id, effective_from, lineage_id, position, name, share_bp)
				VALUES ($1, '2026-11-01', gen_random_uuid(), 0, 'Other', 10000) RETURNING id)
			INSERT INTO planning_bucket_category (books_id, effective_from, category_id, bucket_id)
			SELECT $1, '2026-11-01', $2, id FROM b`, other, f.rent)},
		{"version without a book", exec(
			`INSERT INTO planning_bucket_method (books_id, effective_from)
			VALUES (NULL, '2026-12-01')`,
		)},
		{
			"version not on the first of a month",
			exec(
				`INSERT INTO planning_bucket_method (books_id, effective_from) VALUES ($1, '2026-11-02')`,
				book,
			),
		},
	}
	for _, tt := range tests {
		if tt.err == nil {
			t.Errorf("%s: insert succeeded, want a rejection", tt.name)
		}
	}

	if err := exec(
		`INSERT INTO planning_bucket_method (books_id, effective_from) VALUES ($1, '2026-12-01')`,
		book,
	); err != nil {
		t.Fatal(err)
	}

	err := exec(
		`INSERT INTO planning_bucket
			(books_id, effective_from, lineage_id, position, name, share_bp)
		VALUES ($1, '2026-12-01', gen_random_uuid(), 0, 'Needs', 0)`,
		book,
	)
	if err != nil {
		t.Errorf("same name in another version: %v, want accepted", err)
	}
}

// S444: a plan save under a savings bucket keeps the stored savings target, which applies again
// once the split is removed (A231).
func TestS444PlanSaveKeepsStoredTargetUnderSavingsBucket(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	body := map[string]any{
		"source": "fixed", "fixed": apitest.BRL(1000000), "savings_target_bp": 1000,
		"amounts": []map[string]any{},
	}
	f.savePlan("2026-11", body)
	f.saveBuckets(bucket("Living", 7500, false), bucket("Freedom", 2500, true))

	// The screen sends the target the plan shows: the bucket's share.
	body["savings_target_bp"] = 2500
	f.savePlan("2026-11", body)
	f.saveBuckets()

	if got := f.plan("2026-11"); got.SavingsTargetBP == nil || *got.SavingsTargetBP != 1000 {
		t.Errorf("savings target after removal = %v, want 1000", got.SavingsTargetBP)
	}
}

// S445: the stored method reads back without a month, in order, with its categories.
func TestS445GetBucketMethod(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	var empty struct {
		Buckets []bucketView `json:"buckets"`
	}
	f.h.MustDo(http.MethodGet, bucketsPath, nil, http.StatusOK, &empty)

	if empty.Buckets == nil || len(empty.Buckets) != 0 {
		t.Fatalf("method without buckets = %+v, want an empty list", empty.Buckets)
	}

	f.saveBuckets(bucket("Needs", 6000, false, f.rent), bucket("Freedom", 4000, true))

	var got struct {
		Buckets []bucketView `json:"buckets"`
	}
	f.h.MustDo(http.MethodGet, bucketsPath, nil, http.StatusOK, &got)

	if len(got.Buckets) != 2 || got.Buckets[0].Name != "Needs" ||
		len(got.Buckets[0].CategoryIDs) != 1 || got.Buckets[0].CategoryIDs[0] != f.rent ||
		!got.Buckets[1].TakesSavings {
		t.Errorf("method = %+v", got.Buckets)
	}

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	if r := f.h.Call(reader, http.MethodGet, bucketsPath, nil); r.Status != http.StatusOK {
		t.Errorf("reader GET = %d: %s", r.Status, r.Body)
	}
}

type bucketHistoryView struct {
	Buckets []bucketView `json:"buckets"`
	Months  []struct {
		Month    string `json:"month"`
		Received money  `json:"received"`
		Outside  money  `json:"outside"`
		Buckets  []struct {
			ID   string `json:"id"`
			Real money  `json:"real"`
		} `json:"buckets"`
	} `json:"months"`
}

// S446: six months end at the month asked; each holds the income received, the spending of
// each bucket and outside the split, and the savings bucket holds what went into the savings
// accounts (A233).
func TestS446BucketHistory(t *testing.T) {
	t.Parallel()
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
	f.pay("2026-11-03", 20000, food, "")
	f.pay("2026-10-25", 340000, f.savings, "")
	f.saveBuckets(
		bucket("Needs", 5000, false, food),
		bucket("Fun", 3000, false, fun),
		bucket("Freedom", 2000, true),
	)

	var got bucketHistoryView
	f.h.MustDo(http.MethodGet, bucketsPath+"/history?month=2026-11", nil, http.StatusOK, &got)

	if len(got.Buckets) != 3 || len(got.Months) != 6 || got.Months[0].Month != "2026-06" ||
		got.Months[5].Month != "2026-11" {
		t.Fatalf("history = %+v", got)
	}

	october := got.Months[4]

	want := []int64{120000, 30000, 500000 - 160000}
	for i, w := range want {
		if october.Buckets[i].ID != got.Buckets[i].ID || october.Buckets[i].Real.Amount != w {
			t.Errorf("october bucket %d = %+v, want %d", i, october.Buckets[i], w)
		}
	}

	if october.Received.Amount != 500000 || october.Outside.Amount != 10000 {
		t.Errorf("october received %d outside %d, want 500000 10000",
			october.Received.Amount, october.Outside.Amount)
	}

	november := got.Months[5]
	if november.Buckets[0].Real.Amount != 20000 || november.Buckets[2].Real.Amount != 0 {
		t.Errorf("november = %+v, want needs 20000 and freedom 0", november.Buckets)
	}

	var empty bucketHistoryView
	g := newFixture(t, "2026-11-12")
	g.h.MustDo(http.MethodGet, bucketsPath+"/history?month=2026-11", nil, http.StatusOK, &empty)

	if len(empty.Buckets) != 0 || len(empty.Months) != 6 {
		t.Errorf("history without a method = %+v", empty)
	}
}

// S447: a bucket that takes the goals draws what went into the goals' accounts from the book's
// other accounts, yields excluded; the savings bucket keeps what the month left beyond it, and a
// floor bucket keeps its target when it reaches it (A234).
func TestS447GoalsBucket(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	books := f.h.Account("Books", "expense", "", nil)
	reserve := f.h.Account("Reserve", "asset", "savings", nil)
	f.goal("Emergency", 1000000, reserve)
	f.h.Record(
		"2026-10-05",
		apitest.Posting(f.checking, 500000),
		apitest.Posting(f.salary, -500000),
	)
	f.pay("2026-10-06", 100000, f.rent, "")
	f.pay("2026-10-07", 30000, books, "")
	f.h.Record(
		"2026-10-10",
		apitest.Posting(reserve, 80000),
		apitest.Posting(f.checking, -80000),
	)
	f.h.Record(
		"2026-10-31",
		apitest.Posting(reserve, 900),
		apitest.Posting(f.salary, -900),
	)
	f.pay("2026-10-12", 100000, f.savings, "")

	goals := bucket("Goals", 2000, false)
	goals["takes_goals"] = true
	goals["at_least"] = true
	learn := bucket("Learn", 1000, false, books)
	learn["at_least"] = true
	f.saveBuckets(bucket("Needs", 5000, false, f.rent), goals, learn, bucket("Freedom", 2000, true))

	var method struct {
		Buckets []struct {
			TakesGoals bool `json:"takes_goals"`
			AtLeast    bool `json:"at_least"`
		} `json:"buckets"`
	}
	f.h.MustDo(http.MethodGet, bucketsPath, nil, http.StatusOK, &method)

	if len(method.Buckets) != 4 || !method.Buckets[1].TakesGoals || !method.Buckets[1].AtLeast ||
		!method.Buckets[2].AtLeast || method.Buckets[3].TakesGoals || method.Buckets[3].AtLeast {
		t.Fatalf("method = %+v", method)
	}

	var got bucketHistoryView
	f.h.MustDo(http.MethodGet, bucketsPath+"/history?month=2026-11", nil, http.StatusOK, &got)

	// Received 5000.00 and the 9.00 yield; 1300.00 spent; 800.00 into the goal and 1000.00 into
	// savings, outside the goal.
	october := got.Months[4]

	want := []int64{100000, 80000, 30000, 100000}
	for i, w := range want {
		if october.Buckets[i].Real.Amount != w {
			t.Errorf("october bucket %d = %d, want %d", i, october.Buckets[i].Real.Amount, w)
		}
	}
}

// S448: the bucket that takes savings holds what went into the book's savings, reserve and
// brokerage accounts, not what the month left: a month that spent its whole income still counts
// the transfer, a withdrawal counts against its month and a move between two such accounts
// counts nothing (A233).
func TestS448SavingsBucketCountsTransfers(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	reserve := f.h.Account("Reserve", "asset", "savings", nil)
	spare := f.h.Account("Spare", "asset", "reserve", nil)
	f.h.Record(
		"2026-08-03",
		apitest.Posting(f.checking, 500000),
		apitest.Posting(f.salary, -500000),
	)
	f.h.Record(
		"2026-08-10",
		apitest.Posting(reserve, 30000),
		apitest.Posting(f.checking, -30000),
	)
	f.h.Record(
		"2026-09-10",
		apitest.Posting(f.checking, 20000),
		apitest.Posting(reserve, -20000),
	)
	f.h.Record(
		"2026-09-11",
		apitest.Posting(spare, 10000),
		apitest.Posting(reserve, -10000),
	)
	f.h.Record(
		"2026-10-05",
		apitest.Posting(f.checking, 500000),
		apitest.Posting(f.salary, -500000),
	)
	f.pay("2026-10-06", 500000, f.rent, "")
	f.h.Record(
		"2026-10-20",
		apitest.Posting(reserve, 80000),
		apitest.Posting(f.checking, -80000),
	)
	f.saveBuckets(bucket("Needs", 5000, false, f.rent), bucket("Freedom", 5000, true))

	var got bucketHistoryView
	f.h.MustDo(http.MethodGet, bucketsPath+"/history?month=2026-11", nil, http.StatusOK, &got)

	// Months run from 2026-06: August is index 2, September 3, October 4.
	want := map[int]int64{2: 30000, 3: -20000, 4: 80000}
	for i, w := range want {
		if freedom := got.Months[i].Buckets[1].Real.Amount; freedom != w {
			t.Errorf("month %d freedom = %d, want %d", i, freedom, w)
		}
	}
}

// S538: a goal that counts as savings sends what went into its accounts to the bucket that takes
// savings, in the history and in the month's plan, and nothing to the bucket that takes goals; the
// goal set back counts in the goals bucket again (A239).
func TestS538GoalCountsAsSavings(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	wallet := f.h.Account("Wallet", "asset", "checking", nil)
	f.h.Record(
		"2026-10-05",
		apitest.Posting(f.checking, 500000),
		apitest.Posting(f.salary, -500000),
	)
	f.pay("2026-10-06", 100000, f.rent, "")
	f.h.Record(
		"2026-10-10",
		apitest.Posting(wallet, 80000),
		apitest.Posting(f.checking, -80000),
	)
	f.pay("2026-10-12", 100000, f.savings, "")

	goals := bucket("Goals", 2000, false)
	goals["takes_goals"] = true
	f.saveBuckets(bucket("Needs", 6000, false, f.rent), goals, bucket("Freedom", 2000, true))

	var created struct {
		ID              string `json:"id"`
		CountsAsSavings bool   `json:"counts_as_savings"`
	}
	f.h.MustDo(http.MethodPost, "/api/v1/goals", map[string]any{
		"name":              "Emergency",
		"target":            apitest.BRL(1000000),
		"due_on":            "2027-06-30",
		"account_ids":       []string{wallet},
		"counts_as_savings": true,
	}, http.StatusCreated, &created)

	if !created.CountsAsSavings {
		t.Fatalf("created = %+v, want counts_as_savings", created)
	}

	if got := f.octoberReal(); got[1] != 0 || got[2] != 180000 {
		t.Errorf("as savings: goals %d freedom %d, want 0 and 180000", got[1], got[2])
	}

	if spent := f.bucketPlan("2026-10").Buckets[2].Spent.Amount; spent != 180000 {
		t.Errorf("plan spent of the savings bucket = %d, want 180000", spent)
	}

	f.h.MustDo(
		http.MethodPatch,
		"/api/v1/goals/"+created.ID,
		map[string]any{"counts_as_savings": false},
		http.StatusOK,
		&created,
	)

	if created.CountsAsSavings {
		t.Fatalf("patched = %+v, want counts_as_savings false", created)
	}

	if got := f.octoberReal(); got[1] != 80000 || got[2] != 100000 {
		t.Errorf("as a goal: goals %d freedom %d, want 80000 and 100000", got[1], got[2])
	}
}

// S539: an account held by a goal that counts as savings and by one that does not counts once, in
// the bucket that takes goals; a goal created without the field does not count as savings (A239).
func TestS539SharedGoalAccountCountsOnce(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	reserve := f.h.Account("Reserve", "asset", "savings", nil)
	f.h.Record(
		"2026-10-05",
		apitest.Posting(f.checking, 500000),
		apitest.Posting(f.salary, -500000),
	)
	f.h.Record(
		"2026-10-10",
		apitest.Posting(reserve, 80000),
		apitest.Posting(f.checking, -80000),
	)

	goals := bucket("Goals", 2000, false)
	goals["takes_goals"] = true
	f.saveBuckets(bucket("Needs", 6000, false, f.rent), goals, bucket("Freedom", 2000, true))
	f.goal("Trip", 500000, reserve)
	f.h.MustDo(http.MethodPost, "/api/v1/goals", map[string]any{
		"name":              "Emergency",
		"target":            apitest.BRL(1000000),
		"due_on":            "2027-06-30",
		"account_ids":       []string{reserve},
		"counts_as_savings": true,
	}, http.StatusCreated, nil)

	if got := f.octoberReal(); got[1] != 80000 || got[2] != 0 {
		t.Errorf("goals %d freedom %d, want 80000 and 0", got[1], got[2])
	}
}

// octoberReal returns the real amount of each bucket in October 2026, in method order.
func (f fixture) octoberReal() []int64 {
	f.h.T().Helper()

	var got bucketHistoryView
	f.h.MustDo(http.MethodGet, bucketsPath+"/history?month=2026-11", nil, http.StatusOK, &got)

	out := make([]int64, len(got.Months[4].Buckets))
	for i, b := range got.Months[4].Buckets {
		out[i] = b.Real.Amount
	}

	return out
}
