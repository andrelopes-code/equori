package httpapi

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

func (s *Server) GetIndicators(ctx context.Context, req GetIndicatorsRequestObject) (GetIndicatorsResponseObject, error) {
	month, err := time.Parse("2006-01", req.Params.Month)
	if err != nil {
		return nil, app.ErrInvalidMonth
	}
	now := s.clock.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	report, err := s.svc.Indicators(ctx, auth.MustUserID(ctx), month, today)
	if err != nil {
		return nil, err
	}
	money := func(v int64) Money { return Money{Amount: v, Currency: report.Currency} }
	out := GetIndicators200JSONResponse{Currency: report.Currency, Months: make([]IndicatorMonth, len(report.Months))}
	for i, m := range report.Months {
		out.Months[i] = IndicatorMonth{
			Month: m.Month.Format("2006-01"), Income: money(m.Income), Expense: money(m.Expense),
			Committed: money(m.Committed), DebtService: money(m.DebtService), LiquidBalance: money(m.Liquid),
			Liabilities: money(m.Liabilities), SavingsRate: toRatio(m.SavingsRate),
			TrailingSavingsRate: toRatio(m.TrailingSavingsRate), Liquidity: toRatio(m.Liquidity),
			CommittedShare: toRatio(m.CommittedShare), DebtServiceShare: toRatio(m.DebtServiceShare),
		}
		if m.HasMeans {
			income, expense := money(m.MeanIncome), money(m.MeanExpense)
			out.Months[i].MeanIncome, out.Months[i].MeanExpense = &income, &expense
		}
	}
	return out, nil
}

func toRatio(r app.Ratio) IndicatorRatio {
	if r.Reason != "" {
		reason := IndicatorRatioReason(r.Reason)
		return IndicatorRatio{Reason: &reason}
	}
	bp := r.BP
	return IndicatorRatio{Bp: &bp}
}
