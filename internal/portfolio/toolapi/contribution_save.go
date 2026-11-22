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
	AccountID  string `json:"account_id,omitzero" jsonschema:"account from list_accounts counted whole in the class, such as a reserve; instead of instrument"`
	Instrument string `json:"instrument,omitzero" jsonschema:"security code such as BOVA11, counted in every Brokerage holding it; instead of account_id"`
	TargetBP   int    `json:"target_bp,omitzero"  jsonschema:"share of the class in basis points; all members add up to 10000, or none has a target"`
	Answers    []bool `json:"answers,omitzero"    jsonschema:"per question of the group, true for yes"`
}

type contributionRuleIn struct {
	InstrumentType  string            `json:"instrument_type,omitzero"   jsonschema:"security type, such as fixed_income or stock"`
	Subtypes        []string          `json:"subtypes,omitzero"          jsonschema:"subtypes of instrument_type, such as cdb or lci"`
	QuoteCurrency   string            `json:"quote_currency,omitzero"    jsonschema:"currency the security is quoted in, such as USD"`
	ReturnKind      string            `json:"return_kind,omitzero"       jsonschema:"rate, inflation or fixed"`
	MaturesFromYear int               `json:"matures_from_year,omitzero" jsonschema:"first maturity year"`
	MaturesToYear   int               `json:"matures_to_year,omitzero"   jsonschema:"last maturity year"`
	DailyLiquidity  tool.OptionalBool `json:"daily_liquidity,omitzero"   jsonschema:"redeemable any business day near its accrued value"`
	Guarantee       string            `json:"guarantee,omitzero"         jsonschema:"covered, sovereign or uncovered"`
}

type contributionClassIn struct {
	Name     string                 `json:"name"      jsonschema:"name of the class, 1 to 60 characters, unique in the plan"`
	TargetBP int                    `json:"target_bp" jsonschema:"share of the portfolio in basis points: 4000 is 40%; the classes add up to 10000"`
	Members  []contributionMemberIn `json:"members"   jsonschema:"what the class holds; a holding belongs to at most one class"`

	Questions     []string             `json:"questions,omitzero"      jsonschema:"the investor's yes-or-no questions, at most 10 of 1 to 200 characters; with them, members carry answers and no target_bp"`
	QuestionFacts []string             `json:"question_facts,omitzero" jsonschema:"fact key per question, empty for none: piotroski_p1 to piotroski_p9"`
	Rules         []contributionRuleIn `json:"rules,omitzero"          jsonschema:"conditions of a group by rule, at most 5, instead of members: a security bought later that meets one joins it"`
}

type saveContributionPlanIn struct {
	Amount  string                `json:"amount,omitzero" jsonschema:"monthly contribution as a positive decimal in the base currency; absent stores none"`
	Classes []contributionClassIn `json:"classes"         jsonschema:"every class, at most 20; the call replaces the whole plan, so repeat each class that stays; an empty list removes it"`
}

func saveContributionPlan(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "save_contribution_plan",
		Description: "Proposes the contribution plan of the book: the classes of the portfolio, the target share of each, the holdings of each class and the monthly amount. " +
			"It replaces the whole plan: read the current one with get_portfolio view contribution and repeat what stays. " +
			"Use it when the user defines or changes the target split or the monthly contribution. " +
			"Do not use it to see where one contribution goes: get_portfolio view contribution with amount does, and stores nothing. " +
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
				Answers:    m.Answers,
			}
			if targeted {
				members[j].TargetBP = &m.TargetBP
			}
		}

		out[i] = domain.PlanClass{
			Name:          c.Name,
			TargetBP:      c.TargetBP,
			Questions:     c.Questions,
			QuestionFacts: c.QuestionFacts,
			Members:       members,
			Rules:         contributionPlanRules(c.Rules),
		}
	}

	return out, nil
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
