package toolapi

import (
	"context"
	"fmt"
	"slices"
	"strconv"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

type contributionMemberIn struct {
	AccountID    string `json:"account_id,omitzero"    jsonschema:"account counted whole; instead of instrument"`
	Instrument   string `json:"instrument,omitzero"    jsonschema:"code such as BOVA11; instead of account_id"`
	TargetBP     int    `json:"target_bp,omitzero"     jsonschema:"members add up to 10000, or none has one"`
	Answers      []bool `json:"answers,omitzero"       jsonschema:"per question of the group, true for yes"`
	BlankAnswers []int  `json:"blank_answers,omitzero" jsonschema:"0-based blank positions"`

	AnswerOverrides []int             `json:"answer_overrides,omitzero" jsonschema:"0-based overridden facts"`
	Released        tool.OptionalBool `json:"released,omitzero"         jsonschema:"free a held asset this month"`
}

type contributionRuleIn struct {
	InstrumentType  string            `json:"instrument_type,omitzero"   jsonschema:"fixed_income, stock"`
	Subtypes        []string          `json:"subtypes,omitzero"          jsonschema:"subtypes, such as cdb or lci"`
	QuoteCurrency   string            `json:"quote_currency,omitzero"    jsonschema:"quote currency"`
	ReturnKind      string            `json:"return_kind,omitzero"       jsonschema:"rate, inflation or fixed"`
	MaturesFromYear int               `json:"matures_from_year,omitzero" jsonschema:"first maturity year"`
	MaturesToYear   int               `json:"matures_to_year,omitzero"   jsonschema:"last maturity year"`
	DailyLiquidity  tool.OptionalBool `json:"daily_liquidity,omitzero"   jsonschema:"redeemable any business day"`
	Guarantee       string            `json:"guarantee,omitzero"         jsonschema:"covered, sovereign or uncovered"`
}

type contributionClassIn struct {
	Name     string                 `json:"name"      jsonschema:"unique, 1 to 60 characters"`
	TargetBP int                    `json:"target_bp" jsonschema:"4000 is 40%; they add up to 10000"`
	Members  []contributionMemberIn `json:"members"   jsonschema:"a holding belongs to at most one class"`

	Questions      []string             `json:"questions,omitzero"       jsonschema:"yes-or-no questions, at most 20 of 1 to 200 characters; members then carry answers, no target_bp with weigh"`
	QuestionFacts  []string             `json:"question_facts,omitzero"  jsonschema:"fact key per question, empty for none: piotroski_p1 to p9 or a limit key (guide contribution_plan)"`
	QuestionLimits []string             `json:"question_limits,omitzero" jsonschema:"limit per question, empty for none; 0.12 is 12%"`
	Rules          []contributionRuleIn `json:"rules,omitzero"           jsonschema:"at most 5, instead of members: a security that meets one joins"`

	QuestionEffects []string `json:"question_effects,omitzero" jsonschema:"warn, hold or weigh per question"`
	QuestionReviews []int    `json:"question_reviews,omitzero" jsonschema:"months per question"`
}

type saveContributionPlanIn struct {
	Amount  string                `json:"amount,omitzero" jsonschema:"monthly contribution, positive decimal; absent stores none"`
	Classes []contributionClassIn `json:"classes"         jsonschema:"at most 20; an empty list removes the plan"`
}

func saveContributionPlan(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "save_contribution_plan",
		Description: "Proposes the contribution plan of the book: the classes, their target shares, their holdings and the monthly amount. " +
			"It replaces the whole plan: read it with get_portfolio view contribution and repeat what stays. " +
			"Use it when the user changes the target split or the monthly contribution. " +
			"Do not use it to see where a contribution goes: get_portfolio view contribution with amount does, and stores nothing. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in saveContributionPlanIn) (tool.Preview, error) {
		pv, _, err := planContributionSave(ctx, svc, booksID, in)
		return pv, err
	}, func(ctx context.Context, booksID int64, in saveContributionPlanIn) (contributionView, error) {
		_, p, err := planContributionSave(ctx, svc, booksID, in)
		if err != nil {
			return contributionView{}, err
		}

		v, err := svc.SaveContributionPlan(ctx, booksID, p)
		if err != nil {
			return contributionView{}, err
		}

		return contributionViewOf(v), nil
	})
}

