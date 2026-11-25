package domain

import (
	"reflect"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestKeepFrom(t *testing.T) {
	t.Parallel()

	today := day("2026-11-25")
	todayMonth := dayOn("2026-11-01")

	for name, tc := range map[string]struct {
		stored  Plan
		input   PlanClass
		effect  string
		review  int
		date    *time.Time
		release *time.Time
	}{
		"CO16 the match ignores case and keeps every field": {
			stored: keepStored(), input: keepInput("cripto", "medo?", no()),
			effect: EffectHold, review: 1, date: dayOn("2026-10-12"), release: todayMonth,
		},
		"CO16 another answer takes today's date": {
			stored: keepStored(), input: keepInput("cripto", "medo?", yes()),
			effect: EffectHold, review: 1, date: dayOn("2026-11-25"), release: todayMonth,
		},
		"CO16 a null answer has no date": {
			stored: keepStored(), input: keepInput("cripto", "medo?", nil),
			effect: EffectHold, review: 1, date: nil, release: todayMonth,
		},
		"CO16 a renamed group loses the kept fields": {
			stored: keepStored(), input: keepInput("Moedas", "Medo?", no()),
			effect: EffectWeigh, review: 0, date: dayOn("2026-11-25"), release: nil,
		},
		"CO16 a question absent from the stored plan takes the defaults": {
			stored: keepStored(), input: keepInput("Cripto", "Outra?", no()),
			effect: EffectWeigh, review: 0, date: dayOn("2026-11-25"), release: todayMonth,
		},
		"CO16 a stored plan without classes keeps nothing": {
			stored: Plan{}, input: keepInput("Cripto", "Medo?", no()),
			effect: EffectWeigh, review: 0, date: dayOn("2026-11-25"), release: nil,
		},
		"CO8 released true sets the month of today": {
			stored: Plan{}, input: releasing(keepInput("Cripto", "Medo?", no()), true),
			effect: EffectWeigh, review: 0, date: dayOn("2026-11-25"), release: todayMonth,
		},
		"CO8 released false clears the release": {
			stored: keepStored(), input: releasing(keepInput("Cripto", "Medo?", no()), false),
			effect: EffectHold, review: 1, date: dayOn("2026-10-12"), release: nil,
		},
		"CO16 a date after today is today": {
			stored: keepStored(), input: withDates(keepInput("Cripto", "Medo?", no()), "2026-11-26"),
			effect: EffectHold, review: 1, date: dayOn("2026-11-25"), release: todayMonth,
		},
		"CO3 an override without a date on a fact question is today": {
			stored: Plan{}, input: factOverride(),
			effect: EffectWeigh, review: 0, date: dayOn("2026-11-25"), release: nil,
		},
		"CO16 a stored na keeps its date": {
			stored: keepStoredNA(), input: keepInput("Cripto", "Medo?", nil),
			effect: EffectHold, review: 1, date: dayOn("2026-11-01"), release: todayMonth,
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got := Plan{Classes: []PlanClass{tc.input}}.KeepFrom(tc.stored, today).Classes[0]
			m := got.Members[0]

			if got.QuestionEffects[0] != tc.effect || got.QuestionReviews[0] != tc.review ||
				!sameDay(m.AnswerDates[0], tc.date) || !sameDay(m.ReleaseMonth, tc.release) {
				t.Errorf(
					"kept effect %v review %v date %v release %v, want %v %v %v %v",
					got.QuestionEffects,
					got.QuestionReviews,
					dayText(m.AnswerDates[0]),
					dayText(
						m.ReleaseMonth,
					),
					tc.effect,
					tc.review,
					dayText(tc.date),
					dayText(tc.release),
				)
			}
		})
	}
}

func TestKeepFromKeepsTheOverrides(t *testing.T) {
	t.Parallel()

	stored := keepStored()
	stored.Classes[0].Questions = []string{"Medo?", "Preço?"}
	stored.Classes[0].QuestionFacts = []string{"", "piotroski_p1"}
	stored.Classes[0].QuestionEffects = []string{EffectHold, EffectHold}
	stored.Classes[0].QuestionReviews = []int{1, 0}
	stored.Classes[0].Members[0].Answers = []*bool{no(), yes()}
	stored.Classes[0].Members[0].AnswerDates = []*time.Time{
		dayOn("2026-10-12"),
		dayOn("2026-09-01"),
	}
	stored.Classes[0].Members[0].AnswerOverrides = []bool{false, true}

	input := keepInput("Cripto", "Medo?", no())
	input.Questions = []string{"medo?", "preço?", "Nova?"}
	input.QuestionFacts = []string{"", "piotroski_p1", ""}
	input.Members[0].Answers = []*bool{no(), yes(), yes()}

	got := Plan{Classes: []PlanClass{input}}.KeepFrom(stored, day("2026-11-25")).Classes[0]
	m := got.Members[0]

	if want := []bool{false, true, false}; !slices.Equal(m.AnswerOverrides, want) {
		t.Errorf("overrides = %v, want %v", m.AnswerOverrides, want)
	}

	wantEffects := []string{EffectHold, EffectHold, EffectWeigh}
	if !slices.Equal(got.QuestionEffects, wantEffects) {
		t.Errorf("effects = %v, want %v", got.QuestionEffects, wantEffects)
	}

	want := []*time.Time{dayOn("2026-10-12"), dayOn("2026-09-01"), dayOn("2026-11-25")}
	if !slices.EqualFunc(m.AnswerDates, want, sameDay) {
		t.Errorf("dates = %v, want %v", m.AnswerDates, want)
	}
}

func TestKeepFromGroupsKeepTheirOwn(t *testing.T) {
	t.Parallel()

	stored := Plan{Classes: []PlanClass{
		storedClass("A", "QSTA3", EffectHold, "2026-10-01"),
		storedClass("B", "QSTB3", EffectWarn, "2026-09-01"),
	}}

	input := Plan{Classes: []PlanClass{
		keepInputFor("a", "QSTA3"),
		keepInputFor("b", "QSTB3"),
	}}

	got := input.KeepFrom(stored, day("2026-11-25"))

	for i, want := range []struct {
		effect string
		date   *time.Time
	}{{EffectHold, dayOn("2026-10-01")}, {EffectWarn, dayOn("2026-09-01")}} {
		c := got.Classes[i]
		if c.QuestionEffects[0] != want.effect || !sameDay(c.Members[0].AnswerDates[0], want.date) {
			t.Errorf("class %d kept %v %v, want %v %v", i, c.QuestionEffects,
				dayText(c.Members[0].AnswerDates[0]), want.effect, dayText(want.date))
		}
	}
}

func TestKeepFromLeavesWrongLengths(t *testing.T) {
	t.Parallel()

	input := keepInput("Cripto", "Medo?", no())
	input.QuestionEffects = []string{EffectHold, EffectWarn}
	input.Members[0].AnswerDates = []*time.Time{nil, nil, nil}
	input.Members[0].AnswerOverrides = []bool{true, true}

	plan := Plan{
		Classes: []PlanClass{input, {Name: "Empty", Members: []PlanMember{{Answers: nil}}}},
	}
	got := plan.KeepFrom(keepStored(), day("2026-11-25"))

	c := got.Classes[0]
	if len(c.QuestionEffects) != 2 || len(c.Members[0].AnswerDates) != 3 ||
		len(c.Members[0].AnswerOverrides) != 2 {
		t.Errorf("lists of another length changed: %+v", c)
	}

	if got.Classes[1].QuestionEffects != nil || got.Classes[1].Members[0].AnswerDates != nil {
		t.Errorf("a class without questions got lists: %+v", got.Classes[1])
	}
}

func TestKeepFromKeepsTheReceiver(t *testing.T) {
	t.Parallel()

	input, stored := keptPair()
	wantInput, wantStored := keptPair()

	_ = input.KeepFrom(stored, day("2026-11-25"))

	if !reflect.DeepEqual(input, wantInput) || !reflect.DeepEqual(stored, wantStored) {
		t.Errorf("KeepFrom changed its receiver or its argument")
	}
}

var keepAccount = uuid.MustParse("00000000-0000-0000-0000-0000000000a1")

func keepStored() Plan {
	return Plan{Classes: []PlanClass{{
		Name:            "Cripto",
		TargetBP:        fullTargetBP,
		Questions:       []string{"Medo?"},
		QuestionFacts:   []string{""},
		QuestionEffects: []string{EffectHold},
		QuestionReviews: []int{1},
		Members: []PlanMember{{
			AccountID:       keepAccount,
			Answers:         []*bool{no()},
			AnswerDates:     []*time.Time{dayOn("2026-10-12")},
			AnswerOverrides: []bool{false},
			ReleaseMonth:    dayOn("2026-11-01"),
		}},
	}}}
}

func keptPair() (Plan, Plan) {
	return Plan{Classes: []PlanClass{keepInput("cripto", "medo?", yes())}}, keepStored()
}

// keepStoredNA is keepStored with the answer "não se aplica" dated 2026-11-01.
func keepStoredNA() Plan {
	p := keepStored()
	p.Classes[0].Members[0].Answers = []*bool{nil}
	p.Classes[0].Members[0].AnswerDates = []*time.Time{dayOn("2026-11-01")}

	return p
}

// keepInput is a class as an editor sends it: the new fields absent.
func keepInput(name, question string, answer *bool) PlanClass {
	return PlanClass{
		Name:          name,
		TargetBP:      fullTargetBP,
		Questions:     []string{question},
		QuestionFacts: []string{""},
		Members:       []PlanMember{{AccountID: keepAccount, Answers: []*bool{answer}}},
	}
}

func releasing(c PlanClass, release bool) PlanClass {
	c.Members[0].Released = &release

	return c
}

func withDates(c PlanClass, date string) PlanClass {
	c.Members[0].AnswerDates = []*time.Time{dayOn(date)}

	return c
}

func factOverride() PlanClass {
	c := keepInput("Cripto", "Medo?", nil)
	c.QuestionFacts = []string{"piotroski_p1"}
	c.Members[0].AnswerDates = []*time.Time{nil}
	c.Members[0].AnswerOverrides = []bool{true}

	return c
}

func storedClass(name, instrument, effect, date string) PlanClass {
	return PlanClass{
		Name:            name,
		TargetBP:        5000,
		Questions:       []string{"Medo?"},
		QuestionFacts:   []string{""},
		QuestionEffects: []string{effect},
		QuestionReviews: []int{0},
		Members: []PlanMember{{
			Instrument:      money.Currency(instrument),
			Answers:         []*bool{no()},
			AnswerDates:     []*time.Time{dayOn(date)},
			AnswerOverrides: []bool{false},
		}},
	}
}

func keepInputFor(name, instrument string) PlanClass {
	return PlanClass{
		Name:          name,
		TargetBP:      5000,
		Questions:     []string{"medo?"},
		QuestionFacts: []string{""},
		Members: []PlanMember{
			{Instrument: money.Currency(instrument), Answers: []*bool{no()}},
		},
	}
}

func sameDay(a, b *time.Time) bool {
	if a == nil || b == nil {
		return a == b
	}

	return a.Equal(*b)
}

func dayText(t *time.Time) string {
	if t == nil {
		return "nil"
	}

	return t.Format(time.DateOnly)
}
