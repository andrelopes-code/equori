package app

import (
	"context"
	"errors"
	"time"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

// Target is one resolved model of one provider. Key is the opened key; it lives only in
// memory (N16).
type Target struct {
	ProviderID   string
	ProviderName string
	Preset       string
	API          domain.API
	BaseURL      string
	Key          string
	Instance     bool
	Model        string
	Capabilities []string
}

// Resolve returns the ordered targets of use for a user (ADR 019 D7): the user's chain,
// else the use's defaults matched against the user's providers and then the instance
// providers. Targets lacking a needed capability and providers whose key does not open are
// left out. Without a user, only instance providers are matched.
func (s *Service) Resolve(ctx context.Context, userID int64, hasUser bool, use Use) ([]Target, error) {
	targets, err := s.candidates(ctx, userID, hasUser, use)
	if err != nil || !hasUser || len(targets) == 0 {
		return targets, err
	}
	b, err := s.budget(ctx, userID)
	if err != nil {
		return nil, err
	}
	var kept []Target
	var retry time.Time
	usable := false
	now := s.now()
	for _, t := range targets {
		until := b.cooling(t, now)
		if !until.IsZero() && (retry.IsZero() || until.Before(retry)) {
			retry = until
		}
		if b.over(t) {
			continue
		}
		kept = append(kept, t)
		usable = usable || until.IsZero()
	}
	if usable {
		return kept, nil
	}
	if retry.IsZero() {
		retry = s.today().AddDate(0, 0, 1)
	}
	return nil, &LimitError{RetryAt: retry}
}

func (s *Service) candidates(ctx context.Context, userID int64, hasUser bool, use Use) ([]Target, error) {
	var providers []domain.Provider
	var chain []domain.ChainTarget
	if hasUser {
		var err error
		if providers, err = s.repo.Providers(ctx, userID); err != nil {
			return nil, err
		}
		chains, err := s.repo.Chains(ctx, userID)
		if err != nil {
			return nil, err
		}
		chain = chains[use.ID]
	}
	byID := map[string]domain.Provider{}
	for _, p := range providers {
		byID[p.ID.String()] = p
	}
	var out []Target
	add := func(t Target) {
		if len(domain.Missing(use.Needs, t.Capabilities)) == 0 {
			out = append(out, t)
		}
	}
	if len(chain) > 0 {
		for _, c := range chain {
			p, ok := byID[c.ProviderID.String()]
			if !ok {
				continue
			}
			if t, ok := s.target(p, c.Model, c.Capabilities); ok {
				add(t)
			}
		}
		return out, nil
	}
	for _, d := range use.Default {
		caps := domain.ModelCapabilities(d.Preset, d.Model, nil)
		for _, p := range providers {
			if p.Preset != d.Preset {
				continue
			}
			if t, ok := s.target(p, d.Model, caps); ok {
				add(t)
			}
		}
		for _, in := range s.instance {
			if in.Preset == d.Preset {
				add(Target{ProviderID: in.ID, ProviderName: in.ID, Preset: in.Preset, Instance: true, Model: d.Model, Capabilities: caps})
			}
		}
	}
	return out, nil
}

// target opens p's key; a key that does not open leaves the provider out and is logged.
func (s *Service) target(p domain.Provider, model string, asserted []string) (Target, bool) {
	key, err := s.open(p)
	if err != nil {
		s.log.Warn("assistant provider skipped", "provider", p.ID, "reason", "key does not open")
		return Target{}, false
	}
	preset, _ := domain.FindPreset(p.Preset)
	return Target{
		ProviderID: p.ID.String(), ProviderName: p.Name, Preset: p.Preset, API: preset.API, BaseURL: p.BaseURL, Key: key,
		Model: model, Capabilities: domain.ModelCapabilities(p.Preset, model, asserted),
	}, true
}

// ErrLimitReached reports that no target of a use can be called now.
var ErrLimitReached = errors.New("every target is over its daily limit or cooling down")

// LimitError carries the instant the first target becomes available again.
type LimitError struct{ RetryAt time.Time }

func (e *LimitError) Error() string        { return ErrLimitReached.Error() }
func (e *LimitError) Is(target error) bool { return target == ErrLimitReached }

type targetKey struct{ provider, model string }

// budget holds a user's declared limits and today's usage per provider and model.
type budget struct {
	limits map[targetKey]domain.Limit
	usage  map[targetKey]domain.UsageSummary
}

func (s *Service) budget(ctx context.Context, userID int64) (budget, error) {
	today := s.today()
	rows, err := s.repo.UsageSince(ctx, userID, today, today)
	if err != nil {
		return budget{}, err
	}
	limits, err := s.repo.Limits(ctx, userID)
	if err != nil {
		return budget{}, err
	}
	b := budget{limits: map[targetKey]domain.Limit{}, usage: map[targetKey]domain.UsageSummary{}}
	for _, u := range rows {
		b.usage[targetKey{u.ProviderID, u.Model}] = u
	}
	for _, l := range limits {
		b.limits[targetKey{l.ProviderID, l.Model}] = l
	}
	return b, nil
}

func (b budget) over(t Target) bool {
	k := targetKey{t.ProviderID, t.Model}
	l, u := b.limits[k], b.usage[k]
	return l.RequestsPerDay != nil && *l.RequestsPerDay <= u.TodayRequests ||
		l.TokensPerDay != nil && *l.TokensPerDay <= u.TodayTokens
}

// cooling returns the end of the target's cooldown, or the zero time when it is not cooling.
func (b budget) cooling(t Target, now time.Time) time.Time {
	if until := b.usage[targetKey{t.ProviderID, t.Model}].CoolingUntil; until.After(now) {
		return until
	}
	return time.Time{}
}
