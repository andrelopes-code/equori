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
	"github.com/andrelopes-code/equori/internal/assistant/internal/adapter/toolapi"
	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/assistant/internal/guide"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/secret"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// ChatUse is the conversational agent's use, consumed by the agent project.
var ChatUse = llm.Use{
	ID:                 "assistant.chat",
	Needs:              []llm.Capability{llm.CapTools},
	SendsFinancialData: true,
	Default: []llm.DefaultTarget{
		{Preset: "gemini", Model: "gemini-3.5-flash-lite"},
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
	// Navigation is web/src/navigation/navigation-map.json (spec 9); empty means no screens.
	Navigation []byte
	// Locale returns a user's language and region for the system prompt.
	Locale func(context.Context, int64) (locale.Locale, error)
	Clock  clock.Clock
	// NewProvider builds a user's provider; nil builds the real adapters.
	NewProvider func(api, baseURL, key string) llm.Provider
}

type Module struct {
	svc      *app.Service
	resolver *llmapi.Resolver
	http     *httpapi.Server
	screens  []guide.Screen

	// The agent needs the chat set and the router, which are built after the module.
	chat   tool.Set
	tools  app.Tools
	locale func(context.Context, int64) (locale.Locale, error)
	router *llm.Router
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
	var screens []guide.Screen
	if len(cfg.Navigation) > 0 {
		var err error
		if screens, err = guide.ParseMap(cfg.Navigation); err != nil {
			return nil, err
		}
	}
	svc := app.NewService(postgres.NewRepository(pool), box, llmapi.NewModels(build), instance, uses, cfg.Clock.Now, cfg.Clock.Today, log)
	return &Module{svc: svc, resolver: llmapi.NewResolver(svc, cfg.Instance, build, log), http: httpapi.NewServer(svc, log), screens: screens, locale: cfg.Locale}, nil
}

// Tools returns the assistant's own tools for language models (ADR 012).
func (m *Module) Tools() tool.Group { return tool.Group{Tools: toolapi.Tools(m.screens)} }

// UseTools sets the chat's tools; it fails when a tool that writes has no preview (spec 8.1).
func (m *Module) UseTools(set tool.Set) error {
	tools, err := llmapi.NewChatSet(set)
	if err != nil {
		return err
	}
	m.svc.UseTools(tools)
	m.chat = set
	m.bindAgent(tools)
	return nil
}

// UseRouter sets the router the chat calls models through.
func (m *Module) UseRouter(r *llm.Router) {
	m.router = r
	m.bindAgent(nil)
}

func (m *Module) bindAgent(tools app.Tools) {
	if tools != nil {
		m.tools = tools
	}
	if m.tools == nil || m.router == nil {
		return
	}
	m.svc.UseAgent(llmapi.NewAgent(m.router.Use(ChatUse), m.svc, m.tools, m.chat), m.locale)
}

func (m *Module) Resolver() llm.Resolver { return m.resolver }

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// RotateSecrets reseals every stored provider key under the current key (ADR 008 K4).
func (m *Module) RotateSecrets(ctx context.Context) (int, error) { return m.svc.RotateSecrets(ctx) }
