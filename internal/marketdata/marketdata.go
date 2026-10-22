// Package marketdata owns instruments, prices and business-day calendars (chapter 4, 4.3.6).
package marketdata

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/calendar"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/registry"
)

var (
	ErrUnknownInstrument = domain.ErrUnknownInstrument
	ErrInstrumentExists  = domain.ErrInstrumentExists
	ErrPriceMissing      = domain.ErrPriceMissing
)

type (
	Instrument = domain.Instrument
	Price      = domain.Price
)

type Module struct {
	pool  *pgxpool.Pool
	q     *postgres.Queries
	feeds FeedConfig

	calendars registry.Registry[calendar.Calendar]
}

func New(pool *pgxpool.Pool) *Module {
	calendars, err := registry.New("calendar",
		registry.Entry[calendar.Calendar]{ID: "br_banking", Value: calendar.BRBanking()},
		registry.Entry[calendar.Calendar]{ID: "weekend", Value: calendar.Weekend()},
	)
	if err != nil {
		panic(fmt.Sprintf("marketdata: %v", err)) // the entries are literals; a failure is a programming error
	}
	return &Module{pool: pool, q: postgres.New(pool), calendars: calendars}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux, log *slog.Logger) {
	httpapi.NewServer(m.listHolidays, m.listCalendars, m, log).Register(mux)
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
		out[i] = httpapi.NewHoliday(openapi_types.Date{Time: h.Date}, h.Name, h.Source)
	}
	return out, nil
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
	return toInstrument(row), nil
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
	out := make([]Instrument, len(rows))
	for i, r := range rows {
		out[i] = toInstrument(r)
	}
	return out, nil
}

// DefineInstrument stores a security for the whole instance (P8 amendment A59).
func (m *Module) DefineInstrument(ctx context.Context, in Instrument) (Instrument, error) {
	in, err := in.Validate()
	if err != nil {
		return Instrument{}, err
	}
	quote, err := m.Instrument(ctx, string(in.QuoteCurrency))
	if errors.Is(err, ErrUnknownInstrument) || (err == nil && quote.Type != domain.TypeCurrency) {
		return Instrument{}, &domain.FieldError{Field: "quote_currency", Message: "must be a currency"}
	}
	if err != nil {
		return Instrument{}, err
	}
	quoteCode := string(in.QuoteCurrency)
	n, err := m.q.InsertInstrument(ctx, postgres.InsertInstrumentParams{
		Code: string(in.Code), InstrumentType: in.Type, Scale: int16(in.Scale), //nolint:gosec // G115: Validate bounds the scale to 0–12
		Name: in.Name, QuoteCurrency: &quoteCode, Exchange: optional(in.Exchange),
	})
	if err != nil {
		return Instrument{}, fmt.Errorf("insert instrument: %w", err)
	}
	if n == 0 {
		return Instrument{}, ErrInstrumentExists
	}
	return in, nil
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
	return in
}
