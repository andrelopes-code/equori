package domain

import "time"

// Holds tells which classes and members the criteria of effect hold keep from the purchase (CO6,
// CO9, CO13).
type Holds struct {
	Classes []bool
	Members [][]bool
	// Ignored is true when every class of positive ideal is held: the split then runs without the
	// holds (CO13).
	Ignored bool
}

// Holds evaluates the holds of every class and member on the day today; the receiver is unchanged.
func (p Plan) Holds(today time.Time) Holds {
	out := Holds{Classes: make([]bool, len(p.Classes)), Members: make([][]bool, len(p.Classes))}
	funded, heldFunded := 0, 0

	for i, c := range p.Classes {
		out.Members[i] = c.heldMembers(today)
		out.Classes[i] = c.heldBy(out.Members[i])

		if c.TargetBP > 0 {
			funded++

			if out.Classes[i] {
				heldFunded++
			}
		}
	}

	out.Ignored = funded > 0 && funded == heldFunded

	return out
}

// MemberIdeals returns the ideal of each member in the class (CO10): nil for an undivided class,
// 10000 for a single member without a target.
func (c PlanClass) MemberIdeals() []int {
	if len(c.Members) == 1 && c.Members[0].TargetBP == nil {
		return []int{fullTargetBP}
	}

	out := make([]int, len(c.Members))
	hasTarget := false

	for i, m := range c.Members {
		if m.TargetBP != nil {
			out[i] = *m.TargetBP
			hasTarget = true
		}
	}

	if !hasTarget {
		return nil
	}

	return out
}

// AnsweredNo returns the positions of the counting criteria of the effect that member j answers no
// (CO4, CO6).
func (c PlanClass) AnsweredNo(j int, effect string) []int {
	m := c.Members[j]

	var out []int

	for q, stored := range m.Answers {
		if !c.counts(q) || c.effectOf(q) != effect {
			continue
		}

		if answer := effectiveAnswer(m, q, stored); answer != nil && !*answer {
			out = append(out, q)
		}
	}

	return out
}

// Due returns the positions of the own questions that member j answered and whose reminder has
// expired on the day today (CO7).
func (c PlanClass) Due(j int, today time.Time) []int {
	m := c.Members[j]

	var out []int

	for q := range c.Questions {
		if q >= len(c.QuestionReviews) || c.QuestionReviews[q] == 0 || c.hasFact(q) {
			continue
		}

		if m.dueAt(q, c.QuestionReviews[q], today) {
			out = append(out, q)
		}
	}

	return out
}

// ReleasedOn reports whether the member is released in the calendar month of today (CO8).
func (m PlanMember) ReleasedOn(today time.Time) bool {
	return m.ReleaseMonth != nil && monthsBetween(*m.ReleaseMonth, today) == 0
}

func (c PlanClass) heldMembers(today time.Time) []bool {
	out := make([]bool, len(c.Members))

	for j, m := range c.Members {
		out[j] = len(c.AnsweredNo(j, EffectHold)) > 0 && !m.ReleasedOn(today)
	}

	return out
}

// heldBy applies CO9: the class is held when every member of positive ideal is held, or every
// member when the class has no ideals.
func (c PlanClass) heldBy(members []bool) bool {
	if len(members) == 0 {
		return false
	}

	ideals := c.MemberIdeals()

	for j, held := range members {
		if (ideals == nil || ideals[j] > 0) && !held {
			return false
		}
	}

	return true
}

func (c PlanClass) effectOf(q int) string {
	if q < len(c.QuestionEffects) {
		return c.QuestionEffects[q]
	}

	return EffectWeigh
}

func (c PlanClass) hasFact(q int) bool {
	return q < len(c.QuestionFacts) && c.QuestionFacts[q] != ""
}

// dueAt reports whether the answer to question q, given by the day it was dated, is at least
// months calendar months old on the day today. A yes or no answer without a date is due.
func (m PlanMember) dueAt(q, months int, today time.Time) bool {
	var date *time.Time
	if q < len(m.AnswerDates) {
		date = m.AnswerDates[q]
	}

	answered := q < len(m.Answers) && m.Answers[q] != nil

	if date != nil {
		return monthsBetween(*date, today) >= months
	}

	return answered
}

// monthsBetween counts the calendar months from the month of from to the month of to.
func monthsBetween(from, to time.Time) int {
	return (to.Year()-from.Year())*12 + int(to.Month()) - int(from.Month())
}
