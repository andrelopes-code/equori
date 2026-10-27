// Package planning expects money through schedules, occurrences, budgets and goals (docs/domain, 4.3.4).
// It is the only entry point to the module for the rest of the application.
package planning

import (
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/planning/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/planning/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/planning/internal/adapter/toolapi"
	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type Module struct {
	http   *httpapi.Server
	svc    *app.Service
	log    *slog.Logger
	ledger *ledger.Module
	clk    clock.Clock
}

// consumer names the module's outbox subscriptions (ADR 006).
const consumer = "planning"

func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, l *ledger.Module, md *marketdata.Module, profiles Profiles, returns app.Returns, clk clock.Clock, log *slog.Logger) *Module {
	svc := app.NewService(postgres.NewRepository(pool), ledgerPort{l}, calendarPort{md}, profiles, pricesPort{md}, returns, clk)
	m := &Module{http: httpapi.NewServer(svc, log), svc: svc, log: log, ledger: l, clk: clk}
	// P7 amendment A51: every change of a transaction can change the occurrence it realizes.
	for _, t := range []string{ledger.EventTransactionRecorded, ledger.EventTransactionCorrected, ledger.EventTransactionCategorized, ledger.EventTransactionVoided} {
		dispatcher.Subscribe(consumer, t, m.handle)
	}
	dispatcher.Subscribe(consumer, ledger.EventCategoriesMerged, m.handleMerge)
	dispatcher.Subscribe(consumer, ledger.EventPayeesMerged, m.handlePayeeMerge)
	return m
}

// handle runs in the dispatcher's transaction, so the realization commits with the delivery.
func (m *Module) handle(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.TransactionEvent
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}
	return m.svc.WithRepository(postgres.NewTxRepository(tx)).HandleTransaction(ctx, app.TransactionChanged{
		UserID: e.UserID, TransactionID: payload.TransactionID, AccountIDs: payload.AccountIDs,
	})
}

// handleMerge follows a category merge in the dispatcher's transaction (A75).
func (m *Module) handleMerge(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.CategoriesMerged
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}
	return m.svc.WithRepository(postgres.NewTxRepository(tx)).HandleCategoriesMerged(ctx, e.UserID, payload.From, payload.Into)
}

// handlePayeeMerge follows a payee merge in the dispatcher's transaction (A82).
func (m *Module) handlePayeeMerge(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.PayeesMerged
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}
	return m.svc.WithRepository(postgres.NewTxRepository(tx)).HandlePayeesMerged(ctx, e.UserID, payload.From, payload.Into)
}

// Tools returns the planning module's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{Tools: toolapi.Tools(m.svc, toolLedger{m.ledger}, m.clk), Errors: tool.FromProblem(httpapi.ToProblem)}
}

// toolLedger gives the tools the names and instruments of the user's accounts and categories.
type toolLedger struct{ l *ledger.Module }

func (t toolLedger) Accounts(ctx context.Context, userID int64) (map[uuid.UUID]toolapi.Account, error) {
	accounts, _, err := t.l.CaptureVocabulary(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]toolapi.Account, len(accounts))
	for _, a := range accounts {
		out[a.ID] = toolapi.Account{Name: a.Name, Instrument: a.Instrument}
	}
	return out, nil
}

