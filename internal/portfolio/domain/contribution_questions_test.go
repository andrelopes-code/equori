package domain

import (
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestWithIdeals(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		class PlanClass
		want  []*int
		ideal bool
	}{
		"CQ7.1 remainder to the larger fraction": {
			class: questionClass(
				[]string{"Q1", "Q2", "Q3"},
				[]bool{true, true, false},
				[]bool{true, false, false},
				[]bool{false, false, false},
			),
			want:  targets(6667, 3333, 0),
			ideal: true,
		},
		"CQ7.2 two equal members": {
			class: questionClass([]string{"Q1"}, []bool{true}, []bool{true}),
			want:  targets(5000, 5000),
			ideal: true,
		},
		"CQ7.3 equal fractions by position": {
			class: questionClass([]string{"Q1"}, []bool{true}, []bool{true}, []bool{true}),
			want:  targets(3334, 3333, 3333),
			ideal: true,
		},
		"CQ7.4 every answer no": {
			class: questionClass([]string{"Q1", "Q2"}, []bool{false, false}, []bool{false, false}),
			want:  []*int{nil, nil},
			ideal: false,
		},
		"no questions keeps typed targets": {
			class: PlanClass{
				Name:     "Typed",
				TargetBP: fullTargetBP,
				Members: []PlanMember{
					{Instrument: "AAAA3", TargetBP: target(6000)},
					{Instrument: "BBBB3", TargetBP: target(4000)},
				},
			},
			want:  targets(6000, 4000),
			ideal: false,
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

func TestWithIdealsRejects(t *testing.T) {
	t.Parallel()

	many := make([]string, 21)
	for i := range many {
		many[i] = "Q" + string(rune('a'+i))
	}

	for name, tc := range map[string]struct {
		class PlanClass
		want  error
	}{
		"CQ7.5 question of 201 characters": {
			class: questionClass([]string{strings.Repeat("a", 201)}, []bool{true}),
			want:  ErrQuestionInvalid,
		},
		"CQ7.5 empty question": {
			class: questionClass([]string{"  "}, []bool{true}),
			want:  ErrQuestionInvalid,
		},
		"CQ7.5 duplicate ignoring case": {
			class: questionClass(
				[]string{"Paga dividendos?", "paga dividendos?"},
				[]bool{true, true},
			),
			want: ErrQuestionInvalid,
		},
		"CQ7.5 twenty-one questions": {
			class: questionClass(many, make([]bool, 21)),
			want:  ErrQuestionInvalid,
		},
		"CQ7.6 answers of another length": {
			class: questionClass([]string{"Q1", "Q2", "Q3"}, []bool{true, false}),
			want:  ErrAnswersInvalid,
		},
		"CQ7.6 typed target in a class with questions": {
			class: PlanClass{
				Name:      "Q",
				TargetBP:  fullTargetBP,
				Questions: []string{"Q1"},
				Members: []PlanMember{
					{Instrument: "AAAA3", Answers: said(true), TargetBP: target(10000)},
				},
			},
			want: ErrAnswersInvalid,
		},
		"CQ2 a blank answer to an own question": {
			class: PlanClass{
				Name:      "Q",
				TargetBP:  fullTargetBP,
				Questions: []string{"Q1"},
				Members:   []PlanMember{{Instrument: "AAAA3", Answers: []*bool{nil}}},
			},
			want: ErrAnswersInvalid,
		},
		"CQ7.6 answers in a class without questions": {
			class: PlanClass{
				Name:     "Q",
				TargetBP: fullTargetBP,
				Members:  []PlanMember{{Instrument: "AAAA3", Answers: said(true)}},
			},
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

func TestWithIdealsTrimsAndKeepsTheReceiver(t *testing.T) {
	t.Parallel()

	in := Plan{Classes: []PlanClass{
		questionClass([]string{"  Paga dividendos?  "}, []bool{true}, []bool{false}),
	}}

	got, err := in.WithIdeals()
	if err != nil {
		t.Fatal(err)
	}

	if q := got.Classes[0].Questions[0]; q != "Paga dividendos?" {
		t.Fatalf("question = %q, want trimmed", q)
	}

	if in.Classes[0].Members[0].TargetBP != nil ||
		in.Classes[0].Questions[0] != "  Paga dividendos?  " {
		t.Fatalf("receiver changed: %+v", in.Classes[0])
	}
}

func TestIdealsFromAnswers(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		yes  []int
		want []int
	}{
		{[]int{2, 1, 0}, []int{6667, 3333, 0}},
		{[]int{1, 1, 1}, []int{3334, 3333, 3333}},
		{[]int{0, 0}, nil},
	} {
		if got := IdealsFromAnswers(tc.yes); !slices.Equal(got, tc.want) {
			t.Errorf("IdealsFromAnswers(%v) = %v, want %v", tc.yes, got, tc.want)
		}
	}
}

func questionClass(questions []string, answers ...[]bool) PlanClass {
	c := PlanClass{Name: "Questions", TargetBP: fullTargetBP, Questions: questions}
	for i, a := range answers {
		c.Members = append(c.Members, PlanMember{
			Instrument: money.Currency("QST" + string(rune('A'+i)) + "3"),
			Answers:    said(a...),
		})
	}

	return c
}

// said are answers the investor gave; none of them is blank.
func said(values ...bool) []*bool {
	out := make([]*bool, len(values))
	for i := range values {
		out[i] = &values[i]
	}

	return out
}

func memberTargets(c PlanClass) []*int {
	out := make([]*int, len(c.Members))
	for i, m := range c.Members {
		out[i] = m.TargetBP
	}

	return out
}

func targets(values ...int) []*int {
	out := make([]*int, len(values))
	for i, v := range values {
		out[i] = target(v)
	}

	return out
}

func target(v int) *int { return &v }

func equalTarget(a, b *int) bool {
	if a == nil || b == nil {
		return a == b
	}

	return *a == *b
}

func show(ts []*int) []any {
	out := make([]any, len(ts))
	for i, t := range ts {
		if t != nil {
			out[i] = *t
		}
	}

	return out
}
