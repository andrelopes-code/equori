// Package identity manages members and sessions (ADR 003). It is the only entry
// point to the module for the rest of the application.
package identity

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/identity/httpapi"
	"github.com/andrelopes-code/equori/internal/identity/password"
	"github.com/andrelopes-code/equori/internal/identity/postgres"
	"github.com/andrelopes-code/equori/internal/identity/toolapi"
	"github.com/andrelopes-code/equori/internal/platform/secret"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type Module struct {
	svc  *app.Service
	http *httpapi.Server
}

func New(pool *pgxpool.Pool, cfg Config, log *slog.Logger) (*Module, error) {
	now := cfg.Now
	if now == nil {
		now = time.Now
	}

	svc := app.NewService(
		postgres.NewRepository(pool),
		now,
		DefaultTimeZone,
		password.Cost(cfg.PasswordCost),
	)
	svc.UseSetupHooks(app.SetupHooks{DefaultCurrency: cfg.DefaultCurrency, Done: cfg.SetupDone})

	if cfg.SecretKey != "" {
		var previous []byte
		if cfg.PreviousSecretKey != "" {
			previous = []byte(cfg.PreviousSecretKey)
		}

		box, err := secret.New([]byte(cfg.SecretKey), previous)
		if err != nil {
			return nil, err
		}

		svc.UseSealer(box)
	}

	return &Module{svc: svc, http: httpapi.NewServer(svc, cfg.SecureCookies, log)}, nil
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// Tools returns the identity module's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{Tools: toolapi.Tools(m.svc), Errors: tool.FromProblem(httpapi.ToProblem)}
}
