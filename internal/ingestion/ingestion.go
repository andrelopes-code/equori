// Package ingestion imports external data into the ledger: files now, aggregators later
// (chapter 4, 4.3.3). It reaches the ledger only through package ledger.
package ingestion

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
)

type Module struct {
	http *httpapi.Server
}

func New(pool *pgxpool.Pool, log *slog.Logger) *Module {
	svc := app.NewService(postgres.NewRepository(pool))
	return &Module{http: httpapi.NewServer(svc, log)}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }
