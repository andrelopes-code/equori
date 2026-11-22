package httpapi

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

const (
	statusComplete   ContributionPlanStatus = "complete"
	statusIncomplete ContributionPlanStatus = "incomplete"
)

func (s *Server) getContributionPlan(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (ContributionPlan, error) {
	view, err := s.svc.ContributionPlan(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return ContributionPlan{}, err
	}

	return contributionPlan(view), nil
}

func (s *Server) saveContributionPlan(
	ctx context.Context,
	_ *http.Request,
	in ContributionPlanInput,
) (ContributionPlan, error) {
	p := domain.Plan{Classes: planClasses(in.Classes)}

	if in.Amount != nil {
		amount, err := inputAmount(*in.Amount)
		if err != nil {
			return ContributionPlan{}, err
		}

		p.Amount = &amount
	}

	view, err := s.svc.SaveContributionPlan(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return ContributionPlan{}, err
	}

	return contributionPlan(view), nil
}

func (s *Server) previewContributionPlan(
	ctx context.Context,
	_ *http.Request,
	in ContributionPreviewInput,
) (ContributionPlan, error) {
	p := domain.Plan{Classes: planClasses(in.Classes)}

	if in.Amount == nil {
		view, err := s.svc.PreviewDraft(ctx, auth.MustBooksID(ctx), p)
		if err != nil {
			return ContributionPlan{}, err
		}

		return contributionPlan(view), nil
	}

	amount, err := inputAmount(*in.Amount)
	if err != nil {
		return ContributionPlan{}, err
	}

	view, err := s.svc.PreviewContribution(
		ctx,
		auth.MustBooksID(ctx),
		p,
		amount,
	)
	if err != nil {
		return ContributionPlan{}, err
	}

	return contributionPlan(view), nil
}

// inputAmount reads a contribution amount; an unknown currency is an invalid amount.
func inputAmount(m Money) (money.Money, error) {
	amount, err := money.New(m.Amount, money.Currency(m.Currency))
	if err != nil {
		return money.Money{}, fmt.Errorf("%w: %w", app.ErrContributionAmountInvalid, err)
	}

	return amount, nil
}

func planClasses(in []ContributionClassInput) []domain.PlanClass {
	out := make([]domain.PlanClass, len(in))
	for i, c := range in {
		members := make([]domain.PlanMember, len(c.Members))
		for j, m := range c.Members {
			members[j] = domain.PlanMember{TargetBP: m.TargetBp}
			if m.Answers != nil {
				members[j].Answers = *m.Answers
			}

			if m.AccountId != nil {
				members[j].AccountID = *m.AccountId
			}

			if m.Instrument != nil {
				members[j].Instrument = money.Currency(*m.Instrument)
			}
		}

		out[i] = domain.PlanClass{
			Name:     c.Name,
			TargetBP: c.TargetBp,
			Members:  members,
			Rules:    planRules(c.Rules),
		}
		if c.Questions != nil {
			out[i].Questions = *c.Questions
		}

		if c.QuestionFacts != nil {
			out[i].QuestionFacts = *c.QuestionFacts
		}
	}

	return out
}

func contributionPlan(v app.ContributionView) ContributionPlan {
	out := ContributionPlan{
		Amount:       optionalMoney(v.Amount),
		Status:       statusComplete,
		Total:        toMoney(v.Total),
		TotalAfter:   optionalMoney(v.TotalAfter),
		DriftBp:      v.DriftBP,
		DriftAfterBp: v.DriftAfterBP,
		Leftover:     optionalMoney(v.Leftover),
		Classes:      make([]ContributionClass, len(v.Classes)),
		Outside:      make([]ContributionOutside, len(v.Outside)),
		Missing:      make([]ContributionMissing, len(v.Missing)),
		Current:      toCurrent(v.Current),

		GuaranteeName: optional(v.GuaranteeName),
	}
	if !v.Complete {
		out.Status = statusIncomplete
	}

	for i, c := range v.Classes {
		out.Classes[i] = contributionClass(c)
	}

	for i, o := range v.Outside {
		out.Outside[i] = ContributionOutside{
			AccountId:  optionalID(o.AccountID),
			Instrument: optional(string(o.Instrument)),
			Value:      optionalMoney(o.Value),
			ReturnKind: outsideReturnKind(o.ReturnKind),
		}
	}

	for i, m := range v.Missing {
		out.Missing[i] = ContributionMissing{
			AccountId:  optionalID(m.AccountID),
			Instrument: string(m.Instrument),
			Kind:       ContributionMissingKind(m.Kind),
		}
	}

	return out
}

func contributionClass(c app.ContributionClass) ContributionClass {
	out := ContributionClass{
		Name:           c.Name,
		TargetBp:       c.TargetBP,
		Questions:      append([]string{}, c.Questions...),
		QuestionFacts:  append([]string{}, c.QuestionFacts...),
		QuestionIdeals: c.QuestionIdeals,
		Value:          toMoney(c.Value),
		ShareBp:        c.ShareBP,
		AfterShareBp:   c.AfterShareBP,
		Amount:         optionalMoney(c.Amount),
		Cost:           optionalMoney(c.Cost),
		Members:        make([]ContributionMember, len(c.Members)),
		Rules:          contributionRules(c.Rules),
		Matched:        contributionMatched(c.Matched),
	}

	for i, m := range c.Members {
		out.Members[i] = ContributionMember{
			AccountId:    optionalID(m.AccountID),
			Instrument:   optional(string(m.Instrument)),
			TargetBp:     m.TargetBP,
			Answers:      optionalAnswers(m.Answers),
			FactAnswers:  optionalFactAnswers(m.FactAnswers),
			FactsYear:    optionalDate(m.FactsYear),
			Value:        toMoney(m.Value),
			ShareBp:      m.ShareBP,
			AfterShareBp: m.AfterShareBP,
			UnitValue:    optionalMoney(m.UnitValue),
			Amount:       optionalMoney(m.Amount),
			Quantity:     optionalMoney(m.Quantity),
			Cost:         optionalMoney(m.Cost),
		}
	}

	return out
}

func optionalAnswers(a []bool) *[]bool {
	if a == nil {
		return nil
	}

	return &a
}

func optionalFactAnswers(a []domain.FactAnswer) *[]ContributionMemberFactAnswers {
	if a == nil {
		return nil
	}

	out := make([]ContributionMemberFactAnswers, len(a))
	for i, v := range a {
		out[i] = ContributionMemberFactAnswers(v)
	}

	return &out
}

func optionalDate(t *time.Time) *openapi_types.Date {
	if t == nil {
		return nil
	}

	d := date(*t)

	return &d
}

func optionalMoney(m *money.Money) *Money {
	if m == nil {
		return nil
	}

	out := toMoney(*m)

	return &out
}

func optionalID(id uuid.UUID) *uuid.UUID {
	if id == uuid.Nil {
		return nil
	}

	return &id
}
