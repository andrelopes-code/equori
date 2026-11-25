package domain

import (
	"cmp"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"
)

const (
	maxQuestions   = 20
	maxQuestionLen = 200
)

// WithIdeals checks the questions and answers of every class (CQ1, CQ2) and returns the plan with
// the member targets of each class with questions derived from the answers (CQ3). The receiver is
// unchanged.
func (p Plan) WithIdeals() (Plan, error) {
	out := p
	out.Classes = make([]PlanClass, len(p.Classes))

	for i, c := range p.Classes {
		derived, err := c.withIdeals()
		if err != nil {
			return Plan{}, fmt.Errorf("class %q: %w", c.Name, err)
		}

		out.Classes[i] = derived
	}

	return out, nil
}

// QuestionIdeals reports whether the class divides its target by questions with at least one
// answer true (CQ5).
func (c PlanClass) QuestionIdeals() bool {
	return c.Weighs() && slices.ContainsFunc(c.Members, func(m PlanMember) bool {
		return m.TargetBP != nil
	})
}

// IdealsFromAnswers returns the member targets of CQ3 for the given weights; nil when every weight
// is zero.
func IdealsFromAnswers(yes []int) []int {
	total := 0
	for _, s := range yes {
		total += s
	}

	if total == 0 {
		return nil
	}

	out := make([]int, len(yes))
	rest := fullTargetBP

	for i, s := range yes {
		out[i] = fullTargetBP * s / total
		rest -= out[i]
	}

	// CN9: the remainder goes to the larger discarded fractions, ties by position.
	order := make([]int, len(yes))
	for i := range order {
		order[i] = i
	}

	slices.SortStableFunc(order, func(a, b int) int {
		return cmp.Compare(fullTargetBP*yes[b]%total, fullTargetBP*yes[a]%total)
	})

	for _, i := range order[:rest] {
		out[i]++
	}

	return out
}

// withIdeals returns the class with trimmed questions and, when it weighs, derived member
// targets.
func (c PlanClass) withIdeals() (PlanClass, error) {
	if len(c.Questions) == 0 {
		return c, c.checkNoAnswers()
	}

	out, err := c.cleaned()
	if err != nil {
		return PlanClass{}, err
	}

	if !out.Weighs() {
		return out, nil
	}

	return out.withDerivedTargets()
}

// cleaned returns the class with every per-question list checked and complete (CQ1, CO1, CO3).
func (c PlanClass) cleaned() (PlanClass, error) {
	out := c

	questions, err := cleanQuestions(c.Questions)
	if err != nil {
		return PlanClass{}, err
	}

	out.Questions = questions

	if out.QuestionFacts, err = cleanFacts(c.QuestionFacts, len(questions)); err != nil {
		return PlanClass{}, err
	}

	if out.QuestionLimits, err = cleanLimits(c.QuestionLimits, out.QuestionFacts); err != nil {
		return PlanClass{}, err
	}

	if out.QuestionEffects, err = cleanEffects(c.QuestionEffects, len(questions)); err != nil {
		return PlanClass{}, err
	}

	if out.QuestionReviews, err = cleanReviews(c.QuestionReviews, len(questions)); err != nil {
		return PlanClass{}, err
	}

	if out.Members, err = cleanMembers(c.Members, out.QuestionFacts); err != nil {
		return PlanClass{}, err
	}

	return out, nil
}

// withDerivedTargets sets the member targets from the points of the weighing criteria (CQ3); the
// receiver holds members it owns.
func (c PlanClass) withDerivedTargets() (PlanClass, error) {
	points := make([]*int, len(c.Members))

	for i, m := range c.Members {
		if m.TargetBP != nil {
			return PlanClass{}, fmt.Errorf(
				"%w: a typed target in a class with a weighing criterion",
				ErrAnswersInvalid,
			)
		}

		points[i] = c.points(m)
	}

	ideals := IdealsFromAnswers(idealWeights(points))

	for i := range c.Members {
		if ideals != nil {
			c.Members[i].TargetBP = &ideals[i]
		}
	}

	return c, nil
}