func planContributionSave(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in saveContributionPlanIn,
) (tool.Preview, domain.Plan, error) {
	pv := tool.Preview{
		Action: "save_contribution_plan",
		Changes: []tool.Change{
			{Field: "count", After: tool.TextValue(strconv.Itoa(len(in.Classes)))},
		},
	}

	classes, err := contributionClasses(in.Classes)
	if err != nil {
		return pv, domain.Plan{}, err
	}

	p := domain.Plan{Classes: classes}
	for _, c := range in.Classes {
		pv.Items = append(pv.Items, tool.Item{
			Description: fmt.Sprintf("%s %d.%02d%%", c.Name, c.TargetBP/100, c.TargetBP%100),
		})
	}

	if in.Amount == "" {
		return pv, p, nil
	}

	// The total of the stored view carries the base currency of the book.
	current, err := svc.ContributionPlan(ctx, booksID)
	if err != nil {
		return pv, p, err
	}

	unit, err := money.New(0, current.Total.Currency())
	if err != nil {
		return pv, p, err
	}

	amount, err := tool.ParsePositive("amount", in.Amount, unit)
	if err != nil {
		return pv, p, err
	}

	p.Amount = &amount
	pv.Changes = append(pv.Changes, tool.Change{Field: "amount", After: tool.MoneyValue(amount)})

	return pv, p, nil
}

func contributionClasses(in []contributionClassIn) ([]domain.PlanClass, error) {
	out := make([]domain.PlanClass, len(in))

	for i, c := range in {
		members := make([]domain.PlanMember, len(c.Members))
		// A class has member targets when one member names a target; the others then hold 0.
		targeted := slices.ContainsFunc(c.Members, func(m contributionMemberIn) bool {
			return m.TargetBP != 0
		})

		for j, m := range c.Members {
			field := fmt.Sprintf("classes[%d].members[%d].account_id", i, j)

			id, err := optionalID(m.AccountID, field)
			if err != nil {
				return nil, err
			}

			members[j] = domain.PlanMember{
				AccountID:  id,
				Instrument: money.Currency(m.Instrument),
				Answers:    planAnswers(m.Answers, m.BlankAnswers),

				AnswerOverrides: planOverrides(m.Answers, m.AnswerOverrides),
			}
			if m.Released.Set {
				members[j].Released = &m.Released.B
			}

			if targeted {
				members[j].TargetBP = &m.TargetBP
			}
		}

		out[i] = domain.PlanClass{
			Name:           c.Name,
			TargetBP:       c.TargetBP,
			Questions:      c.Questions,
			QuestionFacts:  c.QuestionFacts,
			QuestionLimits: c.QuestionLimits,

			QuestionEffects: c.QuestionEffects,
			QuestionReviews: c.QuestionReviews,

			Members: members,
			Rules:   contributionPlanRules(c.Rules),
		}
	}

	return out, nil
}

// planAnswers reads the answers with a blank at each position of blank; a position outside them
// changes nothing.
func planAnswers(answers []bool, blank []int) []*bool {
	if answers == nil {
		return nil
	}

	out := make([]*bool, len(answers))

	for i := range answers {
		if !slices.Contains(blank, i) {
			out[i] = &answers[i]
		}
	}

	return out
}

// planOverrides marks each answer named by a position; a position outside the answers changes
// nothing, and no position leaves the stored overrides.
func planOverrides(answers []bool, positions []int) []bool {
	if len(positions) == 0 {
		return nil
	}

	out := make([]bool, len(answers))

	for _, p := range positions {
		if p >= 0 && p < len(out) {
			out[p] = true
		}
	}

	return out
}

// contributionPlanRules maps the rules of a class; a year of 0 is unset.
func contributionPlanRules(in []contributionRuleIn) []domain.PlanRule {
	out := make([]domain.PlanRule, len(in))

	for i, r := range in {
		out[i] = domain.PlanRule{
			InstrumentType: r.InstrumentType,
			Subtypes:       r.Subtypes,
			QuoteCurrency:  money.Currency(r.QuoteCurrency),
			ReturnKind:     r.ReturnKind,
			Guarantee:      r.Guarantee,
		}
		if r.DailyLiquidity.Set {
			out[i].DailyLiquidity = &r.DailyLiquidity.B
		}

		if r.MaturesFromYear != 0 {
			out[i].MaturesFromYear = &r.MaturesFromYear
		}

		if r.MaturesToYear != 0 {
			out[i].MaturesToYear = &r.MaturesToYear
		}
	}

	return out
}
