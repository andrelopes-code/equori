// Package marketdata owns instruments, prices and business-day calendars (chapter 4, 4.3.6).
package marketdata

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"net/http"
	"slices"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/toolapi"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/calendar"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/registry"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

var (
	ErrUnknownInstrument = domain.ErrUnknownInstrument
	ErrInstrumentExists  = domain.ErrInstrumentExists
	ErrPriceMissing      = domain.ErrPriceMissing
	ErrNoTerms           = domain.ErrNoTerms
	ErrUnknownIndex      = domain.ErrUnknownIndex
	ErrNoSource          = domain.ErrNoSource
)

// sourceAccrual is the source of the prices computed from the terms of a fixed income security.
const sourceAccrual = domain.SourceAccrual

type (
	Instrument   = domain.Instrument
	Price        = domain.Price
	IndexSummary = domain.IndexSummary
	IndexRate    = domain.IndexRate
)

type Module struct {
	pool  *pgxpool.Pool
	q     *postgres.Queries
	feeds FeedConfig

	profiles Profiles
	admins   Admins

	calendars registry.Registry[calendar.Calendar]

	// businessDays are the indexes that compound by business day, computed once in New.
	businessDays domain.BusinessDayIndexes

	// unofficial are the price sources ranked last (A222 MQ2), computed once in New.
	unofficial domain.UnofficialSources

	// running is set while a tick runs, scheduled or requested (ADR 025 F7); a requested tick
	// joins refreshes and stops with life.
	running   atomic.Bool
	refreshes sync.WaitGroup
	// kick wakes RunFeeds for a requested tick; again is set by a request while a tick may run
	// without it (A222 MQ10).
	kick   chan struct{}
	again  atomic.Bool
	life   context.Context
	stop   context.CancelFunc
	runsMu sync.Mutex
	runs   map[string]feedRun
}

// Profiles gives the language and region of a book (identity).
type Profiles interface {
	Profile(ctx context.Context, booksID int64) (locale.Locale, error)
}

// WithProfiles sets where the region of the calling book comes from; the composition root calls it once.
func (m *Module) WithProfiles(p Profiles) *Module {
	m.profiles = p
	return m
}

func New(pool *pgxpool.Pool) *Module {
	calendars, err := registry.New("calendar",
		registry.Entry[calendar.Calendar]{ID: "br_banking", Value: calendar.BRBanking()},
		registry.Entry[calendar.Calendar]{ID: "weekend", Value: calendar.Weekend()},
	)
	if err != nil {
		panic(fmt.Sprintf("marketdata: %v", err)) // the entries are literals; a failure is a programming error
	}

	return &Module{
		pool: pool, q: postgres.New(pool), calendars: calendars, businessDays: businessDayIndexes(),
		unofficial: unofficialSources(), kick: make(chan struct{}, 1),
	}
}

// Tools returns the marketdata module's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	cals := toolapi.Calendars{
		List: func() []toolapi.Calendar {
			var out []toolapi.Calendar
			for _, c := range m.listCalendars() {
				weekend := make([]string, len(c.Weekend))
				for i, d := range c.Weekend {
					weekend[i] = string(d)
				}

				out = append(out, toolapi.Calendar{ID: c.Id, Weekend: weekend})
			}

			return out
		},
		Holidays: func(ctx context.Context, calendar string, year int) ([]toolapi.Holiday, error) {
			hs, err := m.listHolidays(ctx, calendar, year)

			out := make([]toolapi.Holiday, len(hs))
			for i, h := range hs {
				out[i] = toolapi.Holiday{Date: h.Date.Time, Name: h.Name, Source: string(h.Source)}
			}

			return out, err
		},
	}

	return tool.Group{Tools: toolapi.Tools(m, cals), Errors: tool.FromProblem(httpapi.ToProblem)}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux, log *slog.Logger) {
	httpapi.NewServer(m.listHolidays, m.calendarList, m, log).Register(mux)
}

func (m *Module) listHolidays(ctx context.Context, calendar string, year int) ([]httpapi.Holiday, error) {
	hs, err := m.Holidays(ctx, calendar, year)
	if errors.Is(err, ErrUnknownCalendar) {
		return nil, httpapi.ErrNotFound
	}

	if err != nil {
		return nil, err
	}

	out := make([]httpapi.Holiday, len(hs))
	for i, h := range hs {
		out[i] = httpapi.NewHoliday(openapi_types.Date{Time: h.Date}, h.Code, h.Name, h.Source)
	}

	return out, nil
}

