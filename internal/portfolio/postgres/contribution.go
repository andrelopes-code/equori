package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// ContributionPlan returns the plan of the book; false means the book has none.
func (r *Repository) ContributionPlan(
	ctx context.Context,
	booksID int64,
) (domain.Plan, bool, error) {
	head, err := r.q.GetContributionPlan(ctx, booksID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Plan{}, false, nil
	}

	if err != nil {
		return domain.Plan{}, false, fmt.Errorf("get contribution plan: %w", err)
	}

	classes, err := r.q.ListContributionClasses(ctx, booksID)
	if err != nil {
		return domain.Plan{}, false, fmt.Errorf("list contribution classes: %w", err)
	}

	members, err := r.q.ListContributionMembers(ctx, booksID)
	if err != nil {
		return domain.Plan{}, false, fmt.Errorf("list contribution members: %w", err)
	}

	plan := domain.Plan{Classes: make([]domain.PlanClass, len(classes))}
	if head.Amount != nil && head.Currency != nil {
		amount, err := money.New(*head.Amount, money.Currency(*head.Currency))
		if err != nil {
			return domain.Plan{}, false, fmt.Errorf("read contribution amount: %w", err)
		}

		plan.Amount = &amount
	}

	index := make(map[uuid.UUID]int, len(classes))
	for i, c := range classes {
		index[c.ID] = i
		plan.Classes[i] = domain.PlanClass{Name: c.Name, TargetBP: int(c.TargetBp)}
	}

	for _, m := range members {
		i := index[m.ClassID]
		plan.Classes[i].Members = append(plan.Classes[i].Members, toPlanMember(m))
	}

	if err := r.attachQuestions(ctx, booksID, plan, index); err != nil {
		return domain.Plan{}, false, err
	}

	if err := r.attachRules(ctx, booksID, plan, index); err != nil {
		return domain.Plan{}, false, err
	}

	return plan, true, nil
}

// attachQuestions sets the questions of each class and the answer of each member to each of them.
func (r *Repository) attachQuestions(
	ctx context.Context,
	booksID int64,
	plan domain.Plan,
	index map[uuid.UUID]int,
) error {
	questions, err := r.q.ListContributionQuestions(ctx, booksID)
	if err != nil {
		return fmt.Errorf("list contribution questions: %w", err)
	}

	answers, err := r.q.ListContributionAnswers(ctx, booksID)
	if err != nil {
		return fmt.Errorf("list contribution answers: %w", err)
	}

	for _, q := range questions {
		c := &plan.Classes[index[q.ClassID]]
		c.Questions = append(c.Questions, q.Text)
		c.QuestionFacts = append(c.QuestionFacts, deref(q.Fact))
	}

	for _, c := range plan.Classes {
		if len(c.Questions) == 0 {
			continue
		}

		for j := range c.Members {
			c.Members[j].Answers = make([]bool, len(c.Questions))
		}
	}

	for _, a := range answers {
		c := plan.Classes[index[a.ClassID]]
		c.Members[a.MemberPosition].Answers[a.QuestionPosition] = a.Yes
	}

	return nil
}

// SaveContributionPlan replaces the plan of the book; on a pool it runs in one transaction.
func (r *Repository) SaveContributionPlan(
	ctx context.Context,
	booksID int64,
	p domain.Plan,
) error {
	if r.pool == nil {
		return saveContributionPlan(ctx, r.q, booksID, p)
	}

	return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		return saveContributionPlan(ctx, New(tx), booksID, p)
	})
}

func saveContributionPlan(ctx context.Context, q *Queries, booksID int64, p domain.Plan) error {
	if err := q.DeleteContributionPlan(ctx, booksID); err != nil {
		return fmt.Errorf("delete contribution plan: %w", err)
	}

	head := InsertContributionPlanParams{BooksID: booksID}
	if p.Amount != nil {
		amount, currency := p.Amount.Amount(), string(p.Amount.Currency())
		head.Amount, head.Currency = &amount, &currency
	}

	if err := q.InsertContributionPlan(ctx, head); err != nil {
		return fmt.Errorf("insert contribution plan: %w", err)
	}

	for i, c := range p.Classes {
		//nolint:gosec // G115: Plan.Check bounds the position to 0-19 and the target to 0-10000
		id, err := q.InsertContributionClass(ctx, InsertContributionClassParams{
			BooksID:  booksID,
			Position: int32(i),
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

		if err := saveContributionRules(ctx, q, booksID, id, c); err != nil {
			return err
		}
	}

	return nil
}

// saveContributionQuestions inserts the questions of a class, then the answer of each member to
// each of them; the members of the class are already stored.
func saveContributionQuestions(
	ctx context.Context,
	q *Queries,
	booksID int64,
	classID uuid.UUID,
	c domain.PlanClass,
) error {
	for i, text := range c.Questions {
		//nolint:gosec // G115: WithIdeals bounds a class to 10 questions
		err := q.InsertContributionQuestion(ctx, InsertContributionQuestionParams{
			BooksID:  booksID,
			ClassID:  classID,
			Position: int32(i),
			Text:     text,
			Fact:     factOrNil(c.QuestionFacts, i),
		})
		if err != nil {
			return fmt.Errorf("insert contribution question of %q: %w", c.Name, err)
		}
	}

	for j, m := range c.Members {
		for i, yes := range m.Answers {
			//nolint:gosec // G115: a class holds at most 10 questions and 20 members
			err := q.InsertContributionAnswer(ctx, InsertContributionAnswerParams{
				BooksID:          booksID,
				ClassID:          classID,
				QuestionPosition: int32(i),
				MemberPosition:   int32(j),
				Yes:              yes,
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
		BooksID:  booksID,
		ClassID:  classID,
		Position: int32(position),
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

func toPlanMember(m ListContributionMembersRow) domain.PlanMember {
	member := domain.PlanMember{}
	if m.AccountID.Valid {
		member.AccountID = m.AccountID.UUID
	}

	if m.Instrument != nil {
		member.Instrument = money.Currency(*m.Instrument)
	}

	if m.TargetBp != nil {
		target := int(*m.TargetBp)
		member.TargetBP = &target
	}

	return member
}

// factOrNil returns the fact of question i, nil when the question names none.
func factOrNil(facts []string, i int) *string {
	if i >= len(facts) || facts[i] == "" {
		return nil
	}

	return &facts[i]
}
