// Package instance holds the backups, the encrypted copy, the diagnostic file and the version
// notice of the whole instance (docs/specs/2026-10-31-protected-data-design.md).
package instance

import (
	"cmp"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/instance/app"
	"github.com/andrelopes-code/equori/internal/instance/httpapi"
	"github.com/andrelopes-code/equori/internal/instance/postgres"
	"github.com/andrelopes-code/equori/internal/instance/releases"
	platformpostgres "github.com/andrelopes-code/equori/internal/platform/postgres"
)

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

	svc := app.NewService(postgres.NewRepository(pool), postgres.NewCatalog(pool), releases.NewClient(cmp.Or(cfg.ReleaseURL, ReleasesURL)), cfg.Admins, box, cfg.Clock, app.Config{
		BackupDir:    cfg.BackupDir,
		CopyDir:      cfg.CopyDir,
		Dump:         cfg.Dump,
		Schema:       schema,
		Mode:         cfg.Mode,
		Distribution: cfg.Distribution,
		Version:      cfg.Version,
		Environment:  cfg.Environment,
		Log:          cfg.Log,
		Outbox:       cfg.Outbox,
		Connections:  connections(cfg.Connections),
	}, log)

	return &Module{svc: svc, http: httpapi.NewServer(svc, log)}, nil
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }
