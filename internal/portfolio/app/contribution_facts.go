package app

import (
	"context"
	"fmt"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// factsCache holds the fiscal years read for each instrument of one call; a nil entry has none.
type factsCache map[money.Currency]*domain.CompanyFacts

// withIdeals sets the fact answers of p, then derives the member ideals from the effective answers
// (FQ4, FQ5).
func (s *Service) withIdeals(ctx context.Context, p domain.Plan) (domain.Plan, error) {
	p, err := s.withFacts(ctx, p)
	if err != nil {
		return domain.Plan{}, err
	}

	return p.WithIdeals()
}

// withFacts sets FactAnswers and FactsYear on each instrument member of a class that names a fact
// (FQ3, FQ6). A class without a fact is returned unchanged.
func (s *Service) withFacts(ctx context.Context, p domain.Plan) (domain.Plan, error) {
	out := p
	out.Classes = slices.Clone(p.Classes)
	cache := factsCache{}

	for i, c := range p.Classes {
		if !namesFact(c) {
			continue
		}

		members, err := s.memberFacts(ctx, c, cache)
		if err != nil {
			return domain.Plan{}, err
		}

		out.Classes[i].Members = members
	}

	return out, nil
}

// withoutDerivedTargets clears the member targets of every class with questions (FQ5).
func withoutDerivedTargets(p domain.Plan) domain.Plan {
	out := p
	out.Classes = slices.Clone(p.Classes)

	for i, c := range p.Classes {
		if len(c.Questions) == 0 {
			continue
		}

		out.Classes[i].Members = slices.Clone(c.Members)
		for j := range out.Classes[i].Members {
			out.Classes[i].Members[j].TargetBP = nil
		}
	}

	return out
}

// namesFact reports whether the class holds one fact per question and names at least one. A list
// of another length is left to the check of FQ1.
func namesFact(c domain.PlanClass) bool {
	return len(c.Questions) > 0 && len(c.QuestionFacts) == len(c.Questions) &&
		slices.ContainsFunc(c.QuestionFacts, func(f string) bool { return f != "" })
}

func (s *Service) memberFacts(
	ctx context.Context,
	c domain.PlanClass,
	cache factsCache,
) ([]domain.PlanMember, error) {
	members := slices.Clone(c.Members)

	for j, m := range members {
		members[j].FactAnswers, members[j].FactsYear = noFactAnswers(len(c.Questions)), nil
		if m.AccountID != uuid.Nil {
			continue
		}

		facts, err := s.companyFacts(ctx, m.Instrument, cache)
		if err != nil {
			return nil, err
		}

		if facts == nil {
			continue
		}

		answers, year, ok := facts.Answers(c.QuestionFacts)
		if ok {
			members[j].FactAnswers, members[j].FactsYear = answers, &year
		}
	}

	return members, nil
}

func (s *Service) companyFacts(
	ctx context.Context,
	code money.Currency,
	cache factsCache,
) (*domain.CompanyFacts, error) {
	if facts, ok := cache[code]; ok {
		return facts, nil
	}

	facts, found, err := s.md.CompanyFacts(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("read the company facts of %s: %w", code, err)
	}

	cache[code] = nil
	if found {
		cache[code] = &facts
	}

	return cache[code], nil
}

func noFactAnswers(n int) []domain.FactAnswer {
	out := make([]domain.FactAnswer, n)
	for i := range out {
		out[i] = domain.FactNone
	}

	return out
}
