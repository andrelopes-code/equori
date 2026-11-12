package toolapi

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func getMarketData(svc Service, cals Calendars) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_market_data",
		Description: "Returns market data of the instance: instruments with their type and scale, one instrument with its fixed income terms, prices of an instrument in a period, business-day calendars, a calendar's holidays in a year, " +
			"the stored economic indexes, the rates of one index in a period, or the annual rates a market survey expects for one index (where the indexes view says expected). " +
			"The catalog view searches, by code or name, the instruments the enabled price sources can quote, to define one with manage_instrument. " +
			"Use it for prices, securities, holidays and index rates. " +
			"Do not use it for the book's holdings: get_portfolio does.",
		Effect:     tool.ReadOnly,
		Idempotent: true,
	}, func(ctx context.Context, _ int64, in getMarketDataIn) (getMarketDataOut, error) {
		return readMarketData(ctx, svc, cals, in)
	})
}

func readMarketData(
	ctx context.Context,
	svc Service,
	cals Calendars,
	in getMarketDataIn,
) (getMarketDataOut, error) {
	if err := checkMarketDataArgs(in); err != nil {
		return getMarketDataOut{}, err
	}

	switch in.View {
	case "instruments":
		return marketInstruments(ctx, svc)
	case "instrument":
		return marketInstrument(ctx, svc, in)
	case "prices":
		return marketPrices(ctx, svc, in)
	case "catalog":
		return marketCatalog(ctx, svc, in)
	case "indexes":
		return marketIndexes(ctx, svc)
	case "index_rates":
		return marketIndexRates(ctx, svc, in)
	case "index_expectations":
		return marketIndexExpectations(ctx, svc, in)
	case "calendars":
		out := getMarketDataOut{Calendars: []calendarView{}}
		for _, c := range cals.List() {
			out.Calendars = append(out.Calendars, calendarView(c))
		}

		return out, nil
	}

	rows, err := cals.Holidays(ctx, in.Calendar, in.Year)

	out := getMarketDataOut{Holidays: []holidayView{}}
	for _, h := range rows {
		out.Holidays = append(
			out.Holidays,
			holidayView{Date: tool.DateOf(h.Date), Name: h.Name, Source: h.Source},
		)
	}

	return out, err
}

func checkMarketDataArgs(in getMarketDataIn) error {
	fields := []field{
		{
			"code",
			in.Code != "",
		},
		{"quote", in.Quote != ""},
		{"from", !in.From.IsZero()},
		{"to", !in.To.IsZero()},
		{"calendar", in.Calendar != ""},
		{"year", in.Year != 0},
		{"index", in.Index != ""},
		{"query", in.Query != ""},
	}
	name := "view " + string(in.View)

	var err error
	switch in.View {
	case "instrument":
		err = required(name, fields, "code")
	case "prices":
		err = required(name, fields, "code", "quote", "from", "to")
	case "catalog":
		err = required(name, fields, "query")
	case "holidays":
		err = required(name, fields, "calendar", "year")
	case "index_rates":
		err = required(name, fields, "index", "from", "to")
	case "index_expectations":
		err = required(name, fields, "index")
	default:
		err = required(name, fields)
	}

	return err
}

func marketInstruments(ctx context.Context, svc Service) (getMarketDataOut, error) {
	rows, err := svc.ListInstruments(ctx, "")

	out := getMarketDataOut{Instruments: []instrumentView{}}
	for _, r := range rows {
		out.Instruments = append(out.Instruments, toInstrumentView(r))
	}

	return out, err
}

func marketInstrument(
	ctx context.Context,
	svc Service,
	in getMarketDataIn,
) (getMarketDataOut, error) {
	r, err := svc.Instrument(ctx, in.Code)
	if err != nil {
		return getMarketDataOut{}, err
	}

	v := toInstrumentView(r)
	if t, err := svc.Terms(ctx, in.Code); err == nil {
		v.Terms, err = toTermsView(t, r.QuoteCurrency)
		if err != nil {
			return getMarketDataOut{}, err
		}
	} else if !errors.Is(err, domain.ErrNoTerms) {
		return getMarketDataOut{}, err
	}

	cov, err := svc.Coverage(ctx, r)
	if err != nil {
		return getMarketDataOut{}, err
	}

	v.Coverage = toCoverageView(cov)

	return getMarketDataOut{Instrument: v}, nil
}

func marketPrices(
	ctx context.Context,
	svc Service,
	in getMarketDataIn,
) (getMarketDataOut, error) {
	if in.To.Before(in.From.Time) || in.To.Sub(in.From.Time) > domain.MaxPriceRange*24*time.Hour {
		return getMarketDataOut{}, tool.InvalidArgument(
			"to",
			fmt.Sprintf("must be between from and %d days after from", domain.MaxPriceRange),
		)
	}

	rows, err := svc.ListPrices(
		ctx,
		money.Currency(in.Code),
		money.Currency(in.Quote),
		in.From.Time,
		in.To.Time,
	)

	out := getMarketDataOut{Prices: []priceView{}}
	for _, p := range rows {
		out.Prices = append(out.Prices, priceView{
			Date:  tool.DateOf(p.Date),
			Value: p.Value.Reduced().String(),
		})
	}

	return out, err
}

func marketCatalog(
	ctx context.Context,
	svc Service,
	in getMarketDataIn,
) (getMarketDataOut, error) {
	res, err := svc.SearchCatalog(ctx, in.Query)
	if err != nil {
		return getMarketDataOut{}, err
	}

	out := getMarketDataOut{Catalog: []listingView{}, Unavailable: res.Unavailable}
	for _, l := range res.Items {
		out.Catalog = append(out.Catalog, listingView{
			Code: string(l.Code), Name: l.Name, Type: l.Type, Exchange: l.Exchange,
			QuoteCurrency: string(l.QuoteCurrency), Source: l.Source, Defined: l.Defined,
		})
	}

	return out, nil
}

func marketIndexes(ctx context.Context, svc Service) (getMarketDataOut, error) {
	rows, err := svc.Indexes(ctx)

	out := getMarketDataOut{Indexes: []indexView{}}
	for _, x := range rows {
		out.Indexes = append(out.Indexes, indexView{
			ID:       x.ID,
			Period:   x.Period,
			First:    tool.DateOf(x.First),
			Last:     tool.DateOf(x.Last),
			Expected: x.Expected,
		})
	}

	return out, err
}

func marketIndexRates(
	ctx context.Context,
	svc Service,
	in getMarketDataIn,
) (getMarketDataOut, error) {
	rows, err := svc.IndexRates(ctx, in.Index, in.From.Time, in.To.Time)

	out := getMarketDataOut{IndexRates: []indexRateView{}}
	for _, r := range rows {
		out.IndexRates = append(
			out.IndexRates,
			indexRateView{Date: tool.DateOf(r.Date), Rate: r.Rate},
		)
	}

	return out, err
}

func marketIndexExpectations(
	ctx context.Context,
	svc Service,
	in getMarketDataIn,
) (getMarketDataOut, error) {
	x, err := svc.Expectations(ctx, in.Index)
	if err != nil {
		return getMarketDataOut{}, err
	}

	v := indexExpectationsView{SurveyDate: tool.DateOf(x.SurveyDate), Points: []indexRateView{}}
	for _, p := range x.Points {
		v.Points = append(v.Points, indexRateView{Date: tool.DateOf(p.Date), Rate: p.Rate})
	}

	return getMarketDataOut{IndexExpectations: v}, nil
}
