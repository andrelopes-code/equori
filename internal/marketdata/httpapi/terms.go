package httpapi

import (
	"context"
	"net/http"

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

	payments, err := paymentsOf(b)
	if err != nil {
		return FixedIncomeTerms{}, err
	}

	t.Payments = payments

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

// paymentsOf is the payments the body sets: the listed rows, or the expansion of
// interest_every_months (A236 FC6).
func paymentsOf(b PutInstrumentTermsJSONRequestBody) ([]domain.Payment, error) {
	if b.InterestEveryMonths == nil {
		var out []domain.Payment
		if b.Payments != nil {
			for _, p := range *b.Payments {
				out = append(out, domain.Payment{
					PaysOn:         p.PaysOn.Time,
					AmortizationBP: p.AmortizationBp,
					PaysInterest:   p.PaysInterest,
				})
			}
		}

		return out, nil
	}

	if b.Payments != nil {
		return nil, &domain.FieldError{
			Field:   "payments",
			Message: "set payments or interest_every_months",
		}
	}

	if b.FirstPaymentOn == nil {
		return nil, &domain.FieldError{
			Field:   "first_payment_on",
			Message: "is required with interest_every_months",
		}
	}

	return domain.Schedule(b.FirstPaymentOn.Time, b.MaturesOn.Time, int(*b.InterestEveryMonths))
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
