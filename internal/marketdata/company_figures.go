package marketdata

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/money"
	platformpg "github.com/andrelopes-code/equori/internal/platform/postgres"
)

const (
	fiscalYear = 12
	// yearPriceAge is the age in days up to which a price stands for a fiscal year end (AC7).
	yearPriceAge = 10
	// officialPriority ranks the prices an exchange or a regulator publishes (A222 MQ1).
	officialPriority = 3
)

type (
	CompanyFigureSet = domain.CompanyFigureSet
	CompanyFigures   = domain.CompanyFigures
	CompanyFigure    = domain.Figure
)

// CompanyFigures returns the figures of each report set of CompanyReports, with the price of the
// latest date on or before priceDate (contribution criteria AC4 to AC9).
func (m *Module) CompanyFigures(
	ctx context.Context,
	code string,
	priceDate time.Time,
) ([]CompanyFigureSet, error) {
	reports, err := m.CompanyReports(ctx, code)
	if err != nil {
		return nil, err
	}

	out := make([]CompanyFigureSet, len(reports))

	for i, r := range reports {
		in, err := m.figureInput(ctx, money.Currency(code), r, priceDate)
		if err != nil {
			return nil, err
		}

		out[i] = CompanyFigureSet{Report: r, Figures: domain.Figures(in)}
	}

	return out, nil
}

// CurrentCompanyFigures returns CompanyFigures at today's price.
func (m *Module) CurrentCompanyFigures(
	ctx context.Context,
	code string,
) ([]CompanyFigureSet, error) {
	return m.CompanyFigures(ctx, code, m.feeds.Clock.Today(ctx))
}

func (m *Module) figureInput(
	ctx context.Context,
	code money.Currency,
	r CompanyReport,
	priceDate time.Time,
) (domain.FigureInput, error) {
	quote, err := m.Instrument(ctx, r.Currency)
	if err != nil {
		return domain.FigureInput{}, fmt.Errorf("read the currency %s: %w", r.Currency, err)
	}

	out := domain.FigureInput{
		Report:       r,
		Today:        m.feeds.Clock.Today(ctx),
		PriceDate:    priceDate,
		MinorPerUnit: pow10(quote.Scale),
		YearPrices:   map[time.Time]*big.Rat{},
	}

	// The prices of the age of a price before the newest balance serve a balance of today.
	from := r.Periods[0].Period.AddDate(0, 0, -yearPriceAge)
	if from.After(priceDate) {
		from = priceDate
	}

	prices, err := m.ListPrices(ctx, code, quote.Code, from, priceDate)
	if err != nil {
		return domain.FigureInput{}, fmt.Errorf("list the prices of %s: %w", code, err)
	}

	for _, p := range prices {
		out.Prices = append(out.Prices, domain.CompanyPrice{Date: p.Date, Value: ratOf(p.Value)})
	}

	for _, p := range r.Periods {
		if p.Months != fiscalYear {
			continue
		}

		if err := m.yearPrice(ctx, code, quote.Code, p.Period, out.YearPrices); err != nil {
			return domain.FigureInput{}, err
		}
	}

	return out, nil
}

// yearPrice sets the official price of a fiscal year end: an unofficial source may restate a price
// for a later split, which the shares of that year do not.
func (m *Module) yearPrice(
	ctx context.Context,
	code, quote money.Currency,
	end time.Time,
	into map[time.Time]*big.Rat,
) error {
	rows, err := m.q.PriceOfPriority(ctx, postgres.PriceOfPriorityParams{
		Instrument:      string(code),
		QuoteInstrument: string(quote),
		FromDate:        end.AddDate(0, 0, -yearPriceAge),
		ToDate:          end,
		Priority:        officialPriority,
	})
	if err != nil {
		return fmt.Errorf("read the official price of %s: %w", code, err)
	}

	if len(rows) == 0 {
		return nil
	}

	rate, err := platformpg.RateOf(rows[0])
	if err != nil {
		return err
	}

	into[end] = ratOf(rate)

	return nil
}

func ratOf(r money.Rate) *big.Rat { return big.NewRat(r.Mantissa(), pow10(r.Scale())) }
