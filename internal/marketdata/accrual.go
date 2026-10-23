package marketdata

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// TickAccrual stores the accrued price of each fixed income security that has terms, for the days
// after its latest accrued price up to today or maturity. A failure is logged by instrument; the
// next tick tries again.
func (m *Module) TickAccrual(ctx context.Context) {
	rows, err := m.q.ListTerms(ctx)
	if err != nil {
		m.logFeed(ctx, err, "source", sourceAccrual)
		return
	}
	for _, row := range rows {
		if err := m.accrue(ctx, row); err != nil {
			m.logFeed(ctx, err, "source", sourceAccrual, "instrument", row.InstrumentCode)
		}
	}
}

func (m *Module) accrue(ctx context.Context, row postgres.MarketdataFixedIncomeTerm) error {
	today := m.feeds.Clock.Today()
	end := today
	if row.MaturesOn.Before(end) {
		end = row.MaturesOn
	}
	code := row.InstrumentCode
	latest, err := m.q.LatestSourceDate(ctx, postgres.LatestSourceDateParams{Source: sourceAccrual, Instrument: &code})
	if err != nil {
		return err
	}
	from := latest.AddDate(0, 0, 1)
	if from.After(end) {
		return nil
	}
	in, err := m.Instrument(ctx, code)
	if err != nil {
		return err
	}
	quote, err := m.Instrument(ctx, string(in.QuoteCurrency))
	if err != nil {
		return err
	}
	var rates []domain.IndexRate
	if row.IndexID != nil {
		stored, err := m.q.ListIndexRates(ctx, postgres.ListIndexRatesParams{IndexID: *row.IndexID, FromDate: row.IssuedOn})
		if err != nil {
			return err
		}
		for _, r := range stored {
			v, err := r.Rate.Value()
			if err != nil {
				return fmt.Errorf("rate of %s: %w", r.Date.Format(time.DateOnly), err)
			}
			rates = append(rates, domain.IndexRate{Date: r.Date, Rate: fmt.Sprint(v)})
		}
	}
	terms := toTerms(row)
	accrued, err := domain.Accrue(terms, quote.Scale, rates, from, today)
	if err != nil {
		return err
	}
	prices := make([]Price, len(accrued))
	for i, a := range accrued {
		value, err := money.ParseRate(trimDecimal(a.Value))
		if err != nil {
			return fmt.Errorf("price of %s on %s: %w", code, a.Date.Format(time.DateOnly), err)
		}
		prices[i] = Price{Instrument: in.Code, Quote: in.QuoteCurrency, Date: a.Date, Value: value, Source: sourceAccrual}
	}
	return m.upsert(ctx, prices)
}

// trimDecimal drops the trailing zeros of a decimal so a large price still fits a Rate.
func trimDecimal(s string) string {
	if !strings.Contains(s, ".") {
		return s
	}
	return strings.TrimSuffix(strings.TrimRight(s, "0"), ".")
}
