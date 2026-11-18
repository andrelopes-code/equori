package domain

import (
	"errors"
	"slices"
	"testing"

	"github.com/google/uuid"
)

func TestBucketTargets(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		reference int64
		shares    []int
		want      []int64
	}{
		{"exact", 1000000, []int{5000, 3000, 2000}, []int64{500000, 300000, 200000}},
		{"largest remainder", 100001, []int{3333, 3333, 3334}, []int64{33330, 33330, 33341}},
		{"tie goes to the earlier", 1, []int{5000, 5000}, []int64{1, 0}},
		{"zero reference", 0, []int{5000, 5000}, []int64{0, 0}},
		{"negative reference", -100, []int{10000}, []int64{0}},
		{"no buckets", 600000, nil, []int64{}},
		{"shares below the whole", 100, []int{2500}, []int64{25}},
	}
	for _, tt := range tests {
		buckets := make([]Bucket, len(tt.shares))
		for i, s := range tt.shares {
			buckets[i].ShareBP = s
		}

		if got := BucketTargets(tt.reference, buckets); !slices.Equal(got, tt.want) {
			t.Errorf("%s: targets = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestBucketResolver(t *testing.T) {
	t.Parallel()

	food, market, snacks, gym := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	parents := map[uuid.UUID]uuid.UUID{market: food, snacks: market}
	resolve := BucketResolver(
		[]Bucket{{Categories: []uuid.UUID{food}}, {Categories: []uuid.UUID{snacks}}},
		parents,
	)

	tests := []struct {
		name     string
		category uuid.UUID
		want     int
		ok       bool
	}{
		{"own", food, 0, true},
		{"from the parent", market, 0, true},
		{"own over the ancestor", snacks, 1, true},
		{"outside", gym, 0, false},
	}
	for _, tt := range tests {
		if got, ok := resolve(tt.category); got != tt.want || ok != tt.ok {
			t.Errorf("%s: resolve = %d %t, want %d %t", tt.name, got, ok, tt.want, tt.ok)
		}
	}
}

func TestCheckBuckets(t *testing.T) {
	t.Parallel()

	food, salary := uuid.New(), uuid.New()
	expense := func(id uuid.UUID) bool { return id == food }
	b := func(name string, share int, savings bool, categories ...uuid.UUID) Bucket {
		return Bucket{Name: name, ShareBP: share, TakesSavings: savings, Categories: categories}
	}

	tests := []struct {
		name    string
		buckets []Bucket
		field   string
	}{
		{"empty removes", nil, ""},
		{"valid", []Bucket{b("Needs", 6000, false, food), b("Freedom", 4000, true)}, ""},
		{"sum", []Bucket{b("Needs", 9999, false)}, "buckets"},
		{"eleven", slices.Repeat([]Bucket{b("x", 0, false)}, 11), "buckets"},
		{"long name", []Bucket{b(string(make([]byte, 41)), 10000, false)}, "buckets[0].name"},
		{
			"negative share",
			[]Bucket{b("A", -1, false), b("B", 10001, false)},
			"buckets[0].share_bp",
		},
		{
			"second savings",
			[]Bucket{b("A", 5000, true), b("B", 5000, true)},
			"buckets[1].takes_savings",
		},
		{
			"second goals",
			[]Bucket{
				{Name: "A", ShareBP: 5000, TakesGoals: true},
				{Name: "B", ShareBP: 5000, TakesGoals: true},
			},
			"buckets[1].takes_goals",
		},
		{
			"goals and savings",
			[]Bucket{{Name: "A", ShareBP: 10000, TakesGoals: true, TakesSavings: true}},
			"buckets[0].takes_goals",
		},
		{"income", []Bucket{b("A", 10000, false, salary)}, "buckets[0].category_ids"},
		{
			"twice",
			[]Bucket{b("A", 5000, false, food), b("B", 5000, false, food)},
			"buckets[1].category_ids",
		},
	}
	for _, tt := range tests {
		_, err := CheckBuckets(tt.buckets, expense, nil)

		field := ""

		fe := &FieldError{}
		if errors.As(err, &fe) {
			field = fe.Field
		} else if err != nil {
			t.Errorf("%s: err = %v", tt.name, err)
		}

		if field != tt.field {
			t.Errorf("%s: field = %q, want %q", tt.name, field, tt.field)
		}
	}
}

func TestCheckBucketsTrimsNames(t *testing.T) {
	t.Parallel()

	got, err := CheckBuckets([]Bucket{{Name: "  Needs ", ShareBP: 10000}}, nil, nil)
	if err != nil || got[0].Name != "Needs" {
		t.Fatalf("CheckBuckets = %+v %v, want the name Needs", got, err)
	}
}

func TestKeptTarget(t *testing.T) {
	t.Parallel()

	goals := Bucket{TakesGoals: true}
	tests := []struct {
		name    string
		bucket  Bucket
		verdict Verdict
		target  int64
		want    bool
	}{
		{"expense below", Bucket{}, Verdict{Real: 900}, 1000, true},
		{"expense at", Bucket{}, Verdict{Real: 1000}, 1000, true},
		{"expense above", Bucket{}, Verdict{Real: 1001}, 1000, false},
		{"savings above", Bucket{TakesSavings: true}, Verdict{Real: 1200}, 1000, true},
		{"savings below", Bucket{TakesSavings: true}, Verdict{Real: 999}, 1000, false},
		{"at least below", Bucket{AtLeast: true}, Verdict{Real: 999}, 1000, false},
		{"at least above", Bucket{AtLeast: true}, Verdict{Real: 1500}, 1000, true},
		// A254: 2,400.00 spent, 2,200.00 from the accumulated balance (S575).
		{"covered by the balance", Bucket{}, Verdict{Real: 240000, Covered: 220000}, 25000, true},
		{"covered short", Bucket{}, Verdict{Real: 240000, Covered: 200000}, 25000, false},
		{"paid by a goal", Bucket{}, Verdict{Real: 500000, GoalPaid: 500000}, 0, true},
		// A254: a withdrawal does not miss the floor of the goals bucket (S577).
		{"goals withdrawn", goals, Verdict{Real: -450000, Deposited: 50000}, 50000, true},
		{"goals short", goals, Verdict{Real: 60000, Deposited: 40000}, 50000, false},
	}
	for _, tt := range tests {
		if got := KeptTarget(tt.bucket, tt.verdict, tt.target); got != tt.want {
			t.Errorf("%s: KeptTarget = %t, want %t", tt.name, got, tt.want)
		}
	}
}
