// Package ingestion imports external data into the ledger: files now, aggregators later
// (chapter 4, 4.3.3). It reaches the ledger only through package ledger.

package ingestion

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/classification"
	"github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy"
	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/httpapi"
	"github.com/andrelopes-code/equori/internal/ingestion/llmapi"
	"github.com/andrelopes-code/equori/internal/ingestion/postgres"
	"github.com/andrelopes-code/equori/internal/ingestion/toolapi"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/registry"
	"github.com/andrelopes-code/equori/internal/platform/secret"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type Module struct {
	http   *httpapi.Server
	svc    *app.Service
	ledger *ledger.Module
	log    *slog.Logger
}

func New(
	pool *pgxpool.Pool,
	dispatcher *outbox.Dispatcher,
	l *ledger.Module,
	c *classification.Module,
	cfg Config,
	log *slog.Logger,
) (*Module, error) {
	in := app.Integrations{
		Now:     cfg.Clock.Now,
		Today:   cfg.Clock.Today,
		InBooks: cfg.InBooks,
		Admins:  cfg.Admins,
	}
	if cfg.SecretKey != "" {
		var previous []byte
		if cfg.PreviousSecretKey != "" {
			previous = []byte(cfg.PreviousSecretKey)
		}

		b, err := secret.New([]byte(cfg.SecretKey), previous)
		if err != nil {
			return nil, err
		}

		// A redirect would leave the configured address (N17).
		hc := &http.Client{
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		}

		port, err := pluggy.NewPort(cfg.URLs["pluggy"], hc, cfg.Clock)
		if err != nil {
			return nil, err
		}

		in.Box = b

		in.Aggregators, err = registry.New(
			"aggregator",
			registry.Entry[app.Aggregator]{ID: port.ID(), Value: port},
		)
		if err != nil {
			return nil, err
		}
	}

	if cfg.Router != nil {
		in.Columns = llmapi.New(cfg.Router)
	}

	svc := app.NewService(postgres.NewRepository(pool), ledgerPort{l, c}, in)

	dispatcher.Subscribe("ingestion", ledger.EventTransactionsPaired, followPairing)

	return &Module{http: httpapi.NewServer(svc, log), svc: svc, ledger: l, log: log}, nil
}

// Tools returns the ingestion module's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{
		Tools:  toolapi.Tools(m.svc, m.accountNames),
		Errors: tool.FromProblem(httpapi.ToProblem),
	}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// BodyLimits raises the request body limit of file imports: 10 MiB of content plus the
// multipart framing (P4 amendment A16).
func (m *Module) BodyLimits() []httpserver.BodyLimit {
	return []httpserver.BodyLimit{{Pattern: "POST /api/v1/accounts/{id}/imports", Bytes: 11 << 20}}
}