func (c PlanClass) checkNoAnswers() error {
	if len(c.QuestionFacts) > 0 || len(c.QuestionLimits) > 0 ||
		len(c.QuestionEffects) > 0 || len(c.QuestionReviews) > 0 {
		return fmt.Errorf(
			"%w: facts, limits, effects or reminders without questions",
			ErrQuestionInvalid,
		)
	}

	for _, m := range c.Members {
		if m.Answers != nil || len(m.AnswerDates) > 0 || len(m.AnswerOverrides) > 0 {
			return fmt.Errorf("%w: answers in a class without questions", ErrAnswersInvalid)
		}
	}

	return nil
}

func cleanQuestions(raw []string) ([]string, error) {
	if len(raw) > maxQuestions {
		return nil, fmt.Errorf("%w: %d questions", ErrQuestionInvalid, len(raw))
	}

	out := make([]string, len(raw))
	seen := make(map[string]bool, len(raw))

	for i, q := range raw {
		q = strings.TrimSpace(q)
		if n := utf8.RuneCountInString(q); n < 1 || n > maxQuestionLen {
			return nil, fmt.Errorf("%w: question %d of %d characters", ErrQuestionInvalid, i+1, n)
		}

		key := strings.ToLower(q)
		if seen[key] {
			return nil, fmt.Errorf("%w: question %d repeats another", ErrQuestionInvalid, i+1)
		}

		seen[key] = true
		out[i] = q
	}

	return out, nil
}

// cleanFacts checks FQ1 and returns one fact per question, "" where the input list is empty.
func cleanFacts(raw []string, questions int) ([]string, error) {
	if len(raw) == 0 {
		return make([]string, questions), nil
	}

	if len(raw) != questions {
		return nil, fmt.Errorf(
			"%w: %d facts for %d questions",
			ErrQuestionInvalid,
			len(raw),
			questions,
		)
	}

	seen := make(map[string]bool, len(raw))

	for i, f := range raw {
		if f == "" {
			continue
		}

		if !FactKnown(f) {
			return nil, fmt.Errorf("%w: fact %d is unknown", ErrQuestionInvalid, i+1)
		}

		if seen[f] {
			return nil, fmt.Errorf("%w: fact %d repeats another", ErrQuestionInvalid, i+1)
		}

		seen[f] = true
	}

	return slices.Clone(raw), nil
}

// points counts the effective answers true of the counting weigh criteria (CO5); nil when a
// question with a fact has no effective answer and no override.
func (c PlanClass) points(m PlanMember) *int {
	yes := 0

	for q, a := range m.Answers {
		if !c.weighs(q) {
			continue
		}

		effective := effectiveAnswer(m, q, a)
		if effective == nil && c.QuestionFacts[q] != "" && !m.AnswerOverrides[q] {
			return nil
		}

		if effective != nil && *effective {
			yes++
		}
	}

	return &yes
}

// effectiveAnswer applies CO4: the override, else the fact answer when it is yes or no, else the
// stored answer; nil when blank.
func effectiveAnswer(m PlanMember, q int, stored *bool) *bool {
	if q < len(m.AnswerOverrides) && m.AnswerOverrides[q] {
		return stored
	}

	if len(m.FactAnswers) == len(m.Answers) && m.FactAnswers[q] != FactNone {
		yes := m.FactAnswers[q] == FactYes

		return &yes
	}

	return stored
}

// idealWeights gives a member without points the weight of an equal share of the class, and the
// others the rest by points (CQ3): with n members, u of them without points, and s the sum of the
// points, s and p(n-u) add up to n times s.
func idealWeights(points []*int) []int {
	sum, scored := 0, 0

	for _, p := range points {
		if p != nil {
			sum += *p
			scored++
		}
	}

	out := make([]int, len(points))
	for i, p := range points {
		out[i] = sum
		if p != nil {
			out[i] = *p * scored
		}
	}

	return out
}
