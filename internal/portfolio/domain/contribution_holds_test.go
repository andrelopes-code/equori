package domain

import (
	"slices"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestHolds(t *testing.T) {
	t.Parallel()

	today := day("2026-11-25")

	for name, tc := range map[string]struct {
		plan Plan
		want Holds
	}{
		"CO9 X 6000 held and Y 4000 not: the group is not held": {
			plan: Plan{Classes: []PlanClass{
				holdClass("A", 10000, holder("X", target(6000), no()), holder("Y", target(4000), yes())),
			}},
			want: Holds{Classes: []bool{false}, Members: [][]bool{{true, false}}},
		},
		"CO9 both held: the group is held": {
			plan: Plan{Classes: []PlanClass{
				holdClass("A", 10000, holder("X", target(6000), no()), holder("Y", target(4000), no())),
			}},
			want: Holds{Classes: []bool{true}, Members: [][]bool{{true, true}}, Ignored: true},
		},
		"CO9 X 10000 held and Y 0: the group is held": {
			plan: Plan{Classes: []PlanClass{
				holdClass("A", 10000, holder("X", target(10000), no()), holder("Y", target(0), yes())),
			}},
			want: Holds{Classes: []bool{true}, Members: [][]bool{{true, false}}, Ignored: true},
		},
		"CO9 an undivided pair with one held: the group is not held": {
			plan: Plan{Classes: []PlanClass{
				holdClass("A", 10000, holder("X", nil, no()), holder("Y", nil, yes())),
			}},
			want: Holds{Classes: []bool{false}, Members: [][]bool{{true, false}}},
		},
		"CO9 an undivided pair with both held: the group is held": {
			plan: Plan{Classes: []PlanClass{
				holdClass("A", 10000, holder("X", nil, no()), holder("Y", nil, no())),
			}},
			want: Holds{Classes: []bool{true}, Members: [][]bool{{true, true}}, Ignored: true},
		},
		"CO10 one member without a target is held with the group": {
			plan: Plan{Classes: []PlanClass{holdClass("A", 10000, holder("X", nil, no()))}},
			want: Holds{Classes: []bool{true}, Members: [][]bool{{true}}, Ignored: true},
		},
		"CO13 every group held is ignored": {
			plan: Plan{Classes: []PlanClass{
				holdClass("A", 5000, holder("X", nil, no())),
				holdClass("B", 5000, holder("Y", nil, no())),
			}},
			want: Holds{
				Classes: []bool{true, true},
				Members: [][]bool{{true}, {true}},
				Ignored: true,
			},
		},
		"CO13 one group held is not ignored": {
			plan: Plan{Classes: []PlanClass{
				holdClass("A", 5000, holder("X", nil, no())),
				holdClass("B", 5000, holder("Y", nil, yes())),
			}},
			want: Holds{Classes: []bool{true, false}, Members: [][]bool{{true}, {false}}},
		},
		"CO13 a held group of target 0 does not count": {
			plan: Plan{Classes: []PlanClass{
				holdClass("A", 10000, holder("X", nil, yes())),
				holdClass("B", 0, holder("Y", nil, no())),
			}},
			want: Holds{Classes: []bool{false, true}, Members: [][]bool{{false}, {true}}},
		},
		"CO6 no answer, na and a group without members hold nothing": {
			plan: Plan{Classes: []PlanClass{
				holdClass("A", 5000, holder("X", nil, nil), naHolder("Y", nil)),
				holdClass("B", 5000),
			}},
			want: Holds{Classes: []bool{false, false}, Members: [][]bool{{false, false}, {}}},
		},
		"CO8 a member released in the month is not held": {
			plan: Plan{Classes: []PlanClass{
				holdClass("A", 10000, released(holder("X", nil, no()), "2026-11-01")),
			}},
			want: Holds{Classes: []bool{false}, Members: [][]bool{{false}}},
		},
		"CO8 a member released in an earlier month is held again": {
			plan: Plan{Classes: []PlanClass{
				holdClass("A", 10000, released(holder("X", nil, no()), "2026-10-01")),
			}},
			want: Holds{Classes: []bool{true}, Members: [][]bool{{true}}, Ignored: true},
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got := tc.plan.Holds(today)

			if !slices.Equal(got.Classes, tc.want.Classes) || got.Ignored != tc.want.Ignored ||
				!slices.EqualFunc(got.Members, tc.want.Members, slices.Equal[[]bool]) {
				t.Errorf("Holds = %+v, want %+v", got, tc.want)
			}
		})
	}
}

