// Package capture reads text the owner writes into transaction drafts (docs/specs/2026-10-21-text-capture-design.md).
// It is the only entry point to the module for the rest of the application.
package capture

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/capture/app"
	"github.com/andrelopes-code/equori/internal/capture/httpapi"
	"github.com/andrelopes-code/equori/internal/capture/llmapi"
	"github.com/andrelopes-code/equori/internal/capture/postgres"
	"github.com/andrelopes-code/equori/internal/classification"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

type Module struct {
	http *httpapi.Server
}

// Profiles is the part of identity the module uses to read a book's lines by language and region.
type Profiles interface {
	Profile(ctx context.Context, booksID int64) (locale.Locale, error)
}

// SuggestUse is the language model use of category suggestions (ADR 014 L6).
var SuggestUse = llmapi.Use

// New wires the module. Without a resolvable target, category suggestions serve kept answers
// only (ADR 014 L6).
func New(pool *pgxpool.Pool, l *ledger.Module, c *classification.Module, profiles Profiles, router *llm.Router, clk clock.Clock, log *slog.Logger) *Module {
	suggester := llmapi.New(router)
	svc := app.NewService(ledgerPort{l}, classifierPort{c}, postgres.NewRepository(pool), profiles, suggester, clk)

	return &Module{http: httpapi.NewServer(svc, log)}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }
