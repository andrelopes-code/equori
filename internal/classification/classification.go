// Package classification decides categories with rules, payee aliases and payee history (docs/domain, 4.3.2).
// It is the only entry point to the module for the rest of the application.
package classification

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/classification/app"
	"github.com/andrelopes-code/equori/internal/classification/httpapi"
	"github.com/andrelopes-code/equori/internal/classification/postgres"
	"github.com/andrelopes-code/equori/internal/classification/toolapi"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type Module struct {
	http   *httpapi.Server
	svc    *app.Service
	ledger *ledger.Module
}

func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, l *ledger.Module, log *slog.Logger) *Module {
	port := ledgerPort{l}

	svc := app.NewService(postgres.NewRepository(pool), port)
	for _, ledgerType := range []string{ledger.EventTransactionRecorded, ledger.EventTransactionCorrected, ledger.EventTransactionCategorized, ledger.EventTransactionVoided} {
		dispatcher.Subscribe(consumer, ledgerType, port.handle)
	}

	dispatcher.Subscribe(consumer, ledger.EventCategoriesMerged, port.handleMerge)
	dispatcher.Subscribe(consumer, ledger.EventPayeesMerged, port.handlePayeeMerge)
	dispatcher.Subscribe(consumer, ledger.EventTagRenamed, port.handleTagRename)

	return &Module{http: httpapi.NewServer(svc, log), svc: svc, ledger: l}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// Tools returns the classification module's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{Tools: toolapi.Tools(m.svc, m.names, m.ledger.Today), Errors: tool.FromProblem(httpapi.ToProblem)}
}

func (m *Module) names(ctx context.Context, booksID int64) (categories, payees map[uuid.UUID]string, err error) {
	accounts, ps, err := m.ledger.CaptureVocabulary(ctx, booksID)
	if err != nil {
		return nil, nil, err
	}

	categories, payees = make(map[uuid.UUID]string, len(accounts)), make(map[uuid.UUID]string, len(ps))
	for _, a := range accounts {
		categories[a.ID] = a.Name
	}

	for _, p := range ps {
		payees[p.ID] = p.Name
	}

	return categories, payees, nil
}
