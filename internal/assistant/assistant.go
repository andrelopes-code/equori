// Package assistant stores each user's language model providers and chains, and resolves
// the targets of a use (ADR 019).
package assistant

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/assistant/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/assistant/internal/adapter/llmapi"
	"github.com/andrelopes-code/equori/internal/assistant/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/secret"
)

// ChatUse is the conversational agent's use, consumed by the agent project.
var ChatUse = llm.Use{
	ID:                 "assistant.chat",
	Needs:              []llm.Capability{llm.CapTools},
	SendsFinancialData: true,
	Default: []llm.DefaultTarget{
		{Preset: "gemini", Model: "gemini-3.5-flash"},
		{Preset: "groq", Model: "openai/gpt-oss-120b"},
		{Preset: "mistral", Model: "mistral-small-latest"},
		{Preset: "ollama", Model: "qwen3:32b"},
	},
}

type Config struct {
	SecretKey, PreviousSecretKey string
	// Instance are the providers configured through the environment, shared by every user.
	Instance []llm.Provider
	Uses     []llm.Use
	Clock    clock.Clock
	// NewProvider builds a user's provider; nil builds the real adapters.
	NewProvider func(api, baseURL, key string) llm.Provider
}

type Module struct {
	svc      *app.Service
	resolver *llmapi.Resolver
	http     *httpapi.Server
}

// instancePreset maps an environment provider to its preset; only the Gemini adapter is
// configured through the environment.
func instancePreset(name string) string {
	if name == "aistudio" {
		return "gemini"
	}
	return name
}

func New(pool *pgxpool.Pool, cfg Config, log *slog.Logger) (*Module, error) {
	var box app.Sealer
	if cfg.SecretKey != "" {
		var previous []byte
		if cfg.PreviousSecretKey != "" {
			previous = []byte(cfg.PreviousSecretKey)
		}
		b, err := secret.New([]byte(cfg.SecretKey), previous)
		if err != nil {
			return nil, err
		}
		box = b
	}
	build := llmapi.Factory(cfg.NewProvider)
	if build == nil {
		build = llmapi.NewFactory()
	}
	instance := make([]app.Instance, 0, len(cfg.Instance))
	for _, p := range cfg.Instance {
		instance = append(instance, app.Instance{ID: p.Name(), Preset: instancePreset(p.Name())})
	}
	uses := make([]app.Use, 0, len(cfg.Uses))
	for _, u := range cfg.Uses {
		uses = append(uses, llmapi.ToUse(u))
	}
	svc := app.NewService(postgres.NewRepository(pool), box, llmapi.NewModels(build), instance, uses, cfg.Clock.Now, cfg.Clock.Today, log)
	return &Module{svc: svc, resolver: llmapi.NewResolver(svc, cfg.Instance, build, log), http: httpapi.NewServer(svc, log)}, nil
}

func (m *Module) Resolver() llm.Resolver { return m.resolver }

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// RotateSecrets reseals every stored provider key under the current key (ADR 008 K4).
func (m *Module) RotateSecrets(ctx context.Context) (int, error) { return m.svc.RotateSecrets(ctx) }
