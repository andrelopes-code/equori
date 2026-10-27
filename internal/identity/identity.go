// Package identity manages users and sessions (ADR 003). It is the only entry
// point to the module for the rest of the application.
package identity

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/identity/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/identity/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/identity/internal/adapter/toolapi"
	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

const (
	RoleAdmin  = string(domain.RoleAdmin)
	RoleMember = string(domain.RoleMember)
)

var ErrEmailTaken = app.ErrEmailTaken

type User struct {
	ID    int64
	Email string
	Role  string
}

type Config struct {
	SecureCookies bool
	// DefaultCurrency is the base currency of a region (ADR 016); SetupDone runs after the
	// first-user setup (W-U5).
	DefaultCurrency func(region string) (money.Currency, bool)
	SetupDone       func()
}

type Module struct {
	svc  *app.Service
	http *httpapi.Server
}

func New(pool *pgxpool.Pool, cfg Config, log *slog.Logger) *Module {
	svc := app.NewService(postgres.NewRepository(pool), time.Now)
	svc.UseSetupHooks(app.SetupHooks{DefaultCurrency: cfg.DefaultCurrency, Done: cfg.SetupDone})
	return &Module{svc: svc, http: httpapi.NewServer(svc, cfg.SecureCookies, log)}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// StartSetup returns the token of the first-user setup while no user exists, and "" afterwards.
func (m *Module) StartSetup(ctx context.Context) (string, error) { return m.svc.StartSetup(ctx) }

// Profile returns the language and region of a user.
func (m *Module) Profile(ctx context.Context, userID int64) (locale.Locale, error) {
	return m.svc.Profile(ctx, userID)
}

// RequireSession must wrap the whole HTTP handler: it is the single authentication gate for /api/.
// Tools returns the identity module's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{Tools: toolapi.Tools(m.svc), Errors: tool.FromProblem(httpapi.ToProblem)}
}

func (m *Module) RequireSession(next http.Handler) http.Handler { return m.http.RequireSession(next) }

func (m *Module) CreateUser(ctx context.Context, email, password, role string, l locale.Locale, baseCurrency money.Currency) (User, error) {
	u, err := m.svc.CreateUser(ctx, email, password, domain.Role(role), l, baseCurrency)
	if err != nil {
		return User{}, err
	}
	return User{ID: u.ID, Email: u.Email, Role: string(u.Role)}, nil
}
