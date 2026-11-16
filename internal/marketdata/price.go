package marketdata

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/money"
	platformpg "github.com/andrelopes-code/equori/internal/platform/postgres"
)

const rateMessage = "value must be a positive decimal with at most 12 decimals and 18 integer digits"

// RecordPrices stores ps in one transaction; an existing (instrument, quote, date,
// source) gets the new value (P8 amendment A60).
func (m *Module) RecordPrices(ctx context.Context, booksID int64, ps []Price) error {
	checked := map[money.Currency]Instrument{}
	for _, p := range ps {
		if err := m.validatePrice(ctx, booksID, p, checked); err != nil {
			return err
		}
	}

	return m.upsert(ctx, ps)
}

// ImportPrices records a CSV file as source csv, all or nothing.
func (m *Module) ImportPrices(
	ctx context.Context, booksID int64, content []byte,
) (int, error) {
	ps, err := domain.ParsePriceCSV(content)
	if err != nil {
		return 0, err
	}

	checked := map[money.Currency]Instrument{}
	for i, p := range ps {
		if err := m.validatePrice(ctx, booksID, p, checked); err != nil {
			var fe *domain.FieldError
			if errors.As(err, &fe) {
				return 0, &domain.FieldError{
					Field:   fmt.Sprintf("line %d", i+2),
					Message: fe.Field + " " + fe.Message,
				}
			}

			return 0, err
		}
	}

	return len(ps), m.upsert(ctx, ps)
}

// RecordInstrumentPrices records a series of one instrument as source csv, all or nothing, or
// only counts what it would change (A222 MQ32).
func (m *Module) RecordInstrumentPrices(
	ctx context.Context, code string, quote money.Currency, points []domain.PricePoint, dryRun bool,
) (domain.PriceCounts, error) {
	in, err := m.Instrument(ctx, code)
	if err != nil {
		return domain.PriceCounts{}, err
	}

	ps, err := instrumentPrices(code, quote, points)
	if err != nil {
		return domain.PriceCounts{}, err
	}

	if err := m.validatePrice(ctx, in.BooksID, ps[0], map[money.Currency]Instrument{}); err != nil {
		return domain.PriceCounts{}, err
	}

	counts, err := m.priceCounts(ctx, ps)
	if err != nil || dryRun {
		return counts, err
	}

	return counts, m.upsert(ctx, ps)
}

// instrumentPrices builds the csv prices of one instrument and rejects an empty series, a
// value that cannot be stored and a repeated date.
func instrumentPrices(
	code string,
	quote money.Currency,
	points []domain.PricePoint,
) ([]Price, error) {
	if len(points) == 0 {
		return nil, &domain.FieldError{
			Field:   "prices",
			Message: "must not be empty",
		}
	}

	ps := make([]Price, len(points))
	firstOf := make(map[time.Time]int, len(points))

	for i, pt := range points {
		if !domain.StorableRate(pt.Value) {
			return nil, &domain.FieldError{
				Field:   fmt.Sprintf("prices[%d]", i),
				Message: rateMessage,
			}
		}

		if j, ok := firstOf[pt.Date]; ok {
			return nil, &domain.FieldError{
				Field: fmt.Sprintf(
					"prices[%d]",
					i,
				),
				Message: fmt.Sprintf("date repeats prices[%d]", j),
			}
		}

		firstOf[pt.Date] = i
		ps[i] = Price{
			Instrument: money.Currency(code),
			Quote:      quote,
			Date:       pt.Date,
			Value:      pt.Value,
			Source:     domain.SourceCSV,
		}
	}

	return ps, nil
}

// priceCounts reads the prices of the dates of ps before any write (D17).
func (m *Module) priceCounts(ctx context.Context, ps []Price) (domain.PriceCounts, error) {
	dates := make([]time.Time, len(ps))
	for i, p := range ps {
		dates[i] = p.Date
	}

	rows, err := m.q.ListPricesOnDates(ctx, postgres.ListPricesOnDatesParams{
		Instrument: string(ps[0].Instrument), QuoteInstrument: string(ps[0].Quote), Dates: dates,
	})
	if err != nil {
		return domain.PriceCounts{}, fmt.Errorf("list prices on dates: %w", err)
	}

	csvValue := map[time.Time]string{}
	belowFeed := map[time.Time]bool{}

	for _, r := range rows {
		switch r.Source {
		case domain.SourceCSV:
			v, err := platformpg.RateOf(r.Value)
			if err != nil {
				return domain.PriceCounts{}, err
			}

			csvValue[r.Date] = v.Reduced().String()
		case domain.SourceManual, domain.SourceAccrual:
		default:
			belowFeed[r.Date] = !m.unofficial.Has(r.Source) || belowFeed[r.Date]
		}
	}

	var counts domain.PriceCounts

	for _, p := range ps {
		stored, ok := csvValue[p.Date]

		switch {
		case !ok:
			counts.New++
		case stored == p.Value.Reduced().String():
			counts.Unchanged++
		default:
			counts.Replaced++
		}

		if belowFeed[p.Date] {
			counts.BelowFeed++
		}
	}

	return counts, nil
}

