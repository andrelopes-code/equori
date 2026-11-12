package marketdata

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
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
	today := m.feeds.Clock.Today(ctx)

	end := today
	if row.MaturesOn.Before(end) {
		end = row.MaturesOn
	}

	code := row.InstrumentCode

	latest, err := m.q.LatestSourceDate(
		ctx,
		postgres.LatestSourceDateParams{Source: sourceAccrual, Instrument: &code},
	)
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

	rates, err := m.accrualRates(ctx, row)
	if err != nil {
		return err
	}

	terms := toTerms(row)

	accrued, err := domain.Accrue(terms, m.businessDays, quote.Scale, rates, from, today)
	if err != nil {
		return err
	}

	prices, err := accrualPrices(in, accrued)
	if err != nil {
		return err
	}

	return m.upsert(ctx, prices)
}

// accrualRates reads the stored rates of the index of row since its issue date.
func (m *Module) accrualRates(
	ctx context.Context,
	row postgres.MarketdataFixedIncomeTerm,
) ([]domain.IndexRate, error) {
	var rates []domain.IndexRate
	if row.IndexID != nil {
		stored, err := m.q.ListIndexRates(
			ctx,
			postgres.ListIndexRatesParams{IndexID: *row.IndexID, FromDate: row.IssuedOn},
		)
		if err != nil {
			return nil, err
		}

		for _, r := range stored {
			v, err := r.Rate.Value()
			if err != nil {
				return nil, fmt.Errorf("rate of %s: %w", r.Date.Format(time.DateOnly), err)
			}

			rates = append(rates, domain.IndexRate{Date: r.Date, Rate: fmt.Sprint(v)})
		}
	}

	return rates, nil
}

// accrualPrices converts the accrued prices of in to stored prices.
func accrualPrices(in Instrument, accrued []domain.DatedPrice) ([]Price, error) {
	prices := make([]Price, len(accrued))
	for i, a := range accrued {
		value, err := money.ParseRate(trimDecimal(a.Value))
		if err != nil {
			return nil, fmt.Errorf(
				"price of %s on %s: %w",
				in.Code,
				a.Date.Format(time.DateOnly),
				err,
			)
		}

		prices[i] = Price{
			Instrument: in.Code,
			Quote:      in.QuoteCurrency,
			Date:       a.Date,
			Value:      value,
			Source:     sourceAccrual,
		}
	}

	return prices, nil
}

// trimDecimal drops the trailing zeros of a decimal so a large price still fits a Rate.
func trimDecimal(s string) string {
	if !strings.Contains(s, ".") {
		return s
	}

	return strings.TrimSuffix(strings.TrimRight(s, "0"), ".")
}
