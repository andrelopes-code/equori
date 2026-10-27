// Package toolapi declares the marketdata module's tools for language models (ADR 012).
package toolapi

import (
	"context"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Service is the part of the module the tools use.
type Service interface {
	Instrument(ctx context.Context, code string) (domain.Instrument, error)
	ListInstruments(ctx context.Context, typ string) ([]domain.Instrument, error)
	DefineInstrument(ctx context.Context, in domain.Instrument) (domain.Instrument, error)
	RecordPrices(ctx context.Context, ps []domain.Price) error
	ListPrices(ctx context.Context, instrument, quote money.Currency, from, to time.Time) ([]domain.Price, error)
	Terms(ctx context.Context, code string) (domain.Terms, error)
	PutTerms(ctx context.Context, code string, t domain.Terms) (domain.Terms, error)
	Indexes(ctx context.Context) ([]domain.IndexSummary, error)
	IndexRates(ctx context.Context, id string, from, to time.Time) ([]domain.IndexRate, error)
	Expectations(ctx context.Context, id string) (domain.IndexExpectations, error)
}

// Holiday is a non-business day of a calendar.
type Holiday struct {
	Date         time.Time
	Name, Source string
}

// Calendar is a business-day calendar and its weekend days.
type Calendar struct {
	ID      string
	Weekend []string
}

// Calendars lists the calendars and gives the holidays of one in a year.
type Calendars struct {
	List     func() []Calendar
	Holidays func(ctx context.Context, calendar string, year int) ([]Holiday, error)
}

func Tools(svc Service, cals Calendars) []tool.Tool {
	return []tool.Tool{getMarketData(svc, cals), manageInstrument(svc)}
}

// field is an optional input and whether the call gave it.
type field struct {
	name  string
	given bool
}

// required reports a field the view or action needs, and rejects one it does not use.
func required(name string, fields []field, needed ...string) error {
	for _, f := range fields {
		switch {
		case slices.Contains(needed, f.name) && !f.given:
			return tool.InvalidArgument(f.name, "is required for "+name)
		case !slices.Contains(needed, f.name) && f.given:
			return tool.InvalidArgument(f.name, "is not used by "+name)
		}
	}
	return nil
}
