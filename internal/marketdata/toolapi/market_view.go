package toolapi

import (
	"maps"
	"slices"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type getMarketDataView string

func (getMarketDataView) Values() []string {
	return []string{
		"instruments",
		"instrument",
		"prices",
		"catalog",
		"calendars",
		"holidays",
		"indexes",
		"index_rates",
		"index_expectations",
	}
}

type getMarketDataIn struct {
	View     getMarketDataView `json:"view"              jsonschema:"what to return"`
	Code     string            `json:"code,omitzero"     jsonschema:"for instrument and prices: instrument code, such as a ticker or currency code"`
	Quote    string            `json:"quote,omitzero"    jsonschema:"for prices: code of the currency the price is quoted in"`
	From     tool.Date         `json:"from,omitzero"     jsonschema:"for prices and index_rates: first date"`
	To       tool.Date         `json:"to,omitzero"       jsonschema:"for prices and index_rates: last date; at most 18300 days after from for prices, 7320 for index_rates"`
	Index    string            `json:"index,omitzero"    jsonschema:"for index_rates and index_expectations: index id from the indexes view"`
	Calendar string            `json:"calendar,omitzero" jsonschema:"for holidays: calendar identifier from the calendars view"`
	Year     int               `json:"year,omitzero"     jsonschema:"for holidays: calendar year"`
	Query    string            `json:"query,omitzero"    jsonschema:"for catalog: text of a code or a name, 2 characters or more"`
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
	Exchange      string    `json:"exchange,omitzero"`
	Symbols       []string  `json:"symbols,omitzero"`
	QuoteCurrency string    `json:"quote_currency,omitzero"`
	Scale         int       `json:"scale"`
	Terms         termsView `json:"terms,omitzero"`
	// Coverage is filled by the view instrument only.
	Coverage coverageView `json:"coverage,omitzero"`
}

type coverageView struct {
	Last    tool.Date    `json:"last,omitzero"`
	Stale   bool         `json:"stale"`
	Sources []sourceView `json:"sources"`
}

type sourceView struct {
	ID       string    `json:"id"`
	Enabled  bool      `json:"enabled"`
	Official bool      `json:"official"`
	Last     tool.Date `json:"last,omitzero"`
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
	ID       string    `json:"id"`
	Period   string    `json:"period"`
	First    tool.Date `json:"first"`
	Last     tool.Date `json:"last"`
	Expected bool      `json:"expected"`
}

type indexExpectationsView struct {
	SurveyDate tool.Date       `json:"survey_date"`
	Points     []indexRateView `json:"points"`
}

type indexRateView struct {
	Date tool.Date `json:"date"`
	Rate string    `json:"rate"`
}

type listingView struct {
	Code          string `json:"code"`
	Name          string `json:"name,omitzero"`
	Type          string `json:"type,omitzero"`
	Exchange      string `json:"exchange,omitzero"`
	QuoteCurrency string `json:"quote_currency,omitzero"`
	Source        string `json:"source"`
	Defined       bool   `json:"defined"`
}

type getMarketDataOut struct {
	Instruments []instrumentView `json:"instruments,omitzero"`
	Instrument  instrumentView   `json:"instrument,omitzero"`
	Prices      []priceView      `json:"prices,omitzero"`
	Catalog     []listingView    `json:"catalog,omitzero"`
	Unavailable []string         `json:"unavailable,omitzero"`
	Calendars   []calendarView   `json:"calendars,omitzero"`
	Holidays    []holidayView    `json:"holidays,omitzero"`
	Indexes     []indexView      `json:"indexes,omitzero"`
	IndexRates  []indexRateView  `json:"index_rates,omitzero"`
	// IndexExpectations holds annual rates expected on each date by the latest survey.
	IndexExpectations indexExpectationsView `json:"index_expectations,omitzero"`
}

func toInstrumentView(in domain.Instrument) instrumentView {
	v := instrumentView{
		Code:          string(in.Code),
		Name:          in.Name,
		Type:          in.Type,
		Subtype:       in.Subtype,
		Exchange:      in.Exchange,
		QuoteCurrency: string(in.QuoteCurrency),
		Scale:         in.Scale,
	}
	for _, k := range slices.Sorted(maps.Keys(in.Symbols)) {
		v.Symbols = append(v.Symbols, k+"="+in.Symbols[k])
	}

	return v
}

func toCoverageView(c domain.Coverage) coverageView {
	out := coverageView{Stale: c.Stale, Sources: make([]sourceView, len(c.Sources))}
	if c.Last != nil {
		out.Last = tool.DateOf(*c.Last)
	}

	for i, s := range c.Sources {
		out.Sources[i] = sourceView{ID: s.ID, Enabled: s.Enabled, Official: s.Official}
		if s.Last != nil {
			out.Sources[i].Last = tool.DateOf(*s.Last)
		}
	}

	return out
}

func toTermsView(t domain.Terms, quote money.Currency) (termsView, error) {
	face, err := money.New(t.FaceValue, quote)
	if err != nil {
		return termsView{}, err
	}

	return termsView{
		IssuedOn:         tool.DateOf(t.IssuedOn),
		MaturesOn:        tool.DateOf(t.MaturesOn),
		IndexID:          t.IndexID,
		PercentOfIndexBP: t.PercentOfIndexBP,
		SpreadBP:         t.SpreadBP,
		DayCount:         t.DayCount,
		FaceValue:        tool.MoneyOf(face),
	}, nil
}