func (m *Module) calendarList(ctx context.Context) (httpapi.CalendarList, error) {
	l, err := m.profiles.Profile(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return httpapi.CalendarList{}, fmt.Errorf("read profile: %w", err)
	}

	return httpapi.CalendarList{Items: m.listCalendars(), Default: m.DefaultCalendar(l.Region)}, nil
}

func (m *Module) listCalendars() []httpapi.Calendar {
	ids := m.calendars.IDs()

	out := make([]httpapi.Calendar, len(ids))
	for i, id := range ids {
		cal, _ := m.calendars.Get(id)

		weekend := make([]httpapi.CalendarWeekend, len(cal.Weekend))
		for j, wd := range cal.Weekend {
			weekend[j] = httpapi.CalendarWeekend(strings.ToLower(wd.String()))
		}

		out[i] = httpapi.Calendar{Id: id, Weekend: weekend}
	}

	return out
}

func (m *Module) Instrument(ctx context.Context, code string) (Instrument, error) {
	row, err := m.q.GetInstrument(ctx, code)
	if errors.Is(err, pgx.ErrNoRows) {
		return Instrument{}, ErrUnknownInstrument
	}

	if err != nil {
		return Instrument{}, err
	}

	symbols, err := m.symbolsByInstrument(ctx)
	if err != nil {
		return Instrument{}, err
	}

	in := toInstrument(row)
	in.Symbols = symbols[row.Code]

	return in, nil
}

func (m *Module) Currencies(ctx context.Context) ([]Instrument, error) {
	return m.ListInstruments(ctx, domain.TypeCurrency)
}

// ListInstruments returns the instruments of type typ, or all of them for "".
func (m *Module) ListInstruments(ctx context.Context, typ string) ([]Instrument, error) {
	var rows []postgres.MarketdataInstrument

	var err error
	if typ == "" {
		rows, err = m.q.ListInstruments(ctx)
	} else {
		rows, err = m.q.ListInstrumentsByType(ctx, typ)
	}

	if err != nil {
		return nil, err
	}

	symbols, err := m.symbolsByInstrument(ctx)
	if err != nil {
		return nil, err
	}

	out := make([]Instrument, len(rows))
	for i, r := range rows {
		out[i] = toInstrument(r)
		out[i].Symbols = symbols[r.Code]
	}

	return out, nil
}

// DefineInstrument stores a security for the whole instance (P8 amendment A59).
func (m *Module) DefineInstrument(ctx context.Context, in Instrument) (Instrument, error) {
	in, err := in.Validate()
	if err != nil {
		return Instrument{}, err
	}

	if err := m.checkSymbolSources(in.Symbols); err != nil {
		return Instrument{}, err
	}

	quote, err := m.Instrument(ctx, string(in.QuoteCurrency))
	if errors.Is(err, ErrUnknownInstrument) || (err == nil && quote.Type != domain.TypeCurrency) {
		return Instrument{}, &domain.FieldError{Field: "quote_currency", Message: "must be a currency"}
	}

	if err != nil {
		return Instrument{}, err
	}

	if err := m.insertInstrument(ctx, in); err != nil {
		return Instrument{}, err
	}

	m.requestDefaultHistory(ctx, in)

	return in, nil
}

// EditInstrument replaces the name, exchange and subtype of a security; the other fields are
// immutable (A59, A134). symbols nil keeps the stored symbols; an empty map clears them (plan 2 D19).
func (m *Module) EditInstrument(
	ctx context.Context, code, name, exchange, subtype string, symbols map[string]string,
) (Instrument, error) {
	in, err := m.Instrument(ctx, code)
	if err != nil {
		return Instrument{}, err
	}

	if in.Type == domain.TypeCurrency {
		return Instrument{}, &domain.FieldError{Field: "code", Message: "is a currency"}
	}

	oldExchange, oldSymbols := in.Exchange, in.Symbols

	in.Name, in.Exchange, in.Subtype = name, exchange, subtype
	if symbols != nil {
		in.Symbols = symbols
	}

	if in, err = in.Validate(); err != nil {
		return Instrument{}, err
	}

	if err := m.checkSymbolSources(symbols); err != nil {
		return Instrument{}, err
	}

	if err := m.updateInstrument(ctx, in, symbols != nil); err != nil {
		return Instrument{}, err
	}

	if in.Exchange != oldExchange || (symbols != nil && !maps.Equal(symbols, oldSymbols)) {
		m.requestDefaultHistory(ctx, in)
	}

	return in, nil
}

