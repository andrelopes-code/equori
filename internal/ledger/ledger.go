// Package ledger records accounts, transactions and balances (docs/domain, chapters 5 and 7).
// It is the only entry point to the module for the rest of the application.
package ledger

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/httpapi"
	"github.com/andrelopes-code/equori/internal/ledger/postgres"
	"github.com/andrelopes-code/equori/internal/ledger/toolapi"
	"github.com/andrelopes-code/equori/internal/ledger/viewapi"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/platform/view"
)

type Module struct {
	http  *httpapi.Server
	svc   *app.Service
	files toolapi.ConversationFile
}

// UseConversationFiles sets how a tool reads a file the member attached to the conversation
// (assistant parity design, F7).
func (m *Module) UseConversationFiles(files toolapi.ConversationFile) { m.files = files }

func New(
	pool *pgxpool.Pool,
	dispatcher *outbox.Dispatcher,
	md MarketData,
	profiles Profiles,
	clk clock.Clock,
	log *slog.Logger,
) *Module {
	ins := &instruments{md: md, cache: map[money.Currency]app.Instrument{}}
	svc := app.NewService(
		postgres.NewRepository(pool, ins),
		clk,
		calendarAdapter{md},
		ins,
		pricesAdapter{md},
		profiles,
		regionDefaults{},
		contracts{md, ins},
	)

	dispatcher.Subscribe("ledger-provisioning", "identity.books_created.v1", provision)
	// A139: a change on a card may close a reported statement's difference; the bank sends the
	// bill once, so the ledger settles again after every change rather than at the next bill.
	for _, event := range []string{app.EventTransactionRecorded, app.EventTransactionCorrected, app.EventTransactionVoided} {
		dispatcher.Subscribe("ledger-statement-settlement", event, settleCards(svc))
	}

	return &Module{http: httpapi.NewServer(svc, log), svc: svc}
}

// Views returns the builders of the views of the module's reads (answer views design, V3).
func (m *Module) Views() map[view.Key]view.Builder { return viewapi.Views() }

// Tools returns the ledger's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{
		Tools:  toolapi.Tools(m.svc, m.conversationFile),
		Errors: tool.FromProblem(httpapi.ToProblem),
	}
}

// conversationFile reads the file through the reader the server set; none set finds no file.
func (m *Module) conversationFile(
	ctx context.Context,
	booksID, memberID int64,
	id uuid.UUID,
) (string, []byte, bool, error) {
	if m.files == nil {
		return "", nil, false, nil
	}

	return m.files(ctx, booksID, memberID, id)
}

// Today is the date of the ledger's clock (A81 previews read it).
func (m *Module) Today(ctx context.Context) time.Time { return m.svc.Today(ctx) }

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// BodyLimits raises the request body limit of attachment uploads: 10 MiB of content
// plus the multipart framing (N26).
func (m *Module) BodyLimits() []httpserver.BodyLimit {
	return []httpserver.BodyLimit{
		{Pattern: "POST /api/v1/transactions/{id}/attachments", Bytes: 11 << 20},
	}
}
