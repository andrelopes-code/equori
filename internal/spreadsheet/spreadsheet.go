// Package spreadsheet stores the spreadsheets of a book (ADR 038).
// It is the only entry point to the module for the rest of the application.
package spreadsheet

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/spreadsheet/app"
	"github.com/andrelopes-code/equori/internal/spreadsheet/domain"
	"github.com/andrelopes-code/equori/internal/spreadsheet/httpapi"
	"github.com/andrelopes-code/equori/internal/spreadsheet/postgres"
)

type Module struct {
	http *httpapi.Server
}

func New(pool *pgxpool.Pool, log *slog.Logger) *Module {
	svc := app.NewService(postgres.NewRepository(pool))

	return &Module{http: httpapi.NewServer(svc, log)}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// BodyLimits raises the request body limit of the writes of a content: the largest content
// plus the name and the JSON framing (spreadsheets design SS4).
func (m *Module) BodyLimits() []httpserver.BodyLimit {
	const bytes = domain.MaxContentBytes + 4<<10

	return []httpserver.BodyLimit{
		{Pattern: "POST " + httpapi.BaseURL + "/spreadsheets", Bytes: bytes},
		{Pattern: "PUT " + httpapi.BaseURL + "/spreadsheets/{id}", Bytes: bytes},
	}
}
