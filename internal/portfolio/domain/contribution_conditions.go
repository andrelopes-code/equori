package domain

import (
	"fmt"
	"slices"
	"time"
)

const (
	EffectWarn  = "warn"
	EffectHold  = "hold"
	EffectWeigh = "weigh"

	// NoLimit is the reason of a limit criterion without a limit (CO2).
	NoLimit = "no_limit"
)

var (
	effects = []string{EffectWarn, EffectHold, EffectWeigh}
	reviews = []int{0, 1, 3, 6, 12}
)

// Weighs reports whether the class has a counting criterion of effect weigh (CO5).
func (c PlanClass) Weighs() bool {
	for q := range c.Questions {
		if c.weighs(q) {
			return true
		}
	}

	return false
}

// counts reports whether question q is a counting criterion: a limit key without a limit counts
// for nothing (CO2).
func (c PlanClass) counts(q int) bool {
	if q >= len(c.QuestionFacts) || !HasLimit(c.QuestionFacts[q]) {
		return true
	}

	return q < len(c.QuestionLimits) && c.QuestionLimits[q] != ""
}

func (c PlanClass) weighs(q int) bool {
	effect := EffectWeigh
	if q < len(c.QuestionEffects) {
		effect = c.QuestionEffects[q]
	}

	return effect == EffectWeigh && c.counts(q)
}

// cleanEffects checks CO1 and returns one effect per question, weigh where the input is empty.
func cleanEffects(raw []string, questions int) ([]string, error) {
	if len(raw) == 0 {
		out := make([]string, questions)
		for i := range out {
			out[i] = EffectWeigh
		}

		return out, nil
	}

	if len(raw) != questions {
		return nil, fmt.Errorf(
			"%w: %d effects for %d questions",
			ErrQuestionInvalid,
			len(raw),
			questions,
		)
	}

	for i, e := range raw {
		if !slices.Contains(effects, e) {
			return nil, fmt.Errorf("%w: effect %d is unknown", ErrQuestionInvalid, i+1)
		}
	}

	return slices.Clone(raw), nil
}

// cleanReviews checks CO7 and returns one reminder per question, 0 where the input is empty.
func cleanReviews(raw []int, questions int) ([]int, error) {
	if len(raw) == 0 {
		return make([]int, questions), nil
	}

	if len(raw) != questions {
		return nil, fmt.Errorf(
			"%w: %d reminders for %d questions",
			ErrQuestionInvalid,
			len(raw),
			questions,
		)
	}

	for i, r := range raw {
		if !slices.Contains(reviews, r) {
			return nil, fmt.Errorf("%w: reminder %d is not allowed", ErrQuestionInvalid, i+1)
		}
	}

	return slices.Clone(raw), nil
}

// cleanMembers checks the answers, dates and overrides of each member against facts and returns
// them with one entry per question. An override on a question without a fact is false (CO3).
func cleanMembers(members []PlanMember, facts []string) ([]PlanMember, error) {
	out := make([]PlanMember, len(members))

	for i, m := range members {
		if len(m.Answers) != len(facts) {
			return nil, fmt.Errorf(
				"%w: %d answers for %d questions",
				ErrAnswersInvalid,
				len(m.Answers),
				len(facts),
			)
		}

		if len(m.AnswerDates) != 0 && len(m.AnswerDates) != len(facts) ||
			len(m.AnswerOverrides) != 0 && len(m.AnswerOverrides) != len(facts) {
			return nil, fmt.Errorf("%w: dates or overrides of another length", ErrAnswersInvalid)
		}

		dates := make([]*time.Time, len(facts))
		copy(dates, m.AnswerDates)

		overrides := make([]bool, len(facts))
		copy(overrides, m.AnswerOverrides)

		for q, fact := range facts {
			overrides[q] = overrides[q] && fact != ""
		}

		m.Answers = slices.Clone(m.Answers)
		m.AnswerDates = dates
		m.AnswerOverrides = overrides
		out[i] = m
	}

	return out, nil
}
