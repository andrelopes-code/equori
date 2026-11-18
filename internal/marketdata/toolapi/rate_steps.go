package toolapi

import (
	"context"
	"fmt"
	"strings"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type rateStepIn struct {
	AfterDays        int `json:"after_days"                   jsonschema:"days held from the issue date"`
	PercentOfIndexBP int `json:"percent_of_index_bp,omitzero" jsonschema:"percent of the index in bp from then, 11000 for 110%"`
	SpreadBP         int `json:"spread_bp,omitzero"           jsonschema:"annual spread, or pre-fixed rate, in bp from then"`
}

type rateStepsRule string

func (rateStepsRule) Values() []string {
	return []string{domain.StepsRetroactive, domain.StepsStepped}
}

type setRateStepsIn struct {
	Code  string        `json:"code"           jsonschema:"code of a fixed income instrument with terms"`
	Steps []rateStepIn  `json:"steps"          jsonschema:"every step in order of after_days; empty to keep one rate"`
	Apply rateStepsRule `json:"apply,omitzero" jsonschema:"with steps: retroactive (the reached rate from the issue) or stepped (each rate from its day)"`
}

type setRateStepsOut struct {
	Terms termsView `json:"terms"`
}

// setRateSteps writes the rate_steps of putInstrumentTerms, which manage_instrument set_terms
// leaves out for its size (progressive rate design PR1, PR2; coverage row F-05).
func setRateSteps(svc Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "set_rate_steps",
		Description: "Proposes the rates a fixed income instrument takes as it is held longer, such as a CDB progressivo " +
			"that pays 100% of the CDI, then 105% after 180 days; the other terms stay. The issuer states whether a " +
			"step pays from the issue date (retroactive) or from its own day (stepped). " +
			"Use it after set_terms when the rate rises with the time held. " +
			"Do not use it for a rate that never changes: set_terms holds it. The user confirms first.",
		Effect: tool.Write,
		Role:   auth.RoleWrite,
	}, func(ctx context.Context, _ int64, in setRateStepsIn) (tool.Preview, error) {
		old, t, err := steppedTerms(ctx, svc, in)
		if err != nil {
			return tool.Preview{}, err
		}

		return tool.Preview{Action: "set_rate_steps", Changes: []tool.Change{{
			Field:  "terms",
			Before: tool.TextValue(stepsText(old)),
			After:  tool.TextValue(stepsText(t)),
		}}}, nil
	}, func(ctx context.Context, _ int64, in setRateStepsIn) (setRateStepsOut, error) {
		_, t, err := steppedTerms(ctx, svc, in)
		if err != nil {
			return setRateStepsOut{}, err
		}

		inst, err := svc.Instrument(ctx, in.Code)
		if err != nil {
			return setRateStepsOut{}, err
		}

		if t, err = svc.PutTerms(ctx, in.Code, t); err != nil {
			return setRateStepsOut{}, err
		}

		v, err := toTermsView(t, inst.QuoteCurrency)

		return setRateStepsOut{Terms: v}, err
	})
}

// steppedTerms reads the stored terms and returns them with the steps of the call in place of
// theirs; the terms check the order and the rule.
func steppedTerms(
	ctx context.Context,
	svc Service,
	in setRateStepsIn,
) (domain.Terms, domain.Terms, error) {
	old, err := svc.Terms(ctx, in.Code)
	if err != nil {
		return domain.Terms{}, domain.Terms{}, err
	}

	t := old
	t.RateSteps, t.RateStepsApply = nil, string(in.Apply)

	for _, s := range in.Steps {
		t.RateSteps = append(t.RateSteps, domain.RateStep(s))
	}

	if err := domain.CheckRateSteps(t.RateSteps, t.RateStepsApply); err != nil {
		return domain.Terms{}, domain.Terms{}, err
	}

	return old, t, nil
}

// stepsText states the steps of t, such as "retroactive: 105.00% of the index after 180 days".
func stepsText(t domain.Terms) string {
	if len(t.RateSteps) == 0 {
		return "one rate"
	}

	parts := make([]string, len(t.RateSteps))
	for i, s := range t.RateSteps {
		rate := fmt.Sprintf("%d.%02d%% a year", s.SpreadBP/100, s.SpreadBP%100)
		if t.IndexID != "" {
			rate = fmt.Sprintf(
				"%d.%02d%% of %s",
				s.PercentOfIndexBP/100,
				s.PercentOfIndexBP%100,
				t.IndexID,
			)
			if s.SpreadBP != 0 {
				rate += fmt.Sprintf(" + %d.%02d%%", s.SpreadBP/100, s.SpreadBP%100)
			}
		}

		parts[i] = fmt.Sprintf("%s after %d days", rate, s.AfterDays)
	}

	return t.RateStepsApply + ": " + strings.Join(parts, ", ")
}
