// Package ledger records accounts, transactions and balances (docs/domain, chapters 5 and 7).
// It is the only entry point to the module for the rest of the application.
package ledger

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/httpapi"
	"github.com/andrelopes-code/equori/internal/ledger/postgres"
	"github.com/andrelopes-code/equori/internal/ledger/toolapi"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type Module struct {
	http *httpapi.Server
	svc  *app.Service
}

func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, md MarketData, profiles Profiles, clk clock.Clock, log *slog.Logger) *Module {
	ins := &instruments{md: md, cache: map[money.Currency]app.Instrument{}}
	svc := app.NewService(postgres.NewRepository(pool, ins), clk, calendarAdapter{md}, ins, pricesAdapter{md}, profiles, regionDefaults{})

	dispatcher.Subscribe("ledger-provisioning", "identity.books_created.v1", provision)
	// A139: a change on a card may close a reported statement's difference; the bank sends the
	// bill once, so the ledger settles again after every change rather than at the next bill.
	for _, event := range []string{app.EventTransactionRecorded, app.EventTransactionCorrected, app.EventTransactionVoided} {
		dispatcher.Subscribe("ledger-statement-settlement", event, settleCards(svc))
	}

	return &Module{http: httpapi.NewServer(svc, log), svc: svc}
}

// Tools returns the ledger's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{Tools: toolapi.Tools(m.svc), Errors: tool.FromProblem(httpapi.ToProblem)}
}

// Today is the date of the ledger's clock (A81 previews read it).
func (m *Module) Today(ctx context.Context) time.Time { return m.svc.Today(ctx) }

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// BodyLimits raises the request body limit of attachment uploads: 10 MiB of content
// plus the multipart framing (N26).
func (m *Module) BodyLimits() []httpserver.BodyLimit {
	return []httpserver.BodyLimit{{Pattern: "POST /api/v1/transactions/{id}/attachments", Bytes: 11 << 20}}
}
