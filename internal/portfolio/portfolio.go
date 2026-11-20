// Package portfolio derives positions, realized results and income events from Ledger
// (docs/domain, 4.3.5). It is the only entry point to the module for the rest of the application.
package portfolio

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/registry"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/platform/view"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
	"github.com/andrelopes-code/equori/internal/portfolio/httpapi"
	"github.com/andrelopes-code/equori/internal/portfolio/jurisdiction/br"
	"github.com/andrelopes-code/equori/internal/portfolio/postgres"
	"github.com/andrelopes-code/equori/internal/portfolio/toolapi"
)

// consumer names the module's outbox subscriptions (ADR 006).
const consumer = "portfolio"

type Module struct {
	http   *httpapi.Server
	svc    *app.Service
	ledger *ledger.Module
}

// Profiles is the part of identity the module uses to pick a book's jurisdiction.
type Profiles interface {
	Profile(ctx context.Context, booksID int64) (locale.Locale, error)
}

func New(
	pool *pgxpool.Pool,
	dispatcher *outbox.Dispatcher,
	l *ledger.Module,
	md *marketdata.Module,
	profiles Profiles,
	log *slog.Logger,
) (*Module, error) {
	byID, err := registry.New[domain.Jurisdiction](
		"jurisdiction",
		registry.Entry[domain.Jurisdiction]{ID: "br", Value: br.New()},
	)
	if err != nil {
		return nil, err
	}

	svc := app.NewService(
		postgres.NewRepository(pool),
		ledgerPort{l, md},
		marketPort{md, profiles},
		jurisdictions{profiles, byID},
	)
	m := &Module{http: httpapi.NewServer(svc, log), svc: svc, ledger: l}
	// P8 amendment A71: categorization never changes a security account.
	for _, t := range []string{ledger.EventTransactionRecorded, ledger.EventTransactionCorrected, ledger.EventTransactionVoided} {
		dispatcher.Subscribe(consumer, t, m.handle)
	}

	return m, nil
}

// Views returns the builders of the views of the module's reads (answer views design, V3).
func (m *Module) Views() map[view.Key]view.Builder { return toolapi.Views() }

// Tools returns the portfolio module's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{
		Tools:  toolapi.Tools(m.svc, m.accountNames, m.ledger.Today),
		Errors: tool.FromProblem(httpapi.ToProblem),
	}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }
