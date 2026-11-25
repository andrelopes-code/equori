package domain

import (
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestWithIdealsConditions(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		class PlanClass
		want  []*int
		ideal bool
	}{
		"CO5 warn keeps the typed targets": {
			class: typed(withEffects(
				questionClass([]string{"Q1"}, []bool{true}, []bool{true}),
				EffectWarn,
			), 6000, 4000),
			want: targets(6000, 4000),
		},
		"CO5 hold keeps the typed targets": {
			class: typed(withEffects(
				questionClass([]string{"Q1"}, []bool{true}, []bool{true}),
				EffectHold,
			), 6000, 4000),
			want: targets(6000, 4000),
		},
		"CO5 only the weigh criterion gives points": {
			class: withEffects(
				questionClass(
					[]string{"Q1", "Q2"},
					[]bool{true, false},
					[]bool{true, true},
				),
				EffectWeigh,
				EffectHold,
			),
			want:  targets(5000, 5000),
			ideal: true,
		},
		"CO5 an own question without an answer gives no point": {
			class: withEffects(
				answered(
					questionClass([]string{"Q1", "Q2"}),
					[]*bool{yes(), nil},
					[]*bool{yes(), yes()},
				),
				EffectWeigh,
				EffectWeigh,
			),
			want:  targets(3333, 6667),
			ideal: true,
		},
		"CO5 a fact without answer takes the equal share": {
			class: piotroskiClass(
				piotroskiMember(FactNone, false, nil),
				piotroskiMember(FactYes, false, nil),
			),
			want:  targets(5000, 5000),
			ideal: true,
		},
		"CO5 an override with no answer gives no points and no equal share": {
			class: piotroskiClass(
				piotroskiMember(FactNone, true, nil),
				piotroskiMember(FactYes, false, nil),
			),
			want:  targets(0, 10000),
			ideal: true,
		},
		"CO4 an override answered no beats the fact yes": {
			class: piotroskiClass(
				piotroskiMember(FactYes, true, no()),
				piotroskiMember(FactYes, false, nil),
			),
			want:  targets(0, 10000),
			ideal: true,
		},
		"CO2 a limit criterion without a limit counts nothing": {
			class: limitlessClass(),
			want:  targets(10000, 0),
			ideal: true,
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got, err := (Plan{Classes: []PlanClass{tc.class}}).WithIdeals()
			if err != nil {
				t.Fatal(err)
			}

			c := got.Classes[0]
			if g := memberTargets(c); !slices.EqualFunc(g, tc.want, equalTarget) {
				t.Fatalf("targets = %v, want %v", show(g), show(tc.want))
			}

			if c.QuestionIdeals() != tc.ideal {
				t.Fatalf("QuestionIdeals = %t, want %t", c.QuestionIdeals(), tc.ideal)
			}
		})
	}
}

func TestWithIdealsRejectsConditions(t *testing.T) {
	t.Parallel()

	one := func() PlanClass { return questionClass([]string{"Q1"}, []bool{true}) }

	for name, tc := range map[string]struct {
		class PlanClass
		want  error
	}{
		"CO1 unknown effect": {
			class: withEffects(one(), "block"),
			want:  ErrQuestionInvalid,
		},
		"CO1 two effects for one question": {
			class: withEffects(one(), EffectWarn, EffectHold),
			want:  ErrQuestionInvalid,
		},
		"CO7 reminder of 2 months": {
			class: func() PlanClass { c := one(); c.QuestionReviews = []int{2}; return c }(),
			want:  ErrQuestionInvalid,
		},
		"CO7 two reminders for one question": {
			class: func() PlanClass { c := one(); c.QuestionReviews = []int{1, 3}; return c }(),
			want:  ErrQuestionInvalid,
		},
		"CO3 two dates for one question": {
			class: func() PlanClass {
				c := one()
				c.Members[0].AnswerDates = make([]*time.Time, 2)

				return c
			}(),
			want: ErrAnswersInvalid,
		},
		"CO3 two overrides for one question": {
			class: func() PlanClass {
				c := one()
				c.Members[0].AnswerOverrides = []bool{true, true}

				return c
			}(),
			want: ErrAnswersInvalid,
		},
		"CO3 dates in a class without questions": {
			class: PlanClass{
				Name:     "Q",
				TargetBP: fullTargetBP,
				Members: []PlanMember{
					{Instrument: "AAAA3", AnswerDates: make([]*time.Time, 1)},
				},
			},
			want: ErrAnswersInvalid,
		},
		"CO5 a typed target beside a weigh criterion": {
			class: typed(withEffects(
				questionClass([]string{"Q1", "Q2"}, []bool{true, true}, []bool{true, true}),
				EffectWarn,
				EffectWeigh,
			), 6000, 4000),
			want: ErrAnswersInvalid,
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			_, err := (Plan{Classes: []PlanClass{tc.class}}).WithIdeals()
			if !errors.Is(err, tc.want) {
				t.Fatalf("err = %v, want %v", err, tc.want)
			}
		})
	}
}

func TestWeighs(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		class PlanClass
		want  bool
	}{
		"CO1 no effects weigh": {
			class: questionClass([]string{"Q1"}, []bool{true}),
			want:  true,
		},
		"CO1 warn and hold do not weigh": {
			class: withEffects(
				questionClass([]string{"Q1", "Q2"}, []bool{true, true}),
				EffectWarn,
				EffectHold,
			),
		},
		"CO1 one weigh among them": {
			class: withEffects(
				questionClass([]string{"Q1", "Q2"}, []bool{true, true}),
				EffectHold,
				EffectWeigh,
			),
			want: true,
		},
		"CO2 a weigh criterion without a limit does not count": {
			class: limitlessClass(),
			want:  true,
		},
		"CO2 a limit criterion alone without a limit": {
			class: func() PlanClass {
				c := limitlessClass()
				c.Questions = c.Questions[:1]
				c.QuestionFacts = c.QuestionFacts[:1]
				c.QuestionLimits = c.QuestionLimits[:1]

				return c
			}(),
		},
		"no questions": {class: PlanClass{Name: "A"}},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if got := tc.class.Weighs(); got != tc.want {
				t.Fatalf("Weighs = %t, want %t", got, tc.want)
			}
		})
	}
}

func withEffects(c PlanClass, effects ...string) PlanClass {
	c.QuestionEffects = effects

	return c
}

func typed(c PlanClass, values ...int) PlanClass {
	for i, v := range values {
		c.Members[i].TargetBP = target(v)
	}

	return c
}

func answered(c PlanClass, rows ...[]*bool) PlanClass {
	for i, row := range rows {
		c.Members = append(c.Members, PlanMember{
			Instrument: money.Currency("QST" + string(rune('A'+i)) + "3"),
			Answers:    row,
		})
	}

	return c
}

// piotroskiMember is a member of a class with one fact question.
func piotroskiMember(fact FactAnswer, override bool, answer *bool) PlanMember {
	return PlanMember{
		Answers:         []*bool{answer},
		FactAnswers:     []FactAnswer{fact},
		AnswerOverrides: []bool{override},
	}
}

func piotroskiClass(a, b PlanMember) PlanClass {
	a.Instrument, b.Instrument = "QSTA3", "QSTB3"

	return PlanClass{
		Name:          "Facts",
		TargetBP:      fullTargetBP,
		Questions:     []string{"Q1"},
		QuestionFacts: []string{"piotroski_p1"},
		Members:       []PlanMember{a, b},
	}
}

// limitlessClass has a criterion with a limit key and no limit beside an own question.
func limitlessClass() PlanClass {
	c := answered(
		PlanClass{
			Name:           "Limitless",
			TargetBP:       fullTargetBP,
			Questions:      []string{"Q1", "Q2"},
			QuestionFacts:  []string{"price_earnings_max", ""},
			QuestionLimits: []string{"", ""},
		},
		[]*bool{nil, yes()},
		[]*bool{nil, no()},
	)

	for i := range c.Members {
		c.Members[i].FactAnswers = []FactAnswer{FactNone, FactNone}
	}

	return c
}

func yes() *bool {
	v := true

	return &v
}

func no() *bool {
	v := false

	return &v
}
