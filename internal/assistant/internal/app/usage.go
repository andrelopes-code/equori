package app

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

// UsageDays is the number of days the period figures sum, today included.
const UsageDays = 30

// UsageRepository holds the day counters and the declared limits (ADR 019 U2, U4).
type UsageRepository interface {
	AddUsage(ctx context.Context, e domain.UsageEntry) error
	UsageSince(ctx context.Context, userID int64, today, since time.Time) ([]domain.UsageSummary, error)
	Limits(ctx context.Context, userID int64) ([]domain.Limit, error)
	SetLimit(ctx context.Context, userID int64, l domain.Limit) error
}

// Attempt mirrors llm.Attempt (ADR 009 M1).
type Attempt struct {
	ProviderID, Model, UseID, Outcome string
	InputTokens, OutputTokens         int64
	CoolingUntil                      time.Time
}

// Record adds one attempt to the user's counters of the day.
func (s *Service) Record(ctx context.Context, userID int64, a Attempt) error {
	return s.repo.AddUsage(ctx, domain.UsageEntry{
		UserID: userID, Day: s.today(), ProviderID: a.ProviderID, Model: a.Model, UseID: a.UseID,
		Failed: a.Outcome != "ok", Quota: a.Outcome == "quota",
		InputTokens: a.InputTokens, OutputTokens: a.OutputTokens, CoolingUntil: a.CoolingUntil,
	})
}

// UsageRow is one provider and model with its usage, its declared limit and its cooldown.
type UsageRow struct {
	Provider ProviderView
	Usage    domain.UsageSummary
	Limit    domain.Limit
}

// Usage returns every provider and model with usage in the period or a declared limit, in
// the order of the user's providers. A cooldown already over is left out.
func (s *Service) Usage(ctx context.Context, userID int64) ([]UsageRow, error) {
	providers, err := s.Providers(ctx, userID)
	if err != nil {
		return nil, err
	}
	today := s.today()
	summaries, err := s.repo.UsageSince(ctx, userID, today, today.AddDate(0, 0, 1-UsageDays))
	if err != nil {
		return nil, err
	}
	limits, err := s.repo.Limits(ctx, userID)
	if err != nil {
		return nil, err
	}
	type key struct{ provider, model string }
	rows := map[key]*UsageRow{}
	var order []key
	row := func(provider, model string) *UsageRow {
		k := key{provider, model}
		if r, ok := rows[k]; ok {
			return r
		}
		rows[k] = &UsageRow{Usage: domain.UsageSummary{ProviderID: provider, Model: model}, Limit: domain.Limit{ProviderID: provider, Model: model}}
		order = append(order, k)
		return rows[k]
	}
	now := s.now()
	for _, u := range summaries {
		if !u.CoolingUntil.After(now) {
			u.CoolingUntil = time.Time{}
		}
		row(u.ProviderID, u.Model).Usage = u
	}
	for _, l := range limits {
		row(l.ProviderID, l.Model).Limit = l
	}
	rank := func(id string) int {
		i := slices.IndexFunc(providers, func(p ProviderView) bool { return p.ID == id })
		if i < 0 {
			return len(providers)
		}
		return i
	}
	slices.SortStableFunc(order, func(a, b key) int {
		if d := rank(a.provider) - rank(b.provider); d != 0 {
			return d
		}
		if a.model < b.model {
			return -1
		}
		if a.model > b.model {
			return 1
		}
		return 0
	})
	out := make([]UsageRow, 0, len(order))
	for _, k := range order {
		i := rank(k.provider)
		if i == len(providers) {
			continue // a provider deleted between the reads
		}
		r := rows[k]
		r.Provider = providers[i]
		out = append(out, *r)
	}
	return out, nil
}

// SetLimit declares the daily limits of one of the user's providers, or an instance
// provider, for a model; nil for both removes them.
func (s *Service) SetLimit(ctx context.Context, userID int64, providerID, model string, requests, tokens *int64) error {
	l, err := domain.NewLimit(providerID, model, requests, tokens)
	if err != nil {
		return err
	}
	if !slices.ContainsFunc(s.instance, func(in Instance) bool { return in.ID == providerID }) {
		id, err := uuid.Parse(providerID)
		if err != nil {
			return domain.ErrProviderNotFound
		}
		if _, err := s.repo.Provider(ctx, userID, id); err != nil {
			return err
		}
	}
	return s.repo.SetLimit(ctx, userID, l)
}