func (t toolLedger) BaseCurrency(ctx context.Context, userID int64) (money.Currency, error) {
	return t.l.BaseCurrency(ctx, userID)
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

// CommittedTotal is the committed amount of month (A57), in the base currency.
func (m *Module) CommittedTotal(ctx context.Context, userID int64, month time.Time) (money.Money, error) {
	c, err := m.svc.Committed(ctx, userID, month)
	if err != nil {
		return money.Money{}, err
	}
	return money.New(c.Total, c.Currency)
}

// Tick extends the occurrences of every schedule to the horizon (P7 amendment A53) and logs
// each failure by schedule id.
func (m *Module) Tick(ctx context.Context) {
	failures, err := m.svc.Tick(ctx)
	if err != nil {
		m.log.ErrorContext(ctx, "planning tick", "error", err)
		return
	}
	for _, f := range failures {
		m.log.ErrorContext(ctx, "extend schedule", "schedule_id", f.Ref.ID, "error", f.Err)
	}
}

// Backfill generates the occurrences every schedule lacks before its first generated one, as
// creation does since P7 amendment A127; a second run changes nothing.
func (m *Module) Backfill(ctx context.Context) error {
	return m.svc.Backfill(ctx)
}

// RunScheduler ticks now and then every interval until ctx ends.
func (m *Module) RunScheduler(ctx context.Context, interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		m.Tick(ctx)
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

type ledgerPort struct{ l *ledger.Module }

func (p ledgerPort) AccountFacts(ctx context.Context, userID int64) ([]app.Account, error) {
	facts, err := p.l.AccountFacts(ctx, userID)
	out := make([]app.Account, len(facts))
	for i, a := range facts {
		out[i] = app.Account{ID: a.ID, ParentID: a.ParentID, Class: a.Class, Kind: a.Kind, Instrument: a.Instrument, Closed: a.ClosedOn != nil}
	}
	return out, err
}

func (p ledgerPort) MissingPayees(ctx context.Context, userID int64, ids []uuid.UUID) ([]uuid.UUID, error) {
	return p.l.MissingPayees(ctx, userID, ids)
}

func (p ledgerPort) BaseCurrency(ctx context.Context, userID int64) (money.Currency, error) {
	return p.l.BaseCurrency(ctx, userID)
}

func (p ledgerPort) AccountTransactionsBetween(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) ([]uuid.UUID, error) {
	return p.l.AccountTransactionsBetween(ctx, userID, accountID, from, to)
}

func (p ledgerPort) TransactionFacts(ctx context.Context, userID int64, ids []uuid.UUID) ([]domain.Transaction, error) {
	facts, err := p.l.TransactionFacts(ctx, userID, ids)
	out := make([]domain.Transaction, len(facts))
	for i, f := range facts {
		t := domain.Transaction{ID: f.ID, Date: f.Date, PayeeID: f.PayeeID, Voided: f.Voided}
		for _, fp := range f.Postings {
			t.Postings = append(t.Postings, domain.Posting{AccountID: fp.AccountID, Amount: fp.Amount.Amount()})
		}
		out[i] = t
	}
	return out, err
}

func (p ledgerPort) CategoryTotal(ctx context.Context, userID int64, categoryID uuid.UUID, from, to time.Time) (int64, error) {
	m, err := p.l.CategoryTotal(ctx, userID, categoryID, from, to)
	return m.Amount(), err
}

func (p ledgerPort) Balance(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time) (money.Money, error) {
	m, err := p.l.Balance(ctx, userID, accountID, date)
	if errors.Is(err, ledger.ErrMixedInstruments) {
		return money.Money{}, fmt.Errorf("%w: %w", app.ErrMixedInstruments, err)
	}
	return m, err
}

func (p ledgerPort) ValuedBalance(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, in money.Currency) (app.Valuation, error) {
	c, err := p.l.ValuedBalance(ctx, userID, accountID, date, in)
	if errors.Is(err, ledger.ErrPriceMissing) {
		return app.Valuation{}, fmt.Errorf("%w: %w", app.ErrPriceMissing, err)
	}
	if err != nil {
		return app.Valuation{}, err
	}
	out := app.Valuation{Value: c.Value, Prices: make([]app.Price, len(c.Prices)), Parts: make([]app.ValuedPart, len(c.Parts))}
	for i, x := range c.Prices {
		out.Prices[i] = app.Price{Instrument: x.Instrument, Quote: x.Quote, Date: x.Date, Value: x.Value, Source: x.Source}
	}
	for i, x := range c.Parts {
		out.Parts[i] = app.ValuedPart{AccountID: accountID, Instrument: x.Instrument, Quantity: x.Quantity, Value: x.Value}
	}
	return out, nil
}

type pricesPort struct{ md *marketdata.Module }

func (p pricesPort) Convert(ctx context.Context, q money.Money, to money.Currency, date time.Time) (money.Money, []app.Price, error) {
	c, err := p.md.Convert(ctx, q, to, date)
	if errors.Is(err, marketdata.ErrPriceMissing) {
		return money.Money{}, nil, fmt.Errorf("%w: %w", app.ErrPriceMissing, err)
	}
	if err != nil {
		return money.Money{}, nil, err
	}
	prices := make([]app.Price, len(c.Prices))
	for i, x := range c.Prices {
		prices[i] = app.Price{Instrument: x.Instrument, Quote: x.Quote, Date: x.Date, Value: x.Value, Source: x.Source}
	}
	return c.Value, prices, nil
}

func (p ledgerPort) Commitment(ctx context.Context, userID int64, cardID uuid.UUID, month time.Time) (int64, error) {
	m, err := p.l.Commitment(ctx, userID, cardID, month)
	return m.Amount(), err
}

func (p ledgerPort) PriorInstallments(ctx context.Context, userID int64, cardID uuid.UUID, month time.Time) (int64, error) {
	m, err := p.l.PriorInstallments(ctx, userID, cardID, month)
	return m.Amount(), err
}

func (p ledgerPort) OwnCategoryMonthlyTotals(ctx context.Context, userID int64, class string, from, to time.Time) (map[uuid.UUID]map[time.Time]int64, error) {
	rows, err := p.l.OwnCategoryMonthlyTotals(ctx, userID, class, from, to)
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]map[time.Time]int64)
	for _, r := range rows {
		if out[r.CategoryID] == nil {
			out[r.CategoryID] = make(map[time.Time]int64)
		}
		out[r.CategoryID][r.Month] = r.Total.Amount()
	}
	return out, nil
}

func (p ledgerPort) FirstPosting(ctx context.Context, userID int64, accountIDs []uuid.UUID) (time.Time, bool, error) {
	return p.l.FirstPosting(ctx, userID, accountIDs)
}

func (p ledgerPort) CategoryMonthlyTotals(ctx context.Context, userID int64, categoryID uuid.UUID, from, to time.Time) (map[time.Time]int64, error) {
	ms, err := p.l.CategoryMonthlyTotals(ctx, userID, categoryID, from, to)
	out := make(map[time.Time]int64, len(ms))
	for m, v := range ms {
		out[m] = v.Amount()
	}
	return out, err
}

// Profiles is the part of identity the module uses to default a schedule's calendar.
type Profiles interface {
	Profile(ctx context.Context, userID int64) (locale.Locale, error)
}

type calendarPort struct{ md *marketdata.Module }

func (c calendarPort) DefaultCalendar(region string) string { return c.md.DefaultCalendar(region) }

func (c calendarPort) Holidays(ctx context.Context, name string, year int) ([]time.Time, error) {
	hs, err := c.md.Holidays(ctx, name, year)
	if errors.Is(err, marketdata.ErrUnknownCalendar) {
		return nil, fmt.Errorf("%w: %w", app.ErrUnknownCalendar, err)
	}
	out := make([]time.Time, len(hs))
	for i, h := range hs {
		out[i] = h.Date
	}
	return out, err
}
