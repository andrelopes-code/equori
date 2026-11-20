package httpapi

import (
	"context"
	"net/http"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

func (s *Server) getRisk(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (RiskReport, error) {
	params, err := httpserver.Query[GetRiskParams](r)
	if err != nil {
		return RiskReport{}, err
	}

	var to time.Time
	if params.To != nil {
		to = params.To.Time
	}

	res, err := s.svc.Risk(ctx, auth.MustBooksID(ctx), to, valueIn(params.ValueIn))
	if err != nil {
		return RiskReport{}, err
	}

	out := RiskReport{
		ValueIn:      string(res.Currency),
		WindowMonths: domain.RiskWindow,
		Portfolio:    toRiskSeries(res.Portfolio),
		Classes:      make([]RiskSeries, len(res.Classes)),
		Correlations: make([]RiskCorrelation, len(res.Correlations)),
		LeftOut:      make([]RiskLeftOut, len(res.LeftOut)),
	}
	if !res.From.IsZero() {
		out.From, out.To = ptr(date(res.From)), ptr(date(res.To))
	}

	for i, c := range res.Classes {
		out.Classes[i] = toRiskSeries(c)
	}

	for i, c := range res.Correlations {
		out.Correlations[i] = RiskCorrelation{
			A:             c.A,
			B:             c.B,
			CorrelationBp: c.CorrelationBP,
			Months:        c.Months,
		}
	}

	for i, l := range res.LeftOut {
		out.LeftOut[i] = RiskLeftOut{
			Instrument: string(l.Instrument),
			Months:     l.Months,
			From:       openapi_types.Date{Time: l.From},
			To:         openapi_types.Date{Time: l.To},
		}
	}

	return out, nil
}

func toRiskSeries(s app.RiskSeries) RiskSeries {
	out := RiskSeries{
		Key:           s.Key,
		Months:        make([]RiskMonth, len(s.Months)),
		VolatilityBp:  s.VolatilityBP,
		MaxDrawdownBp: s.MaxDrawdownBP,
		WeightBp:      s.WeightBP,
		RiskShareBp:   s.RiskShareBP,
		AccrualBp:     s.AccrualBP,
	}
	if s.VolatilityMonths > 0 {
		out.VolatilityMonths = ptr(s.VolatilityMonths)
	}

	for i, m := range s.Months {
		out.Months[i] = toRiskMonth(m)
	}

	return out
}

func toRiskMonth(m domain.MonthRisk) RiskMonth {
	out := RiskMonth{Month: date(m.End), State: RiskMonthState(m.State)}
	if m.Excluded > 0 {
		out.ExcludedBp = ptr(domain.BP(m.Excluded))
	}

	if m.State != domain.MonthKnown {
		return out
	}

	out.ReturnBp, out.SpanMonths = ptr(domain.BP(m.Return)), ptr(m.Span)
	if m.HasDrawdown {
		out.DrawdownBp = ptr(domain.BP(m.Drawdown))
	}

	if m.VolatilityMonths > 0 {
		out.VolatilityBp = ptr(domain.BP(m.Volatility))
		out.VolatilityMonths = ptr(m.VolatilityMonths)
	}

	return out
}

func ptr[T any](v T) *T {
	return &v
}
