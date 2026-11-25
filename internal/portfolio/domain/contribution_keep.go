package domain

import (
	"slices"
	"strings"
	"time"
)

// KeepFrom completes what a writer left out of the plan with the stored plan (CO16): effects,
// reminders, dates, overrides and releases. The receiver and the stored plan are unchanged.
func (p Plan) KeepFrom(stored Plan, today time.Time) Plan {
	out := p
	out.Classes = make([]PlanClass, len(p.Classes))
	today = dayOf(today)

	for i, c := range p.Classes {
		out.Classes[i] = c.keepFrom(stored.classNamed(c.Name), today)
	}

	return out
}

// keepFrom returns the class with its absent fields kept from old, the stored class of the same
// name; old is nil without one.
func (c PlanClass) keepFrom(old *PlanClass, today time.Time) PlanClass {
	out := c
	out.Members = make([]PlanMember, len(c.Members))

	if n := len(c.Questions); n > 0 {
		out.QuestionEffects = keptList(c.QuestionEffects, n, func(q int) string {
			return old.effectAt(c.Questions[q])
		})
		out.QuestionReviews = keptList(c.QuestionReviews, n, func(q int) int {
			return old.reviewAt(c.Questions[q])
		})
	}

	for j, m := range c.Members {
		out.Members[j] = out.keepMember(m, old, today)
	}

	return out
}

// keepMember returns the member with its absent lists kept from the stored member of the same
// account or instrument in old.
func (c PlanClass) keepMember(m PlanMember, old *PlanClass, today time.Time) PlanMember {
	oldMember := old.memberLike(m)

	m.ReleaseMonth = keptRelease(m, oldMember, today)

	n := len(c.Questions)
	if n == 0 {
		return m
	}

	m.AnswerOverrides = keptList(m.AnswerOverrides, n, func(q int) bool {
		return oldMember.overrideAt(old, c.Questions[q])
	})
	m.AnswerDates = c.keptDates(m, oldMember, old, today)

	return m
}

// keptDates returns the dates of CO16: those sent, none after today, else the stored date of an
// unchanged answer, else today for an answer and none for a blank one.
func (c PlanClass) keptDates(
	m PlanMember,
	oldMember *PlanMember,
	old *PlanClass,
	today time.Time,
) []*time.Time {
	n := len(c.Questions)
	if len(m.AnswerDates) != 0 && len(m.AnswerDates) != n {
		return m.AnswerDates
	}

	out := make([]*time.Time, n)

	for q := range out {
		var sent *time.Time
		if len(m.AnswerDates) == n {
			sent = m.AnswerDates[q]
		}

		switch {
		case sent != nil:
			out[q] = clampDay(sent, today)
		case len(m.AnswerDates) == 0:
			out[q] = oldMember.dateOf(old, c.Questions[q], answerAt(m, q), today)
		}

		if out[q] == nil && c.hasFact(q) && q < len(m.AnswerOverrides) && m.AnswerOverrides[q] {
			out[q] = &today
		}
	}

	return out
}

func (p Plan) classNamed(name string) *PlanClass {
	i := slices.IndexFunc(p.Classes, func(c PlanClass) bool {
		return sameText(c.Name, name)
	})
	if i < 0 {
		return nil
	}

	return &p.Classes[i]
}

func (c *PlanClass) questionAt(text string) int {
	if c == nil {
		return -1
	}

	return slices.IndexFunc(c.Questions, func(q string) bool { return sameText(q, text) })
}

func (c *PlanClass) effectAt(question string) string {
	if q := c.questionAt(question); q >= 0 && q < len(c.QuestionEffects) {
		return c.QuestionEffects[q]
	}

	return EffectWeigh
}

func (c *PlanClass) reviewAt(question string) int {
	if q := c.questionAt(question); q >= 0 && q < len(c.QuestionReviews) {
		return c.QuestionReviews[q]
	}

	return 0
}

func (c *PlanClass) memberLike(m PlanMember) *PlanMember {
	if c == nil {
		return nil
	}

	i := slices.IndexFunc(c.Members, func(o PlanMember) bool {
		return o.AccountID == m.AccountID && o.Instrument == m.Instrument
	})
	if i < 0 {
		return nil
	}

	return &c.Members[i]
}

func (m *PlanMember) overrideAt(old *PlanClass, question string) bool {
	q := old.questionAt(question)
	if m == nil || q < 0 || q >= len(m.AnswerOverrides) {
		return false
	}

	return m.AnswerOverrides[q]
}

// dateOf returns the stored date of the answer to question when the stored answer equals answer,
// else today for an answer and nil for a blank one.
func (m *PlanMember) dateOf(
	old *PlanClass,
	question string,
	answer *bool,
	today time.Time,
) *time.Time {
	q := old.questionAt(question)
	if m != nil && q >= 0 && q < len(m.Answers) && sameAnswer(m.Answers[q], answer) {
		if q < len(m.AnswerDates) {
			return m.AnswerDates[q]
		}

		return nil
	}

	if answer == nil {
		return nil
	}

	return &today
}

// keptRelease applies CO8 and CO16: true releases the month of today, false clears, nil keeps.
func keptRelease(m PlanMember, old *PlanMember, today time.Time) *time.Time {
	switch {
	case m.Released != nil && *m.Released:
		first := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)

		return &first
	case m.Released != nil:
		return nil
	case old != nil:
		return old.ReleaseMonth
	default:
		return m.ReleaseMonth
	}
}

// keptList returns sent when it holds any value, else one value per question from keep.
func keptList[T any](sent []T, questions int, keep func(q int) T) []T {
	if len(sent) != 0 {
		return sent
	}

	out := make([]T, questions)
	for q := range out {
		out[q] = keep(q)
	}

	return out
}

// clampDay returns d, or today when d is later (CO16).
func clampDay(d *time.Time, today time.Time) *time.Time {
	if dayOf(*d).After(today) {
		return &today
	}

	return d
}

func dayOf(t time.Time) time.Time {
	y, m, d := t.Date()

	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func answerAt(m PlanMember, q int) *bool {
	if q < len(m.Answers) {
		return m.Answers[q]
	}

	return nil
}

func sameAnswer(a, b *bool) bool {
	if a == nil || b == nil {
		return a == b
	}

	return *a == *b
}

func sameText(a, b string) bool {
	return strings.EqualFold(strings.TrimSpace(a), strings.TrimSpace(b))
}
