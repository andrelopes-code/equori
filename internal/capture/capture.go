// Package capture reads text the owner writes into transaction drafts (docs/superpowers/specs/2026-10-21-text-capture-design.md).
// It is the only entry point to the module for the rest of the application.
package capture

import (
	"context"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/capture/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/capture/internal/adapter/llmapi"
	"github.com/andrelopes-code/equori/internal/capture/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/capture/internal/app"
	"github.com/andrelopes-code/equori/internal/classification"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type Module struct {
	http *httpapi.Server
}

// Profiles is the part of identity the module uses to read a user's lines by language and region.
type Profiles interface {
	Profile(ctx context.Context, userID int64) (locale.Locale, error)
}

// New wires the module; router is nil when no language model is configured, and category
// suggestions then serve kept answers only (ADR 014 L6).
func New(pool *pgxpool.Pool, l *ledger.Module, c *classification.Module, profiles Profiles, router *llm.Router, clk clock.Clock, log *slog.Logger) *Module {
	var suggester app.Suggester
	if router != nil {
		suggester = llmapi.New(router)
	}
	svc := app.NewService(ledgerPort{l}, classifierPort{c}, postgres.NewRepository(pool), profiles, suggester, clk)
	return &Module{http: httpapi.NewServer(svc, log)}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

type ledgerPort struct{ l *ledger.Module }

func (p ledgerPort) Vocabulary(ctx context.Context, userID int64) ([]app.Account, []app.Payee, error) {
	accounts, payees, err := p.l.CaptureVocabulary(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	outAccounts := make([]app.Account, len(accounts))
	for i, a := range accounts {
		outAccounts[i] = app.Account{
			ID: a.ID, ParentID: a.ParentID, Name: a.Name, Class: a.Class, Kind: a.Kind, SystemRole: a.SystemRole,
			Instrument: a.Instrument, Closed: a.ClosedOn != nil, Institution: a.Institution, CardsLastFour: a.CardsLastFour,
		}
	}
	outPayees := make([]app.Payee, len(payees))
	for i, x := range payees {
		outPayees[i] = app.Payee{ID: x.ID, Name: x.Name}
	}
	return outAccounts, outPayees, nil
}

func (p ledgerPort) BaseCurrency(ctx context.Context, userID int64) (money.Currency, error) {
	return p.l.BaseCurrency(ctx, userID)
}

func (p ledgerPort) Today() time.Time { return p.l.Today() }

type classifierPort struct{ c *classification.Module }

// Decide keeps a category only when the decision is one category; a split or a transfer is
// left to the classification of the recorded transaction (P5 A20).
func (p classifierPort) Decide(ctx context.Context, userID int64, entries []app.Entry) ([]app.Decision, error) {
	lines := make([]classification.ManualLine, len(entries))
	for i, e := range entries {
		lines[i] = classification.ManualLine{AccountID: e.AccountID, Date: e.Date, Amount: e.Amount, Description: e.Description, NamedPayee: e.NamedPayee}
	}
	decisions, err := p.c.DecideManual(ctx, userID, lines)
	if err != nil {
		return nil, err
	}
	out := make([]app.Decision, len(decisions))
	for i, d := range decisions {
		if d == nil {
			continue
		}
		out[i] = app.Decision{PayeeID: d.PayeeID, Tags: slices.Clone(d.AddTags)}
		if len(d.Parts) == 1 && d.TransferTo == uuid.Nil {
			out[i].CategoryID, out[i].Method = d.Parts[0].AccountID, d.Cause.Method
		}
	}
	return out, nil
}