func TestMemberIdeals(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		class PlanClass
		want  []int
	}{
		"CO10 one member without a target has 10000": {
			class: holdClass("A", 10000, holder("X", nil, nil)),
			want:  []int{10000},
		},
		"CO10 an undivided pair has none": {
			class: holdClass("A", 10000, holder("X", nil, nil), holder("Y", nil, nil)),
			want:  nil,
		},
		"CO10 typed targets are returned": {
			class: holdClass("A", 10000, holder("X", target(6000), nil), holder("Y", target(4000), nil)),
			want:  []int{6000, 4000},
		},
		"a group without members has none": {
			class: holdClass("A", 10000),
			want:  nil,
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if got := tc.class.MemberIdeals(); !slices.Equal(got, tc.want) {
				t.Errorf("MemberIdeals = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestReleasedOn(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		release *time.Time
		today   string
		want    bool
	}{
		"CO8 released in the month of today":     {dayOn("2026-11-01"), "2026-11-25", true},
		"CO8 released in the first day itself":   {dayOn("2026-11-01"), "2026-11-01", true},
		"CO8 the release ends at the month":      {dayOn("2026-11-01"), "2026-12-01", false},
		"CO8 the same month of another year":     {dayOn("2025-11-01"), "2026-11-25", false},
		"CO8 no release":                         {nil, "2026-11-25", false},
		"CO8 a release in the last day of month": {dayOn("2026-11-01"), "2026-11-30", true},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			m := PlanMember{ReleaseMonth: tc.release}

			if got := m.ReleasedOn(day(tc.today)); got != tc.want {
				t.Errorf("ReleasedOn(%s) = %v, want %v", tc.today, got, tc.want)
			}
		})
	}
}

func TestDue(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		review int
		fact   string
		answer *bool
		date   *time.Time
		today  string
		want   []int
	}{
		"CO7 1 month, answered the last day of the month before": {1, "", no(), dayOn("2026-10-31"), "2026-11-01", []int{0}},
		"CO7 1 month, answered in the same month":                {1, "", no(), dayOn("2026-10-01"), "2026-10-31", nil},
		"CO7 3 months, due on 2026-12-01":                        {3, "", yes(), dayOn("2026-09-30"), "2026-12-01", []int{0}},
		"CO7 3 months, not due on 2026-11-30":                    {3, "", yes(), dayOn("2026-09-30"), "2026-11-30", nil},
		"CO7 12 months without a date, answer no":                {12, "", no(), nil, "2026-11-25", []int{0}},
		"CO7 12 months, answered in the year before":             {12, "", yes(), dayOn("2025-12-31"), "2026-11-01", nil},
		"CO7 no answer is never due":                             {1, "", nil, nil, "2026-11-25", nil},
		"CO7 no reminder without a date is not due":              {0, "", no(), nil, "2026-11-25", nil},
		"CO7 na dated the last day of the month before":          {1, "", nil, dayOn("2026-10-31"), "2026-11-01", []int{0}},
		"CO7 a question with a fact is never due":                {1, "piotroski_p1", no(), dayOn("2025-01-01"), "2026-11-25", nil},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			c := dueClass(tc.review, tc.fact, tc.answer, tc.date)

			if got := c.Due(0, day(tc.today)); !slices.Equal(got, tc.want) {
				t.Errorf("Due = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestAnsweredNo(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		class  PlanClass
		effect string
		want   []int
	}{
		"CO4 fact yes, override no": {
			class:  withEffects(piotroskiClass(piotroskiMember(FactYes, true, no()), piotroskiMember(FactNone, false, nil)), EffectHold),
			effect: EffectHold,
			want:   []int{0},
		},
		"CO4 fact yes, fallback no": {
			class:  withEffects(piotroskiClass(piotroskiMember(FactYes, false, no()), piotroskiMember(FactNone, false, nil)), EffectHold),
			effect: EffectHold,
			want:   nil,
		},
		"CO4 fact none, fallback no": {
			class:  withEffects(piotroskiClass(piotroskiMember(FactNone, false, no()), piotroskiMember(FactNone, false, nil)), EffectHold),
			effect: EffectHold,
			want:   []int{0},
		},
		"CO4 fact no, override na": {
			class:  withEffects(piotroskiClass(piotroskiMember(FactNo, true, nil), piotroskiMember(FactNone, false, nil)), EffectHold),
			effect: EffectHold,
			want:   nil,
		},
		"CO4 fact no without override": {
			class:  withEffects(piotroskiClass(piotroskiMember(FactNo, false, nil), piotroskiMember(FactNone, false, nil)), EffectHold),
			effect: EffectHold,
			want:   []int{0},
		},
		"CO1 another effect is not listed": {
			class:  withEffects(piotroskiClass(piotroskiMember(FactNo, false, nil), piotroskiMember(FactNone, false, nil)), EffectWarn),
			effect: EffectHold,
			want:   nil,
		},
		"CO1 an absent effect is weigh": {
			class:  piotroskiClass(piotroskiMember(FactNo, false, nil), piotroskiMember(FactNone, false, nil)),
			effect: EffectWeigh,
			want:   []int{0},
		},
		"CO2 a criterion without a limit counts for nothing": {
			class:  withEffects(limitlessNo(), EffectHold, EffectHold),
			effect: EffectHold,
			want:   []int{1},
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if got := tc.class.AnsweredNo(0, tc.effect); !slices.Equal(got, tc.want) {
				t.Errorf("AnsweredNo = %v, want %v", got, tc.want)
			}
		})
	}
}

