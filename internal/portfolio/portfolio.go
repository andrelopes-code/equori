// Package portfolio derives positions, realized results and income events from Ledger
// (docs/domain, 4.3.5). It is the only entry point to the module for the rest of the application.
package portfolio

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
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/registry"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/adapter/toolapi"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/app"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/domain"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/jurisdiction/br"
)

// consumer names the module's outbox subscriptions (ADR 006).
const consumer = "portfolio"

type Module struct {
	http   *httpapi.Server
	svc    *app.Service
	ledger *ledger.Module
}

// Profiles is the part of identity the module uses to pick a user's jurisdiction.
type Profiles interface {
	Profile(ctx context.Context, userID int64) (locale.Locale, error)
}

type jurisdictions struct {
	profiles Profiles
	byID     registry.Registry[domain.Jurisdiction]
}

func (j jurisdictions) For(ctx context.Context, userID int64) (domain.Jurisdiction, error) {
	p, err := j.profiles.Profile(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("read profile: %w", err)
	}
	id, ok := defaultJurisdiction(p.Region)
	if !ok {
		return nil, nil
	}
	return j.byID.Get(id)
}

func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, l *ledger.Module, md *marketdata.Module, profiles Profiles, log *slog.Logger) (*Module, error) {
	byID, err := registry.New[domain.Jurisdiction]("jurisdiction", registry.Entry[domain.Jurisdiction]{ID: "br", Value: br.New()})
	if err != nil {
		return nil, err
	}
	svc := app.NewService(postgres.NewRepository(pool), ledgerPort{l, md}, marketPort{md}, jurisdictions{profiles, byID})
	m := &Module{http: httpapi.NewServer(svc, log), svc: svc, ledger: l}
	// P8 amendment A71: categorization never changes a security account.
	for _, t := range []string{ledger.EventTransactionRecorded, ledger.EventTransactionCorrected, ledger.EventTransactionVoided} {
		dispatcher.Subscribe(consumer, t, m.handle)
	}
	return m, nil
}

// handle runs in the dispatcher's transaction, so the rebuilt rows commit with the delivery.
func (m *Module) handle(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.TransactionEvent
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}
	return m.svc.WithRepository(postgres.NewTxRepository(tx)).HandleTransaction(ctx, e.UserID, payload.AccountIDs)
}

// RebuildAll recomputes every derived row from the ledger (equori portfolio rebuild).
func (m *Module) RebuildAll(ctx context.Context) error { return m.svc.RebuildAll(ctx) }

// RebuildUser recomputes the user's derived rows, after an import of an export archive.
func (m *Module) RebuildUser(ctx context.Context, userID int64) error {
	return m.svc.RebuildUser(ctx, userID)
}

// TrailingReturn is the money-weighted return, in basis points, of the accounts taken as one tree
// over the last 12 months up to today, valued in in, with the whole months the window covers;
// ok is false when there is too little history or no flow (investments design 4.4).
func (m *Module) TrailingReturn(ctx context.Context, userID int64, accountIDs []uuid.UUID, today time.Time, in money.Currency) (bp, months int, ok bool, err error) {
	return m.svc.TrailingReturn(ctx, userID, accountIDs, today, in)
}

// Tools returns the portfolio module's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	return tool.Group{Tools: toolapi.Tools(m.svc, m.accountNames, m.ledger.Today), Errors: tool.FromProblem(httpapi.ToProblem)}
}

func (m *Module) accountNames(ctx context.Context, userID int64) (map[uuid.UUID]string, error) {
	accounts, _, err := m.ledger.CaptureVocabulary(ctx, userID)
	if err != nil {
		return nil, err
	}
	names := make(map[uuid.UUID]string, len(accounts))
	for _, a := range accounts {
		names[a.ID] = a.Name
	}
	return names, nil
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) { m.http.Register(mux) }

type ledgerPort struct {
	l  *ledger.Module
	md *marketdata.Module
}

func (p ledgerPort) AccountFacts(ctx context.Context, userID int64) ([]app.Account, error) {
	facts, err := p.l.AccountFacts(ctx, userID)
	out := make([]app.Account, len(facts))
	for i, a := range facts {
		out[i] = app.Account{ID: a.ID, ParentID: a.ParentID, InstitutionID: a.InstitutionID, Class: a.Class, Kind: a.Kind}
	}
	return out, err
}

