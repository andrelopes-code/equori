// Package server composes the modules into the HTTP handler and the outbox
// dispatcher. cmd/equori and internal/apitest build the application through it.
package server

import (
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/api"
	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/identity"
	"github.com/andrelopes-code/equori/internal/ingestion"
	"github.com/andrelopes-code/equori/internal/instance"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/planning"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/contract"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio"
	"github.com/andrelopes-code/equori/internal/reporting"
)

// contractValidator parses the embedded contract once per process. The Validator is read-only;
// the test harness builds one App per test, and the parse took 62% of the CPU of
// internal/classification's tests under -race.
var contractValidator = sync.OnceValues(func() (*contract.Validator, error) {
	return contract.New(api.Contract, "/api/v1")
})

type App struct {
	Handler    http.Handler
	Dispatcher *outbox.Dispatcher
	// Tools holds every module's tools for language models (ADR 012).
	Tools     *tool.Registry
	Identity  *identity.Module
	Assistant *assistant.Module
	// LLM routes language model calls of every use (ADR 009).
	LLM        *llm.Router
	Marketdata *marketdata.Module
	Ledger     *ledger.Module
	Reporting  *reporting.Module
	Ingestion  *ingestion.Module
	Instance   *instance.Module
	Planning   *planning.Module
	Portfolio  *portfolio.Module
}

// New registers every module's routes and outbox subscriptions; the caller runs Dispatcher.
func New(pool *pgxpool.Pool, cfg Config, log *slog.Logger) (*App, error) {
	validator, err := contractValidator()
	if err != nil {
		return nil, err
	}

	dispatcher := newDispatcher(pool, log)

	m, err := newModules(pool, cfg, log, dispatcher, newClock(cfg))
	if err != nil {
		return nil, err
	}

	return &App{
		Handler:    newHandler(pool, cfg, log, m, validator),
		Dispatcher: dispatcher,
		Tools:      m.tools,
		Identity:   m.identity,
		Assistant:  m.assistant,
		LLM:        m.router,
		Ledger:     m.ledger,
		Reporting:  m.reporting,
		Ingestion:  m.ingestion,
		Instance:   m.instance,
		Planning:   m.planning,
		Portfolio:  m.portfolio,
		Marketdata: m.marketdata,
	}, nil
}

func newClock(cfg Config) clock.Clock {
	if cfg.Clock != nil {
		return *cfg.Clock
	}

	return clock.New(time.Now)
}
