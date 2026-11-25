package httpapi

import (
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

func planClasses(in []ContributionClassInput) []domain.PlanClass {
	out := make([]domain.PlanClass, len(in))
	for i, c := range in {
		members := make([]domain.PlanMember, len(c.Members))
		for j, m := range c.Members {
			members[j] = planMember(m)
		}

		out[i] = domain.PlanClass{
			Name:     c.Name,
			TargetBP: c.TargetBp,
			Members:  members,
			Rules:    planRules(c.Rules),
		}
		if c.Questions != nil {
			out[i].Questions = *c.Questions
		}

		if c.QuestionFacts != nil {
			out[i].QuestionFacts = *c.QuestionFacts
		}

		if c.QuestionLimits != nil {
			out[i].QuestionLimits = *c.QuestionLimits
		}

		if c.QuestionEffects != nil {
			out[i].QuestionEffects = retypeStrings[string](*c.QuestionEffects)
		}

		if c.QuestionReviews != nil {
			out[i].QuestionReviews = retypeInts[int](*c.QuestionReviews)
		}
	}

	return out
}

func planMember(m ContributionMemberInput) domain.PlanMember {
	out := domain.PlanMember{TargetBP: m.TargetBp, Released: m.Released}
	if m.Answers != nil {
		out.Answers = *m.Answers
	}

	if m.AccountId != nil {
		out.AccountID = *m.AccountId
	}

	if m.Instrument != nil {
		out.Instrument = money.Currency(*m.Instrument)
	}

	if m.AnswerDates != nil {
		out.AnswerDates = answerDates(*m.AnswerDates)
	}

	if m.AnswerOverrides != nil {
		out.AnswerOverrides = *m.AnswerOverrides
	}

	return out
}

func answerDates(in []*openapi_types.Date) []*time.Time {
	out := make([]*time.Time, len(in))
	for i, d := range in {
		if d != nil {
			t := d.Time
			out[i] = &t
		}
	}

	return out
}

func optionalDates(in []*time.Time) *[]*openapi_types.Date {
	if in == nil {
		return nil
	}

	out := make([]*openapi_types.Date, len(in))
	for i, t := range in {
		out[i] = optionalDate(t)
	}

	return &out
}

func optionalList[T any](in []T) *[]T {
	if in == nil {
		return nil
	}

	return &in
}

// trueOrNil is nil for false, so the field is absent.
func trueOrNil(v bool) *bool {
	if !v {
		return nil
	}

	return &v
}

// retypeStrings converts each string of in to the named type T.
func retypeStrings[T, F ~string](in []F) []T {
	out := make([]T, len(in))
	for i, v := range in {
		out[i] = T(v)
	}

	return out
}

// retypeInts converts each integer of in to the named type T.
func retypeInts[T, F ~int](in []F) []T {
	out := make([]T, len(in))
	for i, v := range in {
		out[i] = T(v)
	}

	return out
}
