// Package marketdata owns instruments: currencies now, securities and prices later (chapter 4, 4.3.6).
package marketdata

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/httpapi"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
)

var ErrUnknownInstrument = errors.New("unknown instrument")

type Instrument struct {
	Code  string
	Type  string
	Scale int
	Name  string
}

type Module struct {
	q *postgres.Queries
}

func New(pool *pgxpool.Pool) *Module {
	return &Module{q: postgres.New(pool)}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux, log *slog.Logger) {
	httpapi.NewServer(m.listHolidays, log).Register(mux)
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
	rows, err := m.q.ListInstrumentsByType(ctx, "currency")
	if err != nil {
		return nil, err
	}
	out := make([]Instrument, len(rows))
	for i, r := range rows {
		out[i] = toInstrument(r)
	}
	return out, nil
}

func toInstrument(r postgres.MarketdataInstrument) Instrument {
	return Instrument{Code: r.Code, Type: r.InstrumentType, Scale: int(r.Scale), Name: r.Name}
}
