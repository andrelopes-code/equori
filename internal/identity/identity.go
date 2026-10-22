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
	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/locale"
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
}

type Module struct {
	svc  *app.Service
	http *httpapi.Server
}

func New(pool *pgxpool.Pool, cfg Config, log *slog.Logger) *Module {
	svc := app.NewService(postgres.NewRepository(pool), time.Now)
	return &Module{svc: svc, http: httpapi.NewServer(svc, cfg.SecureCookies, log)}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// Profile returns the language and region of a user.
func (m *Module) Profile(ctx context.Context, userID int64) (locale.Locale, error) {
	return m.svc.Profile(ctx, userID)
}

// RequireSession must wrap the whole HTTP handler: it is the single authentication gate for /api/.
func (m *Module) RequireSession(next http.Handler) http.Handler { return m.http.RequireSession(next) }

func (m *Module) CreateUser(ctx context.Context, email, password, role string) (User, error) {
	u, err := m.svc.CreateUser(ctx, email, password, domain.Role(role), locale.Locale{Language: "pt", Region: "BR"})
	if err != nil {
		return User{}, err
	}
	return User{ID: u.ID, Email: u.Email, Role: string(u.Role)}, nil
}
