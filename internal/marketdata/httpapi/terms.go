package httpapi

import (
	"context"
	"net/http"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

const (
	defaultPercentOfIndexBP = 10000
	defaultSpreadBP         = 0
)

func (s *Server) putInstrumentTerms(
	ctx context.Context, r *http.Request, b PutInstrumentTermsJSONRequestBody,
) (FixedIncomeTerms, error) {
	t, err := termsOf(b)
	if err != nil {
		return FixedIncomeTerms{}, err
	}

	if _, err := s.visible(ctx, r.PathValue("code")); err != nil {
		return FixedIncomeTerms{}, err
	}

	out, err := s.svc.PutTerms(ctx, r.PathValue("code"), t)
	if err != nil {
		return FixedIncomeTerms{}, err
	}

	return toTermsAPI(out), nil
}

func (s *Server) getInstrumentTerms(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (FixedIncomeTerms, error) {
	if _, err := s.visible(ctx, r.PathValue("code")); err != nil {
		return FixedIncomeTerms{}, err
	}

	t, err := s.svc.Terms(ctx, r.PathValue("code"))
	if err != nil {
		return FixedIncomeTerms{}, err
	}

	return toTermsAPI(t), nil
}

// termsOf is the terms the body of putInstrumentTerms states, with the defaults of the contract.
func termsOf(b PutInstrumentTermsJSONRequestBody) (domain.Terms, error) {
	t := domain.Terms{
		IssuedOn:         b.IssuedOn.Time,
		MaturesOn:        b.MaturesOn.Time,
		DayCount:         string(b.DayCount),
		FaceValue:        b.FaceValue,
		PercentOfIndexBP: defaultPercentOfIndexBP,
		SpreadBP:         defaultSpreadBP,
	}
	if b.IndexId != nil {
		t.IndexID = *b.IndexId
	}

	if b.PercentOfIndexBp != nil {
		t.PercentOfIndexBP = *b.PercentOfIndexBp
	}

	if b.SpreadBp != nil {
		t.SpreadBP = *b.SpreadBp
	}

	if b.CalendarId != nil {
		t.CalendarID = *b.CalendarId
	}

	if b.DailyLiquidity != nil {
		t.DailyLiquidity = *b.DailyLiquidity
	}

	if b.RedeemableFrom != nil {
		t.RedeemableFrom = b.RedeemableFrom.Time
	}

	t.RateSteps, t.RateStepsApply = rateStepsOf(b)

	payments, err := paymentsOf(b)
	t.Payments = payments

	return t, err
}

// rateStepsOf is the steps and the rule the body sets (progressive rate PR1, PR2).
func rateStepsOf(b PutInstrumentTermsJSONRequestBody) ([]domain.RateStep, string) {
	var steps []domain.RateStep
	if b.RateSteps != nil {
		for _, step := range *b.RateSteps {
			steps = append(steps, domain.RateStep{
				AfterDays:        step.AfterDays,
				PercentOfIndexBP: step.PercentOfIndexBp,
				SpreadBP:         step.SpreadBp,
			})
		}
	}

	if b.RateStepsApply == nil {
		return steps, ""
	}

	return steps, string(*b.RateStepsApply)
}

// paymentsOf is the payments the body sets: the listed rows, or the expansion of
// interest_every_months (A236 FC6).
func paymentsOf(b PutInstrumentTermsJSONRequestBody) ([]domain.Payment, error) {
	var rows []domain.Payment
	if b.Payments != nil {
		for _, p := range *b.Payments {
			rows = append(rows, domain.Payment{
				PaysOn:         p.PaysOn.Time,
				AmortizationBP: p.AmortizationBp,
				PaysInterest:   p.PaysInterest,
			})
		}
	}

	var every int
	if b.InterestEveryMonths != nil {
		every = int(*b.InterestEveryMonths)
	}

	var first time.Time
	if b.FirstPaymentOn != nil {
		first = b.FirstPaymentOn.Time
	}

	return domain.ResolvePayments(rows, every, first, b.MaturesOn.Time)
}

func toTermsAPI(t domain.Terms) FixedIncomeTerms {
	out := FixedIncomeTerms{
		IssuedOn: openapi_types.Date{
			Time: t.IssuedOn,
		},
		MaturesOn:        openapi_types.Date{Time: t.MaturesOn},
		PercentOfIndexBp: t.PercentOfIndexBP,
		SpreadBp:         t.SpreadBP,
		DayCount:         TermsDayCount(t.DayCount),
		FaceValue:        t.FaceValue,
		DailyLiquidity:   t.DailyLiquidity,
		Payments:         make([]FixedIncomePayment, 0, len(t.Payments)),
		RateSteps:        make([]FixedIncomeRateStep, len(t.RateSteps)),
	}
	for i, step := range t.RateSteps {
		out.RateSteps[i] = FixedIncomeRateStep{
			AfterDays:        step.AfterDays,
			PercentOfIndexBp: step.PercentOfIndexBP,
			SpreadBp:         step.SpreadBP,
		}
	}

	if t.RateStepsApply != "" {
		apply := FixedIncomeTermsRateStepsApply(t.RateStepsApply)
		out.RateStepsApply = &apply
	}

	if t.IndexID != "" {
		index := t.IndexID
		out.IndexId = &index
	}

	if t.CalendarID != "" {
		calendar := t.CalendarID
		out.CalendarId = &calendar
	}

	if !t.RedeemableFrom.IsZero() {
		out.RedeemableFrom = &openapi_types.Date{Time: t.RedeemableFrom}
	}

	for _, p := range t.Payments {
		out.Payments = append(out.Payments, FixedIncomePayment{
			PaysOn:         openapi_types.Date{Time: p.PaysOn},
			AmortizationBp: p.AmortizationBP,
			PaysInterest:   p.PaysInterest,
		})
	}

	return out
}
