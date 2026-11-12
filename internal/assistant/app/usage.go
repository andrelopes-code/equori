package app

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
)

// UsageDays is the number of days the period figures sum, today included.
const UsageDays = 30

// Attempt mirrors llm.Attempt (ADR 009 M1).
type Attempt struct {
	ProviderID, Model, UseID, Outcome string
	InputTokens, OutputTokens         int64
	CoolingUntil                      time.Time
}

// Record adds one attempt to the book's counters of the day.
func (s *Service) Record(ctx context.Context, booksID int64, a Attempt) error {
	// Only a quota cooldown blocks the chat state; a transient one lives in the router (design 2026-10-26 E7).
	var cooling time.Time
	if a.Outcome == "quota" {
		cooling = a.CoolingUntil
	}

	return s.repo.AddUsage(ctx, domain.UsageEntry{
		BooksID: booksID, Day: s.today(), ProviderID: a.ProviderID, Model: a.Model, UseID: a.UseID,
		Failed: a.Outcome != "ok", Quota: a.Outcome == "quota",
		InputTokens: a.InputTokens, OutputTokens: a.OutputTokens, CoolingUntil: cooling,
	})
}

// MaxUsageRangeDays is the longest range UsageByDay answers, both ends included.
const MaxUsageRangeDays = 90

var ErrInvalidUsageRange = errors.New("from must not be after to, and the range must not exceed 90 days")

// UsageByDay returns the book's usage per day, provider and model from from to to, both
// inclusive; a day without use has no row.
func (s *Service) UsageByDay(ctx context.Context, booksID int64, from, to time.Time) ([]domain.UsageDay, error) {
	if to.Before(from) || to.Sub(from) > (MaxUsageRangeDays-1)*24*time.Hour {
		return nil, ErrInvalidUsageRange
	}

	return s.repo.UsageByDay(ctx, booksID, from, to)
}

// UsageRow is one provider and model with its usage, its declared limit and its cooldown.
type UsageRow struct {
	Provider ProviderView
	Usage    domain.UsageSummary
	Limit    domain.Limit
}

// Usage returns every provider and model with usage in the period or a declared limit, in
// the order of the book's providers. A cooldown already over is left out.
func (s *Service) Usage(ctx context.Context, booksID int64) ([]UsageRow, error) {
	providers, err := s.Providers(ctx, booksID)
	if err != nil {
		return nil, err
	}

	today := s.today()

	summaries, err := s.repo.UsageSince(ctx, booksID, today, today.AddDate(0, 0, 1-UsageDays))
	if err != nil {
		return nil, err
	}

	limits, err := s.repo.Limits(ctx, booksID)
	if err != nil {
		return nil, err
	}

	now := s.now()
	table := newUsageTable(summaries, limits, now)

	slices.SortStableFunc(table.order, func(a, b usageKey) int {
		if d := providerRank(providers, a.provider) - providerRank(providers, b.provider); d != 0 {
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

	return table.rowsOf(providers), nil
}

type usageKey struct{ provider, model string }

// usageTable holds the rows of Usage by provider and model, and the order they first appeared in.
type usageTable struct {
	rows  map[usageKey]*UsageRow
	order []usageKey
}

func newUsageTable(summaries []domain.UsageSummary, limits []domain.Limit, now time.Time) *usageTable {
	t := &usageTable{rows: map[usageKey]*UsageRow{}}

	for _, u := range summaries {
		if !u.CoolingUntil.After(now) {
			u.CoolingUntil = time.Time{}
		}

		t.row(u.ProviderID, u.Model).Usage = u
	}

	for _, l := range limits {
		t.row(l.ProviderID, l.Model).Limit = l
	}

	return t
}

func (t *usageTable) row(provider, model string) *UsageRow {
	k := usageKey{provider, model}
	if r, ok := t.rows[k]; ok {
		return r
	}

	t.rows[k] = &UsageRow{
		Usage: domain.UsageSummary{ProviderID: provider, Model: model},
		Limit: domain.Limit{ProviderID: provider, Model: model},
	}
	t.order = append(t.order, k)

	return t.rows[k]
}

func (t *usageTable) rowsOf(providers []ProviderView) []UsageRow {
	out := make([]UsageRow, 0, len(t.order))
	for _, k := range t.order {
		i := providerRank(providers, k.provider)
		if i == len(providers) {
			continue // a provider deleted between the reads
		}

		r := t.rows[k]
		r.Provider = providers[i]
		out = append(out, *r)
	}

	return out
}

func providerRank(providers []ProviderView, id string) int {
	i := slices.IndexFunc(providers, func(p ProviderView) bool { return p.ID == id })
	if i < 0 {
		return len(providers)
	}

	return i
}

// SetLimit declares the daily limits of one of the book's providers, or an instance
// provider, for a model; nil for both removes them.
func (s *Service) SetLimit(ctx context.Context, booksID int64, providerID, model string, requests, tokens *int64) error {
	l, err := domain.NewLimit(providerID, model, requests, tokens)
	if err != nil {
		return err
	}

	if !slices.ContainsFunc(s.instance, func(in Instance) bool { return in.ID == providerID }) {
		id, err := uuid.Parse(providerID)
		if err != nil {
			return domain.ErrProviderNotFound
		}

		if _, err := s.repo.Provider(ctx, booksID, id); err != nil {
			return err
		}
	}

	return s.repo.SetLimit(ctx, booksID, l)
}
