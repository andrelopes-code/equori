package domain

import (
	"cmp"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"
)

const (
	maxQuestions   = 10
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
	return len(c.Questions) > 0 && slices.ContainsFunc(c.Members, func(m PlanMember) bool {
		return m.TargetBP != nil
	})
}

// IdealsFromAnswers returns the member targets of CQ3 for the given counts of answers true; nil
// when every count is zero.
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

// withIdeals returns the class with trimmed questions and derived member targets.
func (c PlanClass) withIdeals() (PlanClass, error) {
	if len(c.Questions) == 0 {
		return c, c.checkNoAnswers()
	}

	questions, err := cleanQuestions(c.Questions)
	if err != nil {
		return PlanClass{}, err
	}

	facts, err := cleanFacts(c.QuestionFacts, len(questions))
	if err != nil {
		return PlanClass{}, err
	}

	yes, err := countYes(c.Members, len(questions))
	if err != nil {
		return PlanClass{}, err
	}

	ideals := IdealsFromAnswers(yes)
	out := c
	out.Questions = questions
	out.QuestionFacts = facts
	out.Members = make([]PlanMember, len(c.Members))

	for i, m := range c.Members {
		m.Answers = slices.Clone(m.Answers)
		m.TargetBP = nil

		if ideals != nil {
			m.TargetBP = &ideals[i]
		}

		out.Members[i] = m
	}

	return out, nil
}

func (c PlanClass) checkNoAnswers() error {
	if len(c.QuestionFacts) > 0 {
		return fmt.Errorf("%w: facts in a class without questions", ErrQuestionInvalid)
	}

	for _, m := range c.Members {
		if m.Answers != nil {
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

func countYes(members []PlanMember, questions int) ([]int, error) {
	yes := make([]int, len(members))

	for i, m := range members {
		if m.TargetBP != nil {
			return nil, fmt.Errorf(
				"%w: a typed target in a class with questions",
				ErrAnswersInvalid,
			)
		}

		if len(m.Answers) != questions {
			return nil, fmt.Errorf(
				"%w: %d answers for %d questions",
				ErrAnswersInvalid,
				len(m.Answers),
				questions,
			)
		}

		for q, a := range m.Answers {
			if effectiveAnswer(m, q, a) {
				yes[i]++
			}
		}
	}

	return yes, nil
}

// effectiveAnswer applies FQ4: the fact answer when it is yes or no, else the stored answer.
func effectiveAnswer(m PlanMember, q int, stored bool) bool {
	if len(m.FactAnswers) == len(m.Answers) && m.FactAnswers[q] != FactNone {
		return m.FactAnswers[q] == FactYes
	}

	return stored
}
