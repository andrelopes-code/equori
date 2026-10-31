// Package identity manages members and sessions (ADR 003). It is the only entry
// point to the module for the rest of the application.
package identity

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/identity/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/identity/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/identity/internal/adapter/toolapi"
	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/secret"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

const (
	RoleAdmin  = string(domain.RoleAdmin)
	RoleMember = string(domain.RoleMember)
)

var (
	ErrEmailTaken = app.ErrEmailTaken
	// ErrUnknownEmail is returned by ResetSecondFactor when no member has the email.
	ErrUnknownEmail = app.ErrNotFound
	// ErrInvalidAccessToken is a malformed, unknown, expired or deleted access token.
	ErrInvalidAccessToken = app.ErrInvalidAccessToken
)

// AccessGrant is what a valid personal access token allows: one member's tools in one book under a scope (design 2026-10-26 X12).
type AccessGrant struct {
	TokenID  uuid.UUID
	MemberID int64
	BooksID  int64
	Scope    string
	// Role is the member's role in the book at this verification (HA16).
	Role auth.BookRole
}

type Member struct {
	ID    int64
	Email string
	Role  string
}

type Config struct {
	SecureCookies bool
	// DefaultCurrency is the base currency of a region (ADR 016); SetupDone runs after the
	// first member setup (W-U5).
	DefaultCurrency func(region string) (money.Currency, bool)
	SetupDone       func()
	// SecretKey and PreviousSecretKey seal TOTP secrets (ADR 008); empty disables TOTP.
	SecretKey, PreviousSecretKey string
	// Now is the clock of sessions and second factors; nil is time.Now.
	Now func() time.Time
}

type Module struct {
	svc  *app.Service
	http *httpapi.Server
}

func New(pool *pgxpool.Pool, cfg Config, log *slog.Logger) (*Module, error) {
	now := cfg.Now
	if now == nil {
		now = time.Now
	}

	svc := app.NewService(postgres.NewRepository(pool), now, DefaultTimeZone)
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

// RotateSecrets reseals every TOTP secret under the current key (ADR 008).
func (m *Module) RotateSecrets(ctx context.Context) (int, error) { return m.svc.RotateSecrets(ctx) }

// UseUpdateCheck sets the function that stores the update check consent given at setup.
func (m *Module) UseUpdateCheck(f func(ctx context.Context, consent bool) error) {
	m.svc.UseUpdateCheck(f)
}

// StartSetup returns the token of the first member setup while no member exists, and "" afterwards.
func (m *Module) StartSetup(ctx context.Context) (string, error) { return m.svc.StartSetup(ctx) }

// Profile returns the language and region of the books; the member is the context's, or 0 without one.
func (m *Module) Profile(ctx context.Context, booksID int64) (locale.Locale, error) {
	memberID, _ := auth.MemberID(ctx)

	return m.svc.Profile(ctx, booksID, memberID)
}

// InBooks returns ctx with booksID as the active book and the book's location (BK19, BK20).
func (m *Module) InBooks(ctx context.Context, booksID int64) (context.Context, error) {
	loc, err := m.svc.Location(ctx, booksID)
	if err != nil {
		return nil, err
	}

	return clock.WithLocation(auth.WithBooksID(ctx, booksID), loc), nil
}

// Location returns the book's time_zone, or DefaultTimeZone of its region while null.
func (m *Module) Location(ctx context.Context, booksID int64) (*time.Location, error) {
	return m.svc.Location(ctx, booksID)
}

// IsAdmin reports whether a member has the role admin.
func (m *Module) IsAdmin(ctx context.Context, memberID int64) (bool, error) {
	return m.svc.IsAdmin(ctx, memberID)
}

// Tools returns the identity module's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{Tools: toolapi.Tools(m.svc), Errors: tool.FromProblem(httpapi.ToProblem)}
}

// Authorize must wrap the whole HTTP handler: it is the single authorization point for /api/ (HA9).
// required returns the x-book-role of the operation r matches, and whether r matches one.
func (m *Module) Authorize(next http.Handler, required func(*http.Request) (role string, matched bool)) http.Handler {
	return m.http.Authorize(next, required)
}

// VerifyAccessToken returns the grant of a valid personal access token, or ErrInvalidAccessToken.
func (m *Module) VerifyAccessToken(ctx context.Context, token string) (AccessGrant, error) {
	t, err := m.svc.VerifyAccessToken(ctx, token)
	if err != nil {
		return AccessGrant{}, err
	}

	return AccessGrant{TokenID: t.ID, MemberID: t.MemberID, BooksID: t.BooksID, Scope: t.Scope, Role: auth.BookRole(t.Role)}, nil
}

func (m *Module) CreateMember(ctx context.Context, email, password, role string, l locale.Locale, baseCurrency money.Currency) (Member, error) {
	u, err := m.svc.CreateMember(ctx, email, password, domain.Role(role), l, baseCurrency)
	if err != nil {
		return Member{}, err
	}

	return Member{ID: u.ID, Email: u.Email, Role: string(u.Role)}, nil
}

// ResetSecondFactor deletes the second factor, pending logins and sessions of the member with email (HA49).
func (m *Module) ResetSecondFactor(ctx context.Context, email string) (memberID int64, err error) {
	return m.svc.ResetSecondFactor(ctx, email)
}
