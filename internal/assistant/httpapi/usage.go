package httpapi

import (
	"context"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/assistant/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) listUsage(ctx context.Context, _ *http.Request, _ httpserver.None) (UsageList, error) {
	rows, err := s.svc.Usage(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return UsageList{}, err
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

	return UsageList{Items: items}, nil
}

func (s *Server) listUsageDays(ctx context.Context, r *http.Request, _ httpserver.None) (UsageDayList, error) {
	params, err := httpserver.Query[ListUsageDaysParams](r)
	if err != nil {
		return UsageDayList{}, err
	}

	rows, err := s.svc.UsageByDay(ctx, auth.MustBooksID(ctx), params.From.Time, params.To.Time)
	if err != nil {
		return UsageDayList{}, err
	}

	items := make([]UsageDay, len(rows))
	for i, row := range rows {
		items[i] = UsageDay{
			Day: openapi_types.Date{Time: row.Day}, ProviderId: row.ProviderID, Model: row.Model,
			Requests: row.Requests, Errors: row.Errors, Tokens: row.Tokens,
		}
	}

	return UsageDayList{Items: items}, nil
}

func (s *Server) setUsageLimit(ctx context.Context, _ *http.Request, in SetUsageLimitJSONRequestBody) (httpserver.None, error) {
	if err := s.svc.SetLimit(ctx, auth.MustBooksID(ctx), in.ProviderId, in.Model, in.RequestsPerDay, in.TokensPerDay); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}
