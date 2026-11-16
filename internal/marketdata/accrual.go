package marketdata

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/money"
	platformpg "github.com/andrelopes-code/equori/internal/platform/postgres"
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

	accrued, err := m.anchoredSeries(ctx, row, in, today)
	if err != nil {
		return err
	}

	accrued = slices.DeleteFunc(accrued, func(p domain.DatedPrice) bool {
		return p.Date.Before(from)
	})

	prices, err := accrualPrices(in, accrued)
	if err != nil {
		return err
	}

	return m.upsert(ctx, prices)
}

// anchoredSeries is the accrual of in from its issue to today, anchored to the prices that outrank
// it: an anchor before the first day to store still scales the days after it (HR1).
func (m *Module) anchoredSeries(
	ctx context.Context,
	row postgres.MarketdataFixedIncomeTerm,
	in Instrument,
	today time.Time,
) ([]domain.DatedPrice, error) {
	quote, err := m.Instrument(ctx, string(in.QuoteCurrency))
	if err != nil {
		return nil, err
	}

	rates, err := m.accrualRates(ctx, row)
	if err != nil {
		return nil, err
	}

	terms := toTerms(row)

	series, err := domain.Accrue(
		terms,
		m.businessDays,
		quote.Scale,
		rates,
		row.IssuedOn,
		today,
		nil,
	)
	if err != nil {
		return nil, err
	}

	anchors, err := m.anchors(ctx, in)
	if err != nil {
		return nil, err
	}

	return domain.Anchor(series, anchors)
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

// anchors reads the prices of in that outrank the accrual, oldest first (HR1).
func (m *Module) anchors(ctx context.Context, in Instrument) ([]domain.DatedPrice, error) {
	priority, err := domain.Priority(sourceAccrual, m.unofficial)
	if err != nil {
		return nil, err
	}

	rows, err := m.q.ListOutrankingPrices(ctx, postgres.ListOutrankingPricesParams{
		Instrument:      string(in.Code),
		QuoteInstrument: string(in.QuoteCurrency),
		Priority:        priority,
	})
	if err != nil {
		return nil, err
	}

	out := make([]domain.DatedPrice, len(rows))
	for i, r := range rows {
		v, err := platformpg.RateOf(r.Value)
		if err != nil {
			return nil, fmt.Errorf(
				"price of %s on %s: %w",
				in.Code,
				r.Date.Format(time.DateOnly),
				err,
			)
		}

		out[i] = domain.DatedPrice{Date: r.Date, Value: v.String()}
	}

	return out, nil
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
