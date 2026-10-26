package httpapi

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

func toParts(p app.StatementParts, instrument string) StatementParts {
	m := func(v int64) Money { return Money{Amount: v, Currency: instrument} }
	return StatementParts{Purchases: m(p.Purchases), Installments: m(p.Installments), Charges: m(p.Charges), Credits: m(p.Credits), Total: m(p.Total())}
}

func toItem(a app.StatementAnalytics) StatementAnalyticsItem {
	p := toParts(a.StatementParts, a.Instrument)
	return StatementAnalyticsItem{
		StatementId: a.Statement.ID, Reference: a.Statement.Reference.Format("2006-01"),
		Purchases: p.Purchases, Installments: p.Installments, Charges: p.Charges, Credits: p.Credits, Total: p.Total,
	}
}

func (s *Server) GetStatementAnalytics(ctx context.Context, req GetStatementAnalyticsRequestObject) (GetStatementAnalyticsResponseObject, error) {
	a, err := s.svc.StatementAnalytics(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	item := toItem(a)
	out := GetStatementAnalytics200JSONResponse{
		StatementId: item.StatementId, Reference: item.Reference, Purchases: item.Purchases, Installments: item.Installments,
		Charges: item.Charges, Credits: item.Credits, Total: item.Total, Categories: make([]StatementCategoryParts, len(a.Categories)),
	}
	for i, c := range a.Categories {
		p := toParts(c.StatementParts, a.Instrument)
		out.Categories[i] = StatementCategoryParts{
			CategoryId: c.CategoryID, Purchases: p.Purchases, Installments: p.Installments, Charges: p.Charges, Credits: p.Credits, Total: p.Total,
		}
	}
	return out, nil
}

func (s *Server) GetCardStatementAnalytics(ctx context.Context, req GetCardStatementAnalyticsRequestObject) (GetCardStatementAnalyticsResponseObject, error) {
	now := s.clock.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	as, err := s.svc.CardStatementAnalytics(ctx, auth.MustUserID(ctx), req.Id, today)
	if err != nil {
		return nil, err
	}
	out := GetCardStatementAnalytics200JSONResponse{Items: make([]StatementAnalyticsItem, len(as))}
	for i, a := range as {
		out.Items[i] = toItem(a)
	}
	return out, nil
}
