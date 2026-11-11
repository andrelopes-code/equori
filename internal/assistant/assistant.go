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
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/secret"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

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
	wait   func(ctx context.Context, until time.Time) error
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

	// assistant_usage days are instance days, in UTC (BK19).
	today := func() time.Time { return clock.DateOf(cfg.Clock.Now(), time.UTC) }

	svc := app.NewService(postgres.NewRepository(pool), box, llmapi.NewModels(build), instance, uses, cfg.Clock.Now, today, log)

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

	return &Module{svc: svc, resolver: llmapi.NewResolver(svc, cfg.Instance, build, log), http: httpapi.NewServer(svc, log), screens: screens, locale: cfg.Locale, wait: wait}, nil
}

func (m *Module) Resolver() llm.Resolver { return m.resolver }

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }
