package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// SaveContributionPlan replaces the plan of the book and returns its new revision; on a pool it
// runs in one transaction. A plan whose Expected revision is not the stored one returns
// domain.ErrPlanChanged and leaves the stored plan as it was (CO15).
func (r *Repository) SaveContributionPlan(
	ctx context.Context,
	booksID int64,
	p domain.Plan,
) (int64, error) {
	if r.pool == nil {
		return saveContributionPlan(ctx, r.q, booksID, p)
	}

	var revision int64

	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		var err error

		revision, err = saveContributionPlan(ctx, New(tx), booksID, p)

		return err
	})
	if err != nil {
		return 0, err
	}

	return revision, nil
}

func saveContributionPlan(
	ctx context.Context,
	q *Queries,
	booksID int64,
	p domain.Plan,
) (int64, error) {
	head := UpsertContributionPlanParams{BooksID: booksID}
	if p.Amount != nil {
		amount, currency := p.Amount.Amount(), string(p.Amount.Currency())
		head.Amount, head.Currency = &amount, &currency
	}

	revision, err := q.UpsertContributionPlan(ctx, head)
	if err != nil {
		return 0, fmt.Errorf("upsert contribution plan: %w", err)
	}

	if p.Expected != nil && revision != *p.Expected+1 {
		return 0, domain.ErrPlanChanged
	}

	if err := q.DeleteContributionClasses(ctx, booksID); err != nil {
		return 0, fmt.Errorf("delete contribution classes: %w", err)
	}

	for i, c := range p.Classes {
		if err := saveContributionClass(ctx, q, booksID, i, c); err != nil {
			return 0, err
		}
	}

	return revision, nil
}

func saveContributionClass(
	ctx context.Context,
	q *Queries,
	booksID int64,
	position int,
	c domain.PlanClass,
) error {
	//nolint:gosec // G115: Plan.Check bounds the position to 0-19 and the target to 0-10000
	id, err := q.InsertContributionClass(ctx, InsertContributionClassParams{
		BooksID:  booksID,
		Position: int32(position),
		Name:     c.Name,
		TargetBp: int32(c.TargetBP),
	})
	if err != nil {
		return fmt.Errorf("insert contribution class %q: %w", c.Name, err)
	}

	for j, m := range c.Members {
		if err := q.InsertContributionMember(ctx, memberParams(booksID, id, j, m)); err != nil {
			return fmt.Errorf("insert contribution member of %q: %w", c.Name, err)
		}
	}

	if err := saveContributionQuestions(ctx, q, booksID, id, c); err != nil {
		return err
	}

	return saveContributionRules(ctx, q, booksID, id, c)
}

// saveContributionQuestions inserts the questions of a class, then the answer of each member to
// each of them; the members of the class are already stored. An absent effect is weigh, an absent
// reminder 0, an absent date nil and an absent override false.
func saveContributionQuestions(
	ctx context.Context,
	q *Queries,
	booksID int64,
	classID uuid.UUID,
	c domain.PlanClass,
) error {
	for i, text := range c.Questions {
		//nolint:gosec // G115: WithIdeals bounds a class to 20 questions
		err := q.InsertContributionQuestion(ctx, InsertContributionQuestionParams{
			BooksID:      booksID,
			ClassID:      classID,
			Position:     int32(i),
			Text:         text,
			Fact:         factOrNil(c.QuestionFacts, i),
			LimitValue:   limitOf(c.QuestionLimits, i),
			Effect:       effectOf(c.QuestionEffects, i),
			ReviewMonths: reviewOf(c.QuestionReviews, i),
		})
		if err != nil {
			return fmt.Errorf("insert contribution question of %q: %w", c.Name, err)
		}
	}

	for j, m := range c.Members {
		for i, yes := range m.Answers {
			//nolint:gosec // G115: a class holds at most 20 questions and 20 members
			err := q.InsertContributionAnswer(ctx, InsertContributionAnswerParams{
				BooksID:          booksID,
				ClassID:          classID,
				QuestionPosition: int32(i),
				MemberPosition:   int32(j),
				Yes:              yes,
				AnsweredOn:       dateOf(m.AnswerDates, i),
				Overrides:        i < len(m.AnswerOverrides) && m.AnswerOverrides[i],
			})
			if err != nil {
				return fmt.Errorf("insert contribution answer of %q: %w", c.Name, err)
			}
		}
	}

	return nil
}

func memberParams(
	booksID int64,
	classID uuid.UUID,
	position int,
	m domain.PlanMember,
) InsertContributionMemberParams {
	//nolint:gosec // G115: a class holds at most 20 members
	params := InsertContributionMemberParams{
		BooksID:      booksID,
		ClassID:      classID,
		Position:     int32(position),
		ReleaseMonth: m.ReleaseMonth,
	}

	if m.AccountID != uuid.Nil {
		params.AccountID = uuid.NullUUID{UUID: m.AccountID, Valid: true}
	}

	if m.Instrument != "" {
		instrument := string(m.Instrument)
		params.Instrument = &instrument
	}

	if m.TargetBP != nil {
		//nolint:gosec // G115: Plan.Check bounds the target to 0-10000
		target := int32(*m.TargetBP)
		params.TargetBp = &target
	}

	return params
}

// factOrNil returns the fact of question i, nil when the question names none.
func factOrNil(facts []string, i int) *string {
	if i >= len(facts) || facts[i] == "" {
		return nil
	}

	return &facts[i]
}

// limitOf returns the limit of question i, "" when the question has none.
func limitOf(limits []string, i int) string {
	if i >= len(limits) {
		return ""
	}

	return limits[i]
}

// effectOf returns the effect of question i, weigh when the list is shorter or the entry empty.
func effectOf(effects []string, i int) string {
	if i >= len(effects) || effects[i] == "" {
		return domain.EffectWeigh
	}

	return effects[i]
}

// reviewOf returns the reminder of question i in months, 0 when the list is shorter.
func reviewOf(reviews []int, i int) int16 {
	if i >= len(reviews) {
		return 0
	}

	//nolint:gosec // G115: the column accepts 0, 1, 3, 6 and 12 only
	return int16(reviews[i])
}

// dateOf returns the answer date of question i, nil when the list is shorter.
func dateOf(dates []*time.Time, i int) *time.Time {
	if i >= len(dates) {
		return nil
	}

	return dates[i]
}
