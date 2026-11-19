package httpapi

import (
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

func planRules(in *[]ContributionRule) []domain.PlanRule {
	if in == nil {
		return nil
	}

	out := make([]domain.PlanRule, len(*in))
	for i, r := range *in {
		out[i] = domain.PlanRule{
			MaturesFromYear: r.MaturesFromYear,
			MaturesToYear:   r.MaturesToYear,
			DailyLiquidity:  r.DailyLiquidity,
		}

		if r.InstrumentType != nil {
			out[i].InstrumentType = *r.InstrumentType
		}

		if r.Subtypes != nil {
			out[i].Subtypes = *r.Subtypes
		}

		if r.QuoteCurrency != nil {
			out[i].QuoteCurrency = money.Currency(*r.QuoteCurrency)
		}

		if r.ReturnKind != nil {
			out[i].ReturnKind = string(*r.ReturnKind)
		}

		if r.Guarantee != nil {
			out[i].Guarantee = string(*r.Guarantee)
		}
	}

	return out
}

func contributionRules(in []domain.PlanRule) []ContributionRule {
	out := make([]ContributionRule, len(in))
	for i, r := range in {
		out[i] = ContributionRule{
			InstrumentType:  optional(r.InstrumentType),
			QuoteCurrency:   optional(string(r.QuoteCurrency)),
			MaturesFromYear: r.MaturesFromYear,
			MaturesToYear:   r.MaturesToYear,
			DailyLiquidity:  r.DailyLiquidity,
		}

		if r.Subtypes != nil {
			out[i].Subtypes = &r.Subtypes
		}

		if r.ReturnKind != "" {
			kind := ContributionRuleReturnKind(r.ReturnKind)
			out[i].ReturnKind = &kind
		}

		if r.Guarantee != "" {
			guarantee := ContributionRuleGuarantee(r.Guarantee)
			out[i].Guarantee = &guarantee
		}
	}

	return out
}

func contributionMatched(in []app.ContributionMatched) []ContributionMatched {
	out := make([]ContributionMatched, len(in))
	for i, m := range in {
		out[i] = ContributionMatched{
			Instrument: string(m.Instrument),
			Value:      toMoney(m.Value),
			ShareBp:    m.ShareBP,
		}
	}

	return out
}

func outsideReturnKind(kind string) *ContributionOutsideReturnKind {
	if kind == "" {
		return nil
	}

	out := ContributionOutsideReturnKind(kind)

	return &out
}
