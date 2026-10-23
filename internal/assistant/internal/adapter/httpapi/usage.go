package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) ListUsage(ctx context.Context, _ ListUsageRequestObject) (ListUsageResponseObject, error) {
	rows, err := s.svc.Usage(ctx, auth.MustUserID(ctx))
	if err != nil {
		return nil, err
	}
	items := make([]UsageRow, len(rows))
	for i, r := range rows {
		u := r.Usage
		items[i] = UsageRow{
			ProviderId: r.Provider.ID, ProviderName: r.Provider.Name, Preset: r.Provider.Preset, Instance: r.Provider.Instance,
			Model: u.Model, TodayRequests: u.TodayRequests, TodayErrors: u.TodayErrors, TodayTokens: u.TodayTokens,
			PeriodRequests: u.PeriodRequests, PeriodTokens: u.PeriodTokens, PeriodDays: app.UsageDays,
			RequestsPerDay: r.Limit.RequestsPerDay, TokensPerDay: r.Limit.TokensPerDay,
		}
		if !u.CoolingUntil.IsZero() {
			items[i].CoolingUntil = &u.CoolingUntil
		}
	}
	return ListUsage200JSONResponse{Items: items}, nil
}

func (s *Server) SetUsageLimit(ctx context.Context, req SetUsageLimitRequestObject) (SetUsageLimitResponseObject, error) {
	b := req.Body
	if err := s.svc.SetLimit(ctx, auth.MustUserID(ctx), b.ProviderId, b.Model, b.RequestsPerDay, b.TokensPerDay); err != nil {
		return nil, err
	}
	return SetUsageLimit204Response{}, nil
}
