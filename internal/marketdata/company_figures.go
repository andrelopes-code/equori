package marketdata

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/marketdata/companyreport"
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

// storeCompanyShareCounts replaces the counts of each year of snap and deletes those of a year
// outside its window.
func storeCompanyShareCounts(
	ctx context.Context,
	q *postgres.Queries,
	source string,
	snap companyreport.Snapshot,
) error {
	read := make([]int16, len(snap.Counts))
	for i, f := range snap.Counts {
		read[i] = int16(f.Year) //nolint:gosec // G115: a calendar year
	}

	window := make([]int16, len(snap.CountYears))
	for i, y := range snap.CountYears {
		window[i] = int16(y) //nolint:gosec // G115: a calendar year
	}

	err := q.DeleteCompanyShareCounts(ctx, postgres.DeleteCompanyShareCountsParams{
		Source: source, ReadYears: read, WindowYears: window,
	})
	if err != nil {
		return fmt.Errorf("delete the share counts of %s: %w", source, err)
	}

	for i, f := range snap.Counts {
		for _, c := range f.Counts {
			err := q.InsertCompanyShareCount(ctx, postgres.InsertCompanyShareCountParams{
				Source: source, Identifier: c.Identifier, Year: read[i], Shares: c.Shares,
			})
			if err != nil {
				return fmt.Errorf("store the share count of %s: %w", c.Identifier, err)
			}
		}
	}

	return nil
}

// companyOf returns the company an instrument reads, "" without one: the one its symbol for source
// names, else the one the listing of its exchange and code names. The shares of the listing are set
// on out when the listing is of that company.
func (m *Module) companyOf(
	ctx context.Context,
	source string,
	in Instrument,
	out *CompanyReport,
) (string, error) {
	listing, err := m.q.CompanyListing(ctx, postgres.CompanyListingParams{
		Source: source, Exchange: in.Exchange, Code: string(in.Code),
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", fmt.Errorf("find the company of %s: %w", in.Code, err)
	}

	identifier, linked := in.Symbols[source]
	if !linked {
		identifier = listing.Identifier
	}

	if listing.Identifier == identifier && listing.SharesPerUnit != nil {
		shares := int(*listing.SharesPerUnit)
		out.SharesPerUnit = &shares
	}

	return identifier, nil
}

func (m *Module) shareCounts(
	ctx context.Context,
	source, identifier string,
) (map[int]int64, error) {
	rows, err := m.q.ListCompanyShareCounts(ctx, postgres.ListCompanyShareCountsParams{
		Source: source, Identifier: identifier,
	})
	if err != nil {
		return nil, fmt.Errorf("list the share counts of %s: %w", identifier, err)
	}

	out := make(map[int]int64, len(rows))
	for _, r := range rows {
		out[int(r.Year)] = r.Shares
	}

	return out, nil
}

func smallint(n *int) *int16 {
	if n == nil {
		return nil
	}

	v := int16(*n) //nolint:gosec // G115: the source keeps it in 1-100

	return &v
}
