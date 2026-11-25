package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

type memberKey struct {
	class    uuid.UUID
	position int32
}

// memberSlots is the place of each stored member in its class: the positions have gaps after a
// member leaves with its account or instrument.
type memberSlots map[memberKey]int

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

	plan := domain.Plan{
		Revision: head.Revision,
		Classes:  make([]domain.PlanClass, len(classes)),
	}
	if plan.Amount, err = planAmount(head); err != nil {
		return domain.Plan{}, false, err
	}

	index := make(map[uuid.UUID]int, len(classes))
	for i, c := range classes {
		index[c.ID] = i
		plan.Classes[i] = domain.PlanClass{Name: c.Name, TargetBP: int(c.TargetBp)}
	}

	slots := make(memberSlots, len(members))
	for _, m := range members {
		i := index[m.ClassID]
		slots[memberKey{m.ClassID, m.Position}] = len(plan.Classes[i].Members)
		plan.Classes[i].Members = append(plan.Classes[i].Members, toPlanMember(m))
	}

	if err := r.attachQuestions(ctx, booksID, plan, index, slots); err != nil {
		return domain.Plan{}, false, err
	}

	if err := r.attachRules(ctx, booksID, plan, index); err != nil {
		return domain.Plan{}, false, err
	}

	return plan, true, nil
}

func planAmount(head GetContributionPlanRow) (*money.Money, error) {
	if head.Amount == nil || head.Currency == nil {
		return nil, nil
	}

	amount, err := money.New(*head.Amount, money.Currency(*head.Currency))
	if err != nil {
		return nil, fmt.Errorf("read contribution amount: %w", err)
	}

	return &amount, nil
}

// attachQuestions sets the questions of each class and the answer of each member to each of them.
func (r *Repository) attachQuestions(
	ctx context.Context,
	booksID int64,
	plan domain.Plan,
	index map[uuid.UUID]int,
	slots memberSlots,
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
		c.QuestionLimits = append(c.QuestionLimits, q.LimitValue)
		c.QuestionEffects = append(c.QuestionEffects, q.Effect)
		c.QuestionReviews = append(c.QuestionReviews, int(q.ReviewMonths))
	}

	attachAnswers(plan, index, slots, answers)

	return nil
}

// attachAnswers gives each member of a class with questions one answer, date and override per
// question, then fills them from the stored rows.
func attachAnswers(
	plan domain.Plan,
	index map[uuid.UUID]int,
	slots memberSlots,
	answers []ListContributionAnswersRow,
) {
	for _, c := range plan.Classes {
		if len(c.Questions) == 0 {
			continue
		}

		for j := range c.Members {
			c.Members[j].Answers = make([]*bool, len(c.Questions))
			c.Members[j].AnswerDates = make([]*time.Time, len(c.Questions))
			c.Members[j].AnswerOverrides = make([]bool, len(c.Questions))
		}
	}

	for _, a := range answers {
		slot := slots[memberKey{a.ClassID, a.MemberPosition}]
		m := &plan.Classes[index[a.ClassID]].Members[slot]
		m.Answers[a.QuestionPosition] = a.Yes
		m.AnswerDates[a.QuestionPosition] = a.AnsweredOn
		m.AnswerOverrides[a.QuestionPosition] = a.Overrides
	}
}

func toPlanMember(m ListContributionMembersRow) domain.PlanMember {
	member := domain.PlanMember{ReleaseMonth: m.ReleaseMonth}
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

// FactInUse reports whether a question of any book names the fact (CO17).
func (r *Repository) FactInUse(ctx context.Context, fact string) (bool, error) {
	inUse, err := r.q.ContributionFactInUse(ctx, fact)
	if err != nil {
		return false, fmt.Errorf("read the use of %s: %w", fact, err)
	}

	return inUse, nil
}
