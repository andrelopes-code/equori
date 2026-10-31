// Package instance holds the backups, the encrypted copy, the diagnostic file and the version
// notice of the whole instance (docs/specs/2026-10-31-protected-data-design.md).
package instance

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/instance/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/instance/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/instance/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	platformpostgres "github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/secret"
)

type Admins interface {
	IsAdmin(ctx context.Context, memberID int64) (bool, error)
}

type Config struct {
	Mode      string // "managed" or "external"; "" is "external"
	BackupDir string // "" turns automatic backups off (A154.2)
	CopyDir   string // "" is the copy state folder_unset (A155.1)
	Dump      func(ctx context.Context, path string) error
	// Set by internal/server.
	Version                      string
	SecretKey, PreviousSecretKey string
	Clock                        clock.Clock
	Admins                       Admins
}

type Module struct {
	svc  *app.Service
	http *httpapi.Server
}

func New(pool *pgxpool.Pool, cfg Config, log *slog.Logger) (*Module, error) {
	schema, err := platformpostgres.LatestVersion()
	if err != nil {
		return nil, err
	}

	box, err := newSealer(cfg)
	if err != nil {
		return nil, err
	}

	svc := app.NewService(postgres.NewRepository(pool), cfg.Admins, box, cfg.Clock, app.Config{
		BackupDir: cfg.BackupDir,
		CopyDir:   cfg.CopyDir,
		Dump:      cfg.Dump,
		Schema:    schema,
	}, log)

	return &Module{svc: svc, http: httpapi.NewServer(svc, log)}, nil
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// RunBackups writes a periodic backup every 24 hours until ctx ends; it returns at once when
// BackupDir is empty.
func (m *Module) RunBackups(ctx context.Context) { m.svc.RunBackups(ctx) }

// RotateSecrets reseals the copy password under the current key (ADR 008 K4) and returns how
// many values it resealed.
func (m *Module) RotateSecrets(ctx context.Context) (int, error) { return m.svc.RotateSecrets(ctx) }

// newSealer returns a nil interface, not a nil *secret.Box, without a secret key.
func newSealer(cfg Config) (app.Sealer, error) {
	if cfg.SecretKey == "" {
		return nil, nil //nolint:nilnil // no key means no sealer; the service checks for nil.
	}

	var previous []byte
	if cfg.PreviousSecretKey != "" {
		previous = []byte(cfg.PreviousSecretKey)
	}

	return secret.New([]byte(cfg.SecretKey), previous)
}