// insertInstrument stores the instrument and its symbols in one transaction.
func (m *Module) insertInstrument(ctx context.Context, in Instrument) error {
	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return err
	}

	defer func() { _ = tx.Rollback(ctx) }()

	q := m.q.WithTx(tx)
	quoteCode := string(in.QuoteCurrency)

	n, err := q.InsertInstrument(ctx, postgres.InsertInstrumentParams{
		Code: string(in.Code), InstrumentType: in.Type, Scale: int16(in.Scale), //nolint:gosec // G115: Validate bounds the scale to 0–12
		Name: in.Name, QuoteCurrency: &quoteCode, Exchange: optional(in.Exchange), Subtype: optional(in.Subtype),
	})
	if err != nil {
		return fmt.Errorf("insert instrument: %w", err)
	}

	if n == 0 {
		return ErrInstrumentExists
	}

	if err := storeSymbols(ctx, q, in.Code, in.Symbols); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// updateInstrument replaces the name, exchange and subtype, and the symbols when replaceSymbols is
// set, in one transaction.
func (m *Module) updateInstrument(ctx context.Context, in Instrument, replaceSymbols bool) error {
	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return err
	}

	defer func() { _ = tx.Rollback(ctx) }()

	q := m.q.WithTx(tx)

	n, err := q.UpdateInstrument(ctx, postgres.UpdateInstrumentParams{
		Code: string(in.Code), Name: in.Name, Exchange: optional(in.Exchange), Subtype: optional(in.Subtype),
	})
	if err != nil {
		return fmt.Errorf("update instrument: %w", err)
	}

	if n == 0 {
		return ErrUnknownInstrument
	}

	if replaceSymbols {
		if err := storeSymbols(ctx, q, in.Code, in.Symbols); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// storeSymbols replaces the symbols of code with symbols, inserted in key order.
func storeSymbols(ctx context.Context, q *postgres.Queries, code money.Currency, symbols map[string]string) error {
	if err := q.DeleteInstrumentSymbols(ctx, string(code)); err != nil {
		return fmt.Errorf("delete instrument symbols: %w", err)
	}

	for _, source := range slices.Sorted(maps.Keys(symbols)) {
		err := q.InsertInstrumentSymbol(ctx, postgres.InsertInstrumentSymbolParams{
			Instrument: string(code), Source: source, Symbol: symbols[source],
		})
		if err != nil {
			return fmt.Errorf("insert instrument symbol: %w", err)
		}
	}

	return nil
}

// checkSymbolSources accepts a key only when a registered source of that ID reads a symbol.
func (m *Module) checkSymbolSources(symbols map[string]string) error {
	for _, key := range slices.Sorted(maps.Keys(symbols)) {
		reads := slices.ContainsFunc(m.feeds.Sources, func(src feed.Source) bool {
			_, ok := src.(feed.SymbolOverride)
			return ok && src.ID() == key
		})
		if !reads {
			return &domain.FieldError{Field: "symbols." + key, Message: "is not a source that reads a symbol"}
		}
	}

	return nil
}

// symbolsByInstrument returns the symbols of every instrument: instrument code, then source ID.
func (m *Module) symbolsByInstrument(ctx context.Context) (map[string]map[string]string, error) {
	rows, err := m.q.ListInstrumentSymbols(ctx)
	if err != nil {
		return nil, fmt.Errorf("list instrument symbols: %w", err)
	}

	out := make(map[string]map[string]string)

	for _, r := range rows {
		if out[r.Instrument] == nil {
			out[r.Instrument] = make(map[string]string)
		}

		out[r.Instrument][r.Source] = r.Symbol
	}

	return out, nil
}

func optional(s string) *string {
	if s == "" {
		return nil
	}

	return &s
}

func toInstrument(r postgres.MarketdataInstrument) Instrument {
	in := Instrument{Code: money.Currency(r.Code), Type: r.InstrumentType, Scale: int(r.Scale), Name: r.Name}
	if r.QuoteCurrency != nil {
		in.QuoteCurrency = money.Currency(*r.QuoteCurrency)
	}

	if r.Exchange != nil {
		in.Exchange = *r.Exchange
	}

	if r.Subtype != nil {
		in.Subtype = *r.Subtype
	}

	return in
}