// CN7 and CN8: a held slot takes the ideal 0 and receives nothing.
func TestHeldSplit(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		slots  []Slot
		amount int64
		want   []int64
	}{
		"CO9 the third group held": {
			slots:  []Slot{{TargetBP: 5000}, {TargetBP: 3000}, {TargetBP: 0}},
			amount: 100000,
			want:   []int64{62500, 37500, 0},
		},
		"CN14 foreign stocks held": {
			slots: []Slot{
				{TargetBP: 4000, Value: 1000000},
				{TargetBP: 2000, Value: 300000},
				{TargetBP: 0, Value: 100000},
				{TargetBP: 2000, Value: 400000},
			},
			amount: 150000,
			want:   []int64{0, 125000, 0, 25000},
		},
		"CO9 the first member held": {
			slots:  []Slot{{TargetBP: 0}, {TargetBP: 4000}},
			amount: 100000,
			want:   []int64{0, 100000},
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if got := Split(tc.slots, tc.amount); !slices.Equal(got, tc.want) {
				t.Errorf("Split = %v, want %v", got, tc.want)
			}
		})
	}
}

// CO12: a held entry has weight 0, so no step of CN18 reaches it.
func TestExecuteSkipsHeld(t *testing.T) {
	t.Parallel()

	entries := []Entry{
		{Weight: 0, Planned: 0, Unit: 1000, Scale: 0},
		{Weight: 1, Planned: 100000, Unit: 15000, Scale: 0},
	}

	orders, leftover := Execute(entries, 100000)

	want := []Order{{Quantity: 0, Cost: 0}, {Quantity: 6, Cost: 90000}}
	if !slices.Equal(orders, want) {
		t.Errorf("orders = %v, want %v", orders, want)
	}

	if leftover != 10000 {
		t.Errorf("leftover = %d, want 10000", leftover)
	}
}

func dayOn(s string) *time.Time {
	d := day(s)

	return &d
}

// holdClass is a class with the criterion "Medo?" of effect hold and the given members.
func holdClass(name string, targetBP int, members ...PlanMember) PlanClass {
	return PlanClass{
		Name:            name,
		TargetBP:        targetBP,
		Questions:       []string{"Medo?"},
		QuestionFacts:   []string{""},
		QuestionEffects: []string{EffectHold},
		Members:         members,
	}
}

func holder(instrument string, targetBP *int, answer *bool) PlanMember {
	return PlanMember{
		Instrument:      money.Currency(instrument),
		TargetBP:        targetBP,
		Answers:         []*bool{answer},
		AnswerDates:     []*time.Time{nil},
		AnswerOverrides: []bool{false},
	}
}

// naHolder answers "não se aplica" to its own question: a null answer with a date.
func naHolder(instrument string, targetBP *int) PlanMember {
	m := holder(instrument, targetBP, nil)
	m.AnswerDates = []*time.Time{dayOn("2026-11-01")}

	return m
}

func released(m PlanMember, month string) PlanMember {
	m.ReleaseMonth = dayOn(month)

	return m
}

func dueClass(review int, fact string, answer *bool, date *time.Time) PlanClass {
	m := holder("QSTA3", nil, answer)
	m.AnswerDates = []*time.Time{date}
	m.AnswerOverrides = []bool{fact != ""}

	return PlanClass{
		Name:            "Due",
		TargetBP:        fullTargetBP,
		Questions:       []string{"Q1"},
		QuestionFacts:   []string{fact},
		QuestionReviews: []int{review},
		Members:         []PlanMember{m},
	}
}

// limitlessNo has a criterion with a limit key and no limit and an own criterion, both answered no.
func limitlessNo() PlanClass {
	c := limitlessClass()
	c.Members[0].Answers = []*bool{no(), no()}
	c.Members[0].FactAnswers = []FactAnswer{FactNo, FactNone}
	c.Members[0].AnswerOverrides = []bool{false, false}

	return c
}