func (p ledgerPort) BaseCurrency(ctx context.Context, userID int64) (money.Currency, error) {
	return p.l.BaseCurrency(ctx, userID)
}

func (p ledgerPort) InvestmentFacts(ctx context.Context, userID int64, brokerageID uuid.UUID) (domain.Facts, error) {
	f, err := p.l.InvestmentFacts(ctx, userID, brokerageID)
	if err != nil {
		return domain.Facts{}, err
	}
	out := domain.Facts{Currency: f.Currency}
	for _, s := range f.Securities {
		in, err := p.md.Instrument(ctx, string(s.Instrument))
		if err != nil {
			return domain.Facts{}, err
		}
		out.Securities = append(out.Securities, domain.Security{AccountID: s.AccountID, Instrument: s.Instrument, Type: in.Type, Subtype: in.Subtype, Exchange: in.Exchange})
	}
	for _, x := range f.Postings {
		out.Postings = append(out.Postings, domain.Posting{AccountID: x.AccountID, TransactionID: x.TransactionID, Date: x.Date, Quantity: x.Quantity, Weight: x.Weight})
	}
	for _, x := range f.Trades {
		out.Trades = append(out.Trades, domain.Trade{
			TransactionID: x.TransactionID, AccountID: x.AccountID, Date: x.Date, Side: x.Side,
			Quantity: x.Quantity, Gross: x.Gross, Fees: x.Fees, Taxes: x.Taxes, Cost: x.Cost,
		})
	}
	for _, x := range f.Incomes {
		out.Incomes = append(out.Incomes, domain.Income{TransactionID: x.TransactionID, AccountID: x.AccountID, Date: x.Date, Type: x.Type, Gross: x.Gross, Withheld: x.Withheld})
	}
	return out, nil
}

func (p ledgerPort) ValuedBalance(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, in money.Currency) (money.Money, error) {
	c, err := p.l.ValuedBalance(ctx, userID, accountID, date, in)
	switch {
	case errors.Is(err, ledger.ErrNotFound):
		return money.Money{}, fmt.Errorf("%w: %w", app.ErrNotFound, err)
	case errors.Is(err, ledger.ErrPriceMissing):
		return money.Money{}, fmt.Errorf("%w: %w", app.ErrPriceMissing, err)
	}
	return c.Value, err
}

func (p ledgerPort) FirstPosting(ctx context.Context, userID int64, accountIDs []uuid.UUID) (time.Time, bool, error) {
	first, found, err := p.l.FirstPosting(ctx, userID, accountIDs)
	if errors.Is(err, ledger.ErrNotFound) {
		return time.Time{}, false, fmt.Errorf("%w: %w", app.ErrNotFound, err)
	}
	return first, found, err
}

func (p ledgerPort) Balances(ctx context.Context, userID int64, date time.Time) ([]app.AccountBalance, error) {
	bs, err := p.l.Balances(ctx, userID, date)
	out := make([]app.AccountBalance, len(bs))
	for i, b := range bs {
		out[i] = app.AccountBalance{AccountID: b.AccountID, Amount: b.Amount}
	}
	return out, err
}

func (p ledgerPort) ExternalFlows(ctx context.Context, userID int64, accountIDs []uuid.UUID, from, to time.Time) ([]app.Flow, error) {
	fs, err := p.l.ExternalFlows(ctx, userID, accountIDs, from, to)
	if errors.Is(err, ledger.ErrNotFound) {
		return nil, fmt.Errorf("%w: %w", app.ErrNotFound, err)
	}
	out := make([]app.Flow, len(fs))
	for i, f := range fs {
		out[i] = app.Flow{Date: f.Date, Value: f.Value}
	}
	return out, err
}

type marketPort struct{ md *marketdata.Module }

func (p marketPort) Scale(ctx context.Context, code money.Currency) (int, error) {
	in, err := p.md.Instrument(ctx, string(code))
	return in.Scale, err
}

func (p marketPort) InstrumentOf(ctx context.Context, code money.Currency) (app.InstrumentInfo, error) {
	in, err := p.md.Instrument(ctx, string(code))
	return app.InstrumentInfo{Type: in.Type, QuoteCurrency: in.QuoteCurrency}, err
}

func (p marketPort) Convert(ctx context.Context, q money.Money, to money.Currency, date time.Time) (money.Money, []app.Price, error) {
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
