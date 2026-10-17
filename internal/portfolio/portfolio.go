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
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/app"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/domain"
)

// consumer names the module's outbox subscriptions (ADR 006).
const consumer = "portfolio"

type Module struct {
	http *httpapi.Server
	svc  *app.Service
}

func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, l *ledger.Module, md *marketdata.Module, log *slog.Logger) *Module {
	svc := app.NewService(postgres.NewRepository(pool), ledgerPort{l, md}, marketPort{md})
	m := &Module{http: httpapi.NewServer(svc, log), svc: svc}
	// P8 amendment A71: categorization never changes a security account.
	for _, t := range []string{ledger.EventTransactionRecorded, ledger.EventTransactionCorrected, ledger.EventTransactionVoided} {
		dispatcher.Subscribe(consumer, t, m.handle)
	}
	return m
}

// handle runs in the dispatcher's transaction, so the rebuilt rows commit with the delivery.
func (m *Module) handle(ctx context.Context, tx pgx.Tx, e outbox.Delivered) error {
	var payload ledger.TransactionEvent
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return fmt.Errorf("decode %s: %w", e.Type, err)
	}
	return m.svc.WithRepository(postgres.NewTxRepository(tx)).HandleTransaction(ctx, e.UserID, payload.AccountIDs)
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
		out[i] = app.Account{ID: a.ID, ParentID: a.ParentID, Kind: a.Kind}
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
		out.Securities = append(out.Securities, domain.Security{AccountID: s.AccountID, Instrument: s.Instrument, TaxClass: in.Type})
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

type marketPort struct{ md *marketdata.Module }

func (p marketPort) Scale(ctx context.Context, code money.Currency) (int, error) {
	in, err := p.md.Instrument(ctx, string(code))
	return in.Scale, err
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
