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

// S442: the savings bucket draws the month's savings and sets the savings target.
func TestS442SavingsBucket(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	paid := f.schedule("savings", f.checking, f.savings, 50000, monthly("2026-11-01", 10, ""), nil)
	f.schedule("savings", f.checking, f.savings, 30000, monthly("2026-11-01", 20, ""), nil)
	f.pay("2026-11-10", 50000, f.savings, "")

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
// ignoring case and a category of another book (income buckets B1).
func TestBucketSchema(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	f.saveBuckets(bucket("Needs", 10000, true, f.rent))
	book := f.h.OwnerID()
	f.h.Login("other@example.com")
	other := f.h.BooksIDOf("other@example.com")
	ctx := t.Context()

	insert := func(books any, name string, savings bool) error {
		_, err := f.h.Pool.Exec(
			ctx,
			`INSERT INTO planning_bucket (books_id, position, name, share_bp, takes_savings)
			VALUES ($1, 5, $2, 0, $3)`,
			books,
			name,
			savings,
		)

		return err
	}

	tests := []struct {
		name string
		err  error
	}{
		{"without a book", insert(nil, "Wants", false)},
		{"second savings bucket", insert(book, "Wants", true)},
		{"name used twice", insert(book, "NEEDS", false)},
		{"category of another book", func() error {
			_, err := f.h.Pool.Exec(ctx, `WITH b AS (
					INSERT INTO planning_bucket (books_id, position, name, share_bp)
					VALUES ($1, 0, 'Other', 10000) RETURNING id)
				INSERT INTO planning_bucket_category (books_id, category_id, bucket_id)
				SELECT $1, $2, id FROM b`, other, f.rent)

			return err
		}()},
	}
	for _, tt := range tests {
		if tt.err == nil {
			t.Errorf("%s: insert succeeded, want a rejection", tt.name)
		}
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
