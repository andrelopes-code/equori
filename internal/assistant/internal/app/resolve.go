package app

import (
	"context"

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
