package app

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// factsCache holds the facts read for each instrument of one call; a nil entry has none.
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

// withFacts sets FactAnswers, FactDetails and FactsYear on each member of a class that names a fact
// (FQ3, FQ6, AC12). A class without a fact is returned unchanged.
func (s *Service) withFacts(ctx context.Context, p domain.Plan) (domain.Plan, error) {
	out := p
	out.Classes = slices.Clone(p.Classes)
	cache := factsCache{}

	mood, err := s.sentiments(ctx, p)
	if err != nil {
		return domain.Plan{}, err
	}

	for i, c := range p.Classes {
		if !namesFact(c) {
			continue
		}

		members, err := s.memberFacts(ctx, c, cache, mood)
		if err != nil {
			return domain.Plan{}, err
		}

		out.Classes[i].Members = members
	}

	return out, nil
}

// withoutDerivedTargets clears the member targets of every class that weighs its criteria (FQ5,
// CO5).
func withoutDerivedTargets(p domain.Plan) domain.Plan {
	out := p
	out.Classes = slices.Clone(p.Classes)

	for i, c := range p.Classes {
		if !c.Weighs() {
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
	mood moods,
) ([]domain.PlanMember, error) {
	members := slices.Clone(c.Members)

	for j, m := range members {
		var facts *domain.CompanyFacts

		if m.AccountID == uuid.Nil {
			var err error

			if facts, err = s.companyFacts(ctx, m.Instrument, cache); err != nil {
				return nil, err
			}
		}

		setFacts(&members[j], c, facts, mood)
	}

	return members, nil
}

// setFacts sets the answer, the detail and the fiscal year of each fact of c on m; facts is nil
// when no company report exists.
func setFacts(
	m *domain.PlanMember,
	c domain.PlanClass,
	facts *domain.CompanyFacts,
	mood moods,
) {
	m.FactAnswers = make([]domain.FactAnswer, len(c.Questions))
	m.FactDetails = make([]domain.FactDetail, len(c.Questions))
	m.FactsYear = nil

	var signals []domain.FactAnswer

	if facts != nil {
		answers, year, ok := facts.Answers(c.QuestionFacts)
		signals = answers

		if ok && slices.ContainsFunc(c.QuestionFacts, domain.IsSignal) {
			m.FactsYear = &year
		}
	}

	for q, key := range c.QuestionFacts {
		m.FactAnswers[q] = domain.FactNone

		switch {
		case key == "":
		case domain.HasLimit(key) && (q >= len(c.QuestionLimits) || c.QuestionLimits[q] == ""):
			m.FactDetails[q] = domain.FactDetail{Reason: domain.NoLimit}
		case mood.has(key):
			m.FactAnswers[q], m.FactDetails[q] = mood.answer(key, c.QuestionLimits[q])
		case facts == nil:
			m.FactDetails[q] = domain.FactDetail{Reason: domain.NoReport}
		case domain.IsSignal(key):
			m.FactAnswers[q] = signals[q]
			m.FactDetails[q] = facts.SignalDetail(signals[q])
		case q < len(c.QuestionLimits):
			m.FactAnswers[q], m.FactDetails[q] = facts.Limit(key, c.QuestionLimits[q])
		}
	}
}

func (s *Service) companyFacts(
	ctx context.Context,
	code money.Currency,
	cache factsCache,
) (*domain.CompanyFacts, error) {
	if facts, ok := cache[code]; ok {
		return facts, nil
	}

	facts, found, err := s.md.CompanyFacts(ctx, code, criterionPriceDate(s.ledger.Today(ctx)))
	if err != nil {
		return nil, fmt.Errorf("read the company facts of %s: %w", code, err)
	}

	cache[code] = nil
	if found {
		cache[code] = &facts
	}

	return cache[code], nil
}

// criterionPriceDate is the last day of the month before today: a price moves an answer at most
// once a month (AC13).
func criterionPriceDate(today time.Time) time.Time {
	return time.Date(today.Year(), today.Month(), 0, 0, 0, 0, 0, time.UTC)
}
