// Package llmapi binds the assistant's resolved targets to language model providers.
package llmapi

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/aistudio"
	"github.com/andrelopes-code/equori/internal/platform/llm/openai"
)

// Factory builds the provider of an API at baseURL with key.
type Factory func(api, baseURL, key string) llm.Provider

// NewFactory builds real adapters. Redirects are refused: a request goes only to the
// configured address (N17).
func NewFactory() Factory {
	hc := &http.Client{
		Timeout:       2 * time.Minute,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	return func(api, baseURL, key string) llm.Provider {
		if api == string(domain.APIGemini) {
			return aistudio.New(baseURL, key, hc)
		}
		return openai.New(baseURL, key, hc)
	}
}

func ToUse(u llm.Use) app.Use {
	out := app.Use{ID: u.ID, SendsFinancialData: u.SendsFinancialData}
	for _, n := range u.Needs {
		out.Needs = append(out.Needs, string(n))
	}
	for _, d := range u.Default {
		out.Default = append(out.Default, app.DefaultTarget{Preset: d.Preset, Model: d.Model})
	}
	return out
}

// Resolver implements llm.Resolver over the service.
type Resolver struct {
	svc      *app.Service
	instance map[string]llm.Provider
	build    Factory
	log      *slog.Logger
}

var _ llm.Recorder = (*Resolver)(nil)

func NewResolver(svc *app.Service, instance []llm.Provider, build Factory, log *slog.Logger) *Resolver {
	m := make(map[string]llm.Provider, len(instance))
	for _, p := range instance {
		m[p.Name()] = p
	}
	return &Resolver{svc: svc, instance: m, build: build, log: log}
}

// Record adds an attempt to the user's usage; a call without a user is not recorded, and a
// failed write is logged without failing the call (ADR 019 U1, U2).
func (r *Resolver) Record(ctx context.Context, a llm.Attempt) {
	userID, ok := auth.UserID(ctx)
	if !ok {
		return
	}
	err := r.svc.Record(ctx, userID, app.Attempt{
		ProviderID: a.Target.Provider, Model: a.Target.Model, UseID: a.Use, Outcome: a.Outcome,
		InputTokens: int64(a.Usage.InputTokens), OutputTokens: int64(a.Usage.OutputTokens), CoolingUntil: a.CooldownUntil,
	})
	if err != nil {
		r.log.Warn("llm usage not recorded", "use", a.Use, "provider", a.Target.Provider, "model", a.Target.Model, "error", err)
	}
}

func (r *Resolver) Resolve(ctx context.Context, use llm.Use) ([]llm.Binding, error) {
	userID, hasUser := auth.UserID(ctx)
	targets, err := r.svc.Resolve(ctx, userID, hasUser, ToUse(use))
	if le, ok := errors.AsType[*app.LimitError](err); ok {
		return nil, &llm.ExhaustedError{RetryAt: le.RetryAt}
	}
	if err != nil {
		return nil, err
	}
	out := make([]llm.Binding, 0, len(targets))
	for _, t := range targets {
		p := r.instance[t.ProviderID]
		if !t.Instance {
			p = r.build(string(t.API), t.BaseURL, t.Key)
		}
		out = append(out, llm.Binding{Target: llm.Target{Provider: t.ProviderID, Model: t.Model}, Provider: p})
	}
	return out, nil
}

// Models implements app.ModelLister.
type Models struct{ build Factory }

func NewModels(build Factory) Models { return Models{build: build} }

func (m Models) Models(ctx context.Context, api domain.API, baseURL, key string) ([]string, error) {
	lister, ok := m.build(string(api), baseURL, key).(llm.ModelLister)
	if !ok {
		return nil, fmt.Errorf("list models of %s: %w", api, app.ErrProviderUnavailable)
	}
	ids, err := lister.Models(ctx)
	switch {
	case err == nil:
		return ids, nil
	case ctx.Err() != nil:
		return nil, ctx.Err()
	case errors.Is(err, llm.ErrUnauthorized):
		return nil, fmt.Errorf("%w: %w", app.ErrProviderUnauthorized, err)
	default:
		return nil, fmt.Errorf("%w: %w", app.ErrProviderUnavailable, err)
	}
}
