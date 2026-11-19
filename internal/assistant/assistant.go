// Package assistant stores each book's language model providers and chains, and resolves
// the targets of a use (ADR 019).
package assistant

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/assistant/app"
	"github.com/andrelopes-code/equori/internal/assistant/guide"
	"github.com/andrelopes-code/equori/internal/assistant/httpapi"
	"github.com/andrelopes-code/equori/internal/assistant/llmapi"
	"github.com/andrelopes-code/equori/internal/assistant/postgres"
	"github.com/andrelopes-code/equori/internal/assistant/toolapi"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/secret"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type Module struct {
	svc         *app.Service
	resolver    *llmapi.Resolver
	http        *httpapi.Server
	screens     []guide.Screen
	calculators []toolapi.Calculator

	// The agent needs the chat set and the router, which are built after the module.
	chat         tool.Set
	tools        app.Tools
	baseCurrency toolapi.BaseCurrency
	locale       func(context.Context, int64) (locale.Locale, error)
	router       *llm.Router
	wait         func(ctx context.Context, until time.Time) error
}

func New(pool *pgxpool.Pool, cfg Config, log *slog.Logger) (*Module, error) {
	box, err := newSealer(cfg)
	if err != nil {
		return nil, err
	}

	build := llmapi.Factory(cfg.NewProvider)
	if build == nil {
		build = llmapi.NewFactory()
	}

	instance := instanceProviders(cfg)
	uses := useDeclarations(cfg)

	screens, err := navigationScreens(cfg)
	if err != nil {
		return nil, err
	}

	calculators, err := parseCalculators(cfg)
	if err != nil {
		return nil, err
	}

	// assistant_usage days are instance days, in UTC (BK19).
	today := func() time.Time { return clock.DateOf(cfg.Clock.Now(), time.UTC) }

	svc := app.NewService(
		postgres.NewRepository(pool),
		box,
		llmapi.NewModels(build),
		instance,
		uses,
		cfg.Clock.Now,
		today,
		log,
	)

	return &Module{
		svc:          svc,
		resolver:     llmapi.NewResolver(svc, cfg.Instance, build, log),
		http:         httpapi.NewServer(svc, log),
		screens:      screens,
		calculators:  calculators,
		baseCurrency: cfg.BaseCurrency,
		locale:       cfg.Locale,
		wait:         waitUntil(cfg),
	}, nil
}

func (m *Module) Resolver() llm.Resolver { return m.resolver }

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// BodyLimits raises the request body limit of a conversation file: 10 MiB of content plus the
// multipart framing (assistant parity design, F3).
func (m *Module) BodyLimits() []httpserver.BodyLimit {
	return []httpserver.BodyLimit{
		{Pattern: "POST /api/v1/assistant/files", Bytes: 11 << 20},
		{Pattern: "POST /mcp/files", Bytes: 11 << 20},
	}
}

// FileUpload stores a conversation file for the identity of the request's context: the server
// mounts it on /mcp/files behind the access token (assistant parity design, F11).
func (m *Module) FileUpload() http.Handler { return m.http.FileUpload() }

func newSealer(cfg Config) (app.Sealer, error) {
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

	return box, nil
}

func instanceProviders(cfg Config) []app.Instance {
	instance := make([]app.Instance, 0, len(cfg.Instance))
	for _, p := range cfg.Instance {
		instance = append(instance, app.Instance{ID: p.Name(), Preset: instancePreset(p.Name())})
	}

	return instance
}

func useDeclarations(cfg Config) []app.Use {
	uses := make([]app.Use, 0, len(cfg.Uses))
	for _, u := range cfg.Uses {
		uses = append(uses, llmapi.ToUse(u))
	}

	return uses
}

func navigationScreens(cfg Config) ([]guide.Screen, error) {
	var screens []guide.Screen
	if len(cfg.Navigation) > 0 {
		var err error
		if screens, err = guide.ParseMap(cfg.Navigation); err != nil {
			return nil, err
		}
	}

	return screens, nil
}

func parseCalculators(cfg Config) ([]toolapi.Calculator, error) {
	if len(cfg.Calculators) == 0 {
		return nil, nil
	}

	return toolapi.ParseCalculators(cfg.Calculators)
}

func waitUntil(cfg Config) func(ctx context.Context, until time.Time) error {
	wait := cfg.Wait
	if wait == nil {
		wait = func(ctx context.Context, until time.Time) error {
			timer := time.NewTimer(until.Sub(cfg.Clock.Now()))
			defer timer.Stop()

			select {
			case <-timer.C:
				return nil
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}

	return wait
}
