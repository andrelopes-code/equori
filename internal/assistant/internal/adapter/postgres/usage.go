package postgres

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

func bit(b bool) int32 {
	if b {
		return 1
	}
	return 0
}

func (r *Repository) AddUsage(ctx context.Context, e domain.UsageEntry) error {
	var until *time.Time
	if !e.CoolingUntil.IsZero() {
		until = &e.CoolingUntil
	}
	return r.q.AddUsage(ctx, AddUsageParams{
		UserID: e.UserID, Day: e.Day, ProviderID: e.ProviderID, Model: e.Model, UseID: e.UseID,
		Errors: bit(e.Failed), QuotaErrors: bit(e.Quota), InputTokens: e.InputTokens, OutputTokens: e.OutputTokens,
		CoolingUntil: until,
	})
}

// UsageSince sums the user's usage per provider and model from since to today, both inclusive.
func (r *Repository) UsageSince(ctx context.Context, userID int64, today, since time.Time) ([]domain.UsageSummary, error) {
	rows, err := r.q.UsageSince(ctx, UsageSinceParams{UserID: userID, Today: today, Since: since})
	if err != nil {
		return nil, err
	}
	out := make([]domain.UsageSummary, len(rows))
	for i, row := range rows {
		out[i] = domain.UsageSummary{
			ProviderID: row.ProviderID, Model: row.Model, TodayRequests: row.TodayRequests, TodayErrors: row.TodayErrors,
			TodayTokens: row.TodayTokens, PeriodRequests: row.PeriodRequests, PeriodTokens: row.PeriodTokens,
			CoolingUntil: row.CoolingUntil.UTC(),
		}
		if out[i].CoolingUntil.IsZero() {
			out[i].CoolingUntil = time.Time{}
		}
	}
	return out, nil
}

func (r *Repository) UsageByDay(ctx context.Context, userID int64, from, to time.Time) ([]domain.UsageDay, error) {
	rows, err := r.q.UsageByDay(ctx, UsageByDayParams{UserID: userID, FromDate: from, ToDate: to})
	if err != nil {
		return nil, err
	}
	out := make([]domain.UsageDay, len(rows))
	for i, row := range rows {
		out[i] = domain.UsageDay{Day: row.Day, ProviderID: row.ProviderID, Model: row.Model, Requests: row.Requests, Errors: row.Errors, Tokens: row.Tokens}
	}
	return out, nil
}

func (r *Repository) Limits(ctx context.Context, userID int64) ([]domain.Limit, error) {
	rows, err := r.q.ListUsageLimits(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Limit, len(rows))
	for i, row := range rows {
		out[i] = domain.Limit{ProviderID: row.ProviderID, Model: row.Model, TokensPerDay: row.TokensPerDay}
		if row.RequestsPerDay != nil {
			n := int64(*row.RequestsPerDay)
			out[i].RequestsPerDay = &n
		}
	}
	return out, nil
}

// SetLimit stores l, or removes the stored limit when l has neither quota.
func (r *Repository) SetLimit(ctx context.Context, userID int64, l domain.Limit) error {
	if l.Cleared() {
		return r.q.DeleteUsageLimit(ctx, DeleteUsageLimitParams{UserID: userID, ProviderID: l.ProviderID, Model: l.Model})
	}
	var requests *int32
	if l.RequestsPerDay != nil {
		n := int32(*l.RequestsPerDay) //nolint:gosec // domain.NewLimit keeps it within int32
		requests = &n
	}
	return r.q.SetUsageLimit(ctx, SetUsageLimitParams{
		UserID: userID, ProviderID: l.ProviderID, Model: l.Model, RequestsPerDay: requests, TokensPerDay: l.TokensPerDay,
	})
}
