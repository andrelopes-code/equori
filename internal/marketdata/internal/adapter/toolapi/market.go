package toolapi

import (
	"context"
	"errors"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type getMarketDataView string

func (getMarketDataView) Values() []string {
	return []string{"instruments", "instrument", "prices", "calendars", "holidays", "indexes", "index_rates"}
}

type getMarketDataIn struct {
	View     getMarketDataView `json:"view" jsonschema:"what to return"`
	Code     string            `json:"code,omitzero" jsonschema:"for instrument and prices: instrument code, such as a ticker or currency code"`
	Quote    string            `json:"quote,omitzero" jsonschema:"for prices: code of the currency the price is quoted in"`
	From     tool.Date         `json:"from,omitzero" jsonschema:"for prices and index_rates: first date"`
	To       tool.Date         `json:"to,omitzero" jsonschema:"for prices and index_rates: last date; at most 366 days after from for prices, 7320 for index_rates"`
	Index    string            `json:"index,omitzero" jsonschema:"for index_rates: index id from the indexes view"`
	Calendar string            `json:"calendar,omitzero" jsonschema:"for holidays: calendar identifier from the calendars view"`
	Year     int               `json:"year,omitzero" jsonschema:"for holidays: calendar year"`
}

type termsView struct {
	IssuedOn         tool.Date  `json:"issued_on"`
	MaturesOn        tool.Date  `json:"matures_on"`
	IndexID          string     `json:"index_id,omitzero"`
	PercentOfIndexBP int        `json:"percent_of_index_bp"`
	SpreadBP         int        `json:"spread_bp"`
	DayCount         string     `json:"day_count"`
	FaceValue        tool.Money `json:"face_value"`
}

type instrumentView struct {
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	Type          string    `json:"type"`
	Subtype       string    `json:"subtype,omitzero"`
	QuoteCurrency string    `json:"quote_currency,omitzero"`
	Scale         int       `json:"scale"`
	Terms         termsView `json:"terms,omitzero"`
}

type priceView struct {
	Date  tool.Date `json:"date"`
	Value string    `json:"value"`
}

type calendarView struct {
	ID      string   `json:"id"`
	Weekend []string `json:"weekend"`
}

type holidayView struct {
	Date   tool.Date `json:"date"`
	Name   string    `json:"name"`
	Source string    `json:"source"`
}

type indexView struct {
	ID     string    `json:"id"`
	Period string    `json:"period"`
	First  tool.Date `json:"first"`
	Last   tool.Date `json:"last"`
}

type indexRateView struct {
	Date tool.Date `json:"date"`
	Rate string    `json:"rate"`
}

type getMarketDataOut struct {
	Instruments []instrumentView `json:"instruments,omitzero"`
	Instrument  instrumentView   `json:"instrument,omitzero"`
	Prices      []priceView      `json:"prices,omitzero"`
	Calendars   []calendarView   `json:"calendars,omitzero"`
	Holidays    []holidayView    `json:"holidays,omitzero"`
	Indexes     []indexView      `json:"indexes,omitzero"`
	IndexRates  []indexRateView  `json:"index_rates,omitzero"`
}

func toInstrumentView(in domain.Instrument) instrumentView {
	return instrumentView{Code: string(in.Code), Name: in.Name, Type: in.Type, Subtype: in.Subtype, QuoteCurrency: string(in.QuoteCurrency), Scale: in.Scale}
}

func getMarketData(svc Service, cals Calendars) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_market_data",
		Description: "Returns market data of the instance: instruments with their type and scale, one instrument with its fixed income terms, prices of an instrument in a period, business-day calendars, a calendar's holidays in a year, " +
			"the stored economic indexes, or the rates of one index in a period. " +
			"Use it for prices, securities, holidays and index rates. " +
			"Do not use it for the user's holdings: get_portfolio does.",
		Effect:     tool.ReadOnly,
		Idempotent: true,
	}, func(ctx context.Context, _ int64, in getMarketDataIn) (getMarketDataOut, error) {
		fields := []field{
			{"code", in.Code != ""}, {"quote", in.Quote != ""}, {"from", !in.From.IsZero()}, {"to", !in.To.IsZero()},
			{"calendar", in.Calendar != ""}, {"year", in.Year != 0}, {"index", in.Index != ""},
		}
		name := "view " + string(in.View)
		var err error
		switch in.View {
		case "instrument":
			err = required(name, fields, "code")
		case "prices":
			err = required(name, fields, "code", "quote", "from", "to")
		case "holidays":
			err = required(name, fields, "calendar", "year")
		case "index_rates":
			err = required(name, fields, "index", "from", "to")
		default:
			err = required(name, fields)
		}
		if err != nil {
			return getMarketDataOut{}, err
		}
		switch in.View {
		case "instruments":
			rows, err := svc.ListInstruments(ctx, "")
			out := getMarketDataOut{Instruments: []instrumentView{}}
			for _, r := range rows {
				out.Instruments = append(out.Instruments, toInstrumentView(r))
			}
			return out, err
		case "instrument":
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
			return getMarketDataOut{Instrument: v}, nil
		case "prices":
			if in.To.Before(in.From.Time) || in.To.Sub(in.From.Time) > domain.MaxPriceRange*24*time.Hour {
				return getMarketDataOut{}, tool.InvalidArgument("to", "must be between from and 366 days after from")
			}
			rows, err := svc.ListPrices(ctx, money.Currency(in.Code), money.Currency(in.Quote), in.From.Time, in.To.Time)
			out := getMarketDataOut{Prices: []priceView{}}
			for _, p := range rows {
				out.Prices = append(out.Prices, priceView{Date: tool.DateOf(p.Date), Value: p.Value.Reduced().String()})
			}
			return out, err
		case "indexes":
			rows, err := svc.Indexes(ctx)
			out := getMarketDataOut{Indexes: []indexView{}}
			for _, x := range rows {
				out.Indexes = append(out.Indexes, indexView{ID: x.ID, Period: x.Period, First: tool.DateOf(x.First), Last: tool.DateOf(x.Last)})
			}
			return out, err
		case "index_rates":
			rows, err := svc.IndexRates(ctx, in.Index, in.From.Time, in.To.Time)
			out := getMarketDataOut{IndexRates: []indexRateView{}}
			for _, r := range rows {
				out.IndexRates = append(out.IndexRates, indexRateView{Date: tool.DateOf(r.Date), Rate: r.Rate})
			}
			return out, err
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
			out.Holidays = append(out.Holidays, holidayView{Date: tool.DateOf(h.Date), Name: h.Name, Source: h.Source})
		}
		return out, err
	})
}

func toTermsView(t domain.Terms, quote money.Currency) (termsView, error) {
	face, err := money.New(t.FaceValue, quote)
	if err != nil {
		return termsView{}, err
	}
	return termsView{
		IssuedOn: tool.DateOf(t.IssuedOn), MaturesOn: tool.DateOf(t.MaturesOn), IndexID: t.IndexID,
		PercentOfIndexBP: t.PercentOfIndexBP, SpreadBP: t.SpreadBP, DayCount: t.DayCount, FaceValue: tool.MoneyOf(face),
	}, nil
}
