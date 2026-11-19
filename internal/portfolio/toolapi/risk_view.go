package toolapi

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/portfolio/app"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// riskView is the summary of the risk history (portfolio risk design, S4): no month list.
type riskView struct {
	ValueIn      string                `json:"value_in"`
	From         string                `json:"from,omitzero"`
	To           string                `json:"to,omitzero"`
	Portfolio    riskSeriesView        `json:"portfolio"`
	Classes      []riskSeriesView      `json:"classes"`
	Correlations []riskCorrelationView `json:"correlations"`
}

type riskSeriesView struct {
	Key              string `json:"key,omitzero"`
	VolatilityBP     int    `json:"volatility_bp,omitzero"     jsonschema:"annualized, from the monthly returns of the last 36 months"`
	VolatilityMonths int    `json:"volatility_months,omitzero" jsonschema:"below 36 is a short sample"`
	MaxDrawdownBP    int    `json:"max_drawdown_bp,omitzero"`
	WeightBP         int    `json:"weight_bp,omitzero"`
	RiskShareBP      int    `json:"risk_share_bp,omitzero"     jsonschema:"share of the portfolio variance; above weight_bp swings more than its size"`
	AccrualBP        int    `json:"accrual_bp,omitzero"        jsonschema:"share of the value priced by accrual, near zero volatility by construction"`
	UnknownMonths    int    `json:"unknown_months,omitzero"    jsonschema:"months without a fresh price"`
}

type riskCorrelationView struct {
	A             string `json:"a"`
	B             string `json:"b"`
	CorrelationBP int    `json:"correlation_bp"`
	Months        int    `json:"months"`
}

func riskResult(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in getPortfolioIn,
) (getPortfolioOut, error) {
	r, err := svc.Risk(ctx, booksID, in.To.Time, "")
	if err != nil {
		return getPortfolioOut{}, err
	}

	out := riskView{
		ValueIn:      string(r.Currency),
		Portfolio:    riskSeriesOf(r.Portfolio),
		Classes:      make([]riskSeriesView, len(r.Classes)),
		Correlations: make([]riskCorrelationView, len(r.Correlations)),
	}
	if !r.From.IsZero() {
		out.From, out.To = r.From.Format(time.DateOnly), r.To.Format(time.DateOnly)
	}

	for i, c := range r.Classes {
		out.Classes[i] = riskSeriesOf(c)
	}

	for i, c := range r.Correlations {
		out.Correlations[i] = riskCorrelationView{c.A, c.B, c.CorrelationBP, c.Months}
	}

	return getPortfolioOut{Risk: out}, nil
}

func riskSeriesOf(s app.RiskSeries) riskSeriesView {
	out := riskSeriesView{
		Key:              s.Key,
		VolatilityBP:     valueOf(s.VolatilityBP),
		VolatilityMonths: s.VolatilityMonths,
		MaxDrawdownBP:    valueOf(s.MaxDrawdownBP),
		WeightBP:         valueOf(s.WeightBP),
		RiskShareBP:      valueOf(s.RiskShareBP),
		AccrualBP:        valueOf(s.AccrualBP),
	}

	for _, m := range s.Months {
		if m.State == domain.MonthStale || m.State == domain.MonthMissing {
			out.UnknownMonths++
		}
	}

	return out
}