func (m *Module) validatePrice(
	ctx context.Context,
	booksID int64,
	p Price,
	checked map[money.Currency]Instrument,
) error {
	lookup := func(code money.Currency) (Instrument, bool, error) {
		if in, ok := checked[code]; ok {
			return in, true, nil
		}

		in, err := m.Instrument(ctx, string(code))
		if errors.Is(err, ErrUnknownInstrument) {
			return Instrument{}, false, nil
		}

		if err != nil {
			return Instrument{}, false, err
		}

		checked[code] = in

		return in, true, nil
	}

	in, ok, err := lookup(p.Instrument)
	if err != nil {
		return err
	}

	if !ok || !in.VisibleTo(booksID) {
		return &domain.FieldError{Field: "instrument", Message: "is not a known instrument"}
	}

	quote, ok, err := lookup(p.Quote)
	if err != nil {
		return err
	}

	if !ok || quote.Type != domain.TypeCurrency || p.Quote == p.Instrument {
		return &domain.FieldError{
			Field:   "quote_instrument",
			Message: "must be a currency other than the instrument",
		}
	}

	if !domain.StorableRate(p.Value) {
		return &domain.FieldError{
			Field:   "value",
			Message: "must be positive with at most 18 integer digits",
		}
	}

	return nil
}

func (m *Module) upsert(ctx context.Context, ps []Price) error {
	accrual, err := domain.Priority(sourceAccrual, m.unofficial)
	if err != nil {
		return err
	}

	return pgx.BeginFunc(ctx, m.pool, func(tx pgx.Tx) error {
		q := m.q.WithTx(tx)

		var anchors postgres.DeleteAccruedAfterParams

		for _, p := range ps {
			priority, err := domain.Priority(p.Source, m.unofficial)
			if err != nil {
				return err
			}

			if err := q.UpsertPrice(ctx, postgres.UpsertPriceParams{
				Instrument: string(p.Instrument), QuoteInstrument: string(p.Quote), Date: p.Date,
				Value: platformpg.NumericOf(p.Value), Source: p.Source, Priority: priority,
			}); err != nil {
				return fmt.Errorf("record price: %w", err)
			}

			if priority < accrual {
				anchors.Instruments = append(anchors.Instruments, string(p.Instrument))
				anchors.Quotes = append(anchors.Quotes, string(p.Quote))
				anchors.Days = append(anchors.Days, p.Date)
			}
		}

		if len(anchors.Days) == 0 {
			return nil
		}

		// A price that outranks the accrual anchors the days after it: the next tick computes them
		// again (return honesty HR1).
		anchors.Source = sourceAccrual

		return q.DeleteAccruedAfter(ctx, anchors)
	})
}

// PriceOnOrBefore returns the chosen price of the latest date ≤ date (A60).
func (m *Module) PriceOnOrBefore(
	ctx context.Context,
	instrument, quote money.Currency,
	date time.Time,
) (Price, bool, error) {
	rows, err := m.q.PriceOnOrBefore(
		ctx,
		postgres.PriceOnOrBeforeParams{
			Instrument:      string(instrument),
			QuoteInstrument: string(quote),
			Date:            date,
		},
	)
	if err != nil || len(rows) == 0 {
		return Price{}, false, err
	}

	p, err := toPrice(rows[0])

	return p, err == nil, err
}

// ListPrices returns the chosen price of each date with prices in [from, to].
func (m *Module) ListPrices(
	ctx context.Context,
	instrument, quote money.Currency,
	from, to time.Time,
) ([]Price, error) {
	if err := domain.ValidRange(from, to); err != nil {
		return nil, err
	}

	rows, err := m.q.ListChosenPrices(
		ctx,
		postgres.ListChosenPricesParams{
			Instrument:      string(instrument),
			QuoteInstrument: string(quote),
			FromDate:        from,
			ToDate:          to,
		},
	)
	if err != nil {
		return nil, err
	}

	out := make([]Price, len(rows))
	for i, r := range rows {
		if out[i], err = toPrice(r); err != nil {
			return nil, err
		}
	}

	return out, nil
}

func toPrice(r postgres.MarketdataPrice) (Price, error) {
	v, err := platformpg.RateOf(r.Value)
	if err != nil {
		return Price{}, err
	}

	return Price{
		Instrument: money.Currency(r.Instrument),
		Quote:      money.Currency(r.QuoteInstrument),
		Date:       r.Date,
		Value:      v,
		Source:     r.Source,
	}, nil
}
