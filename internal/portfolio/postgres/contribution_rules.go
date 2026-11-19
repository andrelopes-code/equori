package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// attachRules sets the rules of each class of the plan.
func (r *Repository) attachRules(
	ctx context.Context,
	booksID int64,
	plan domain.Plan,
	index map[uuid.UUID]int,
) error {
	rows, err := r.q.ListContributionRules(ctx, booksID)
	if err != nil {
		return fmt.Errorf("list contribution rules: %w", err)
	}

	for _, row := range rows {
		c := &plan.Classes[index[row.ClassID]]
		c.Rules = append(c.Rules, toPlanRule(row))
	}

	return nil
}

// saveContributionRules inserts the rules of a class; the class is already stored.
func saveContributionRules(
	ctx context.Context,
	q *Queries,
	booksID int64,
	classID uuid.UUID,
	c domain.PlanClass,
) error {
	for i, rule := range c.Rules {
		if err := q.InsertContributionRule(ctx, ruleParams(booksID, classID, i, rule)); err != nil {
			return fmt.Errorf("insert contribution rule of %q: %w", c.Name, err)
		}
	}

	return nil
}

func ruleParams(
	booksID int64,
	classID uuid.UUID,
	position int,
	r domain.PlanRule,
) InsertContributionRuleParams {
	//nolint:gosec // G115: Plan.Check bounds a class to 5 rules and a year to 1900-2200
	return InsertContributionRuleParams{
		BooksID:         booksID,
		ClassID:         classID,
		Position:        int32(position),
		InstrumentType:  textOrNil(r.InstrumentType),
		Subtypes:        r.Subtypes,
		QuoteCurrency:   textOrNil(string(r.QuoteCurrency)),
		ReturnKind:      textOrNil(r.ReturnKind),
		MaturesFromYear: fromYear(r.MaturesFromYear),
		MaturesToYear:   fromYear(r.MaturesToYear),
		DailyLiquidity:  r.DailyLiquidity,
		Guarantee:       textOrNil(r.Guarantee),
	}
}

func toPlanRule(r ListContributionRulesRow) domain.PlanRule {
	rule := domain.PlanRule{
		Subtypes:       r.Subtypes,
		DailyLiquidity: r.DailyLiquidity,
	}

	if r.InstrumentType != nil {
		rule.InstrumentType = *r.InstrumentType
	}

	if r.QuoteCurrency != nil {
		rule.QuoteCurrency = money.Currency(*r.QuoteCurrency)
	}

	if r.ReturnKind != nil {
		rule.ReturnKind = *r.ReturnKind
	}

	if r.Guarantee != nil {
		rule.Guarantee = *r.Guarantee
	}

	rule.MaturesFromYear = toYear(r.MaturesFromYear)
	rule.MaturesToYear = toYear(r.MaturesToYear)

	return rule
}

func textOrNil(s string) *string {
	if s == "" {
		return nil
	}

	return &s
}

func fromYear(y *int) *int32 {
	if y == nil {
		return nil
	}

	//nolint:gosec // G115: Plan.Check bounds a year to 1900-2200
	year := int32(*y)

	return &year
}

func toYear(y *int32) *int {
	if y == nil {
		return nil
	}

	year := int(*y)

	return &year
}
