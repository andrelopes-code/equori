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
		"curves",
		"fund_reports",
		"company_reports",
	}
}

type getMarketDataIn struct {
	View     getMarketDataView `json:"view"              jsonschema:"what to return"`
	Code     string            `json:"code,omitzero"     jsonschema:"for instrument, prices, fund_reports and company_reports: instrument code, such as a ticker or currency code"`
	Quote    string            `json:"quote,omitzero"    jsonschema:"for prices: code of the currency the price is quoted in"`
	From     tool.Date         `json:"from,omitzero"     jsonschema:"for prices and index_rates: first date"`
	To       tool.Date         `json:"to,omitzero"       jsonschema:"for prices and index_rates: last date; at most 18300 days after from for prices, 7320 for index_rates"`
	Index    string            `json:"index,omitzero"    jsonschema:"for index_rates and index_expectations: index id from the indexes view"`
	Calendar string            `json:"calendar,omitzero" jsonschema:"for holidays: calendar identifier from the calendars view"`
	Year     int               `json:"year,omitzero"     jsonschema:"for holidays: calendar year"`
	Query    string            `json:"query,omitzero"    jsonschema:"for catalog: text of a code or a name, 2 characters or more"`
}

type termsView struct {
	IssuedOn         tool.Date     `json:"issued_on"`
	MaturesOn        tool.Date     `json:"matures_on"`
	IndexID          string        `json:"index_id,omitzero"`
	PercentOfIndexBP int           `json:"percent_of_index_bp"`
	SpreadBP         int           `json:"spread_bp"`
	DayCount         string        `json:"day_count"`
	FaceValue        tool.Money    `json:"face_value"`
	CalendarID       string        `json:"calendar_id,omitzero"`
	DailyLiquidity   bool          `json:"daily_liquidity"`
	RedeemableFrom   tool.Date     `json:"redeemable_from,omitzero"`
	Payments         []paymentView `json:"payments,omitzero"`
}

type paymentView struct {
	PaysOn         tool.Date `json:"pays_on"`
	AmortizationBP int       `json:"amortization_bp"`
	PaysInterest   bool      `json:"pays_interest"`
}

type instrumentView struct {
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	Type          string    `json:"type"`
	Subtype       string    `json:"subtype,omitzero"`
	Exchange      string    `json:"exchange,omitzero"`
	Symbols       []string  `json:"symbols,omitzero"`
	Issuer        string    `json:"issuer,omitzero"`
	Owned         bool      `json:"owned,omitzero"`
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

type curveView struct {
	ID       string           `json:"id"`
	Kind     string           `json:"kind"`
	Index    string           `json:"index,omitzero"`
	Currency string           `json:"currency"`
	BaseDate tool.Date        `json:"base_date"`
	Source   string           `json:"source"`
	Points   []curvePointView `json:"points"`
}

type fundReportView struct {
	Source     string                 `json:"source"`
	SourceURL  string                 `json:"source_url"`
	Exchange   string                 `json:"exchange"`
	Code       string                 `json:"code"`
	Currency   string                 `json:"currency"`
	Identifier string                 `json:"identifier"`
	Name       string                 `json:"name"`
	Segment    string                 `json:"segment"`
	Periods    []fundReportPeriodView `json:"periods"`
}

type fundReportPeriodView struct {
	Period            tool.Date        `json:"period"`
	Delivered         tool.Date        `json:"delivered,omitzero"`
	NetAssets         tool.OptionalInt `json:"net_assets,omitzero"`
	Holders           tool.OptionalInt `json:"holders,omitzero"`
	Units             string           `json:"units,omitzero"`
	UnitBookValue     string           `json:"unit_book_value,omitzero"`
	AdminFee          string           `json:"admin_fee,omitzero"`
	MonthYield        string           `json:"month_yield,omitzero"`
	MonthAmortization string           `json:"month_amortization,omitzero"`
}

type fundReportCandidateView struct {
	Source     string `json:"source"`
	Identifier string `json:"identifier"`
	Name       string `json:"name"`
	Segment    string `json:"segment"`
}

type companyReportView struct {
	Source       string                    `json:"source"`
	SourceURL    string                    `json:"source_url"`
	Identifier   string                    `json:"identifier"`
	Name         string                    `json:"name"`
	Consolidated bool                      `json:"consolidated"`
	Plan         string                    `json:"plan"`
	Currency     string                    `json:"currency"`
	Periods      []companyReportPeriodView `json:"periods"`
}

type companyReportPeriodView struct {
	Period    tool.Date `json:"period"`
	Months    int       `json:"months"`
	Delivered tool.Date `json:"delivered,omitzero"`

	TotalAssets        tool.OptionalInt `json:"total_assets,omitzero"`
	CurrentAssets      tool.OptionalInt `json:"current_assets,omitzero"`
	Cash               tool.OptionalInt `json:"cash,omitzero"`
	ShortInvestments   tool.OptionalInt `json:"short_investments,omitzero"`
	CurrentLiabilities tool.OptionalInt `json:"current_liabilities,omitzero"`
	ShortDebt          tool.OptionalInt `json:"short_debt,omitzero"`
	LongDebt           tool.OptionalInt `json:"long_debt,omitzero"`
	Equity             tool.OptionalInt `json:"equity,omitzero"`
	Revenue            tool.OptionalInt `json:"revenue,omitzero"`
	GrossProfit        tool.OptionalInt `json:"gross_profit,omitzero"`
	NetIncome          tool.OptionalInt `json:"net_income,omitzero"`
	OperatingCashFlow  tool.OptionalInt `json:"operating_cash_flow,omitzero"`
	SharesIssued       tool.OptionalInt `json:"shares_issued,omitzero"`
	SharesTreasury     tool.OptionalInt `json:"shares_treasury,omitzero"`
}

type curvePointView struct {
	Maturity tool.Date `json:"maturity"`
	Rate     string    `json:"rate"`
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
	// Curves holds the rates the enabled curve sources report by maturity.
	Curves []curveView `json:"curves,omitzero"`
	// FundReports holds the monthly reports the enabled fund report sources stored for the code.
	FundReports []fundReportView `json:"fund_reports,omitzero"`
	// FundReportCandidates holds, for a source without a report of the code, the funds that share
	// the code; the instrument's symbol for the source, set to an identifier, links one (FR15).
	FundReportCandidates []fundReportCandidateView `json:"fund_report_candidates,omitzero"`
	// CompanyReports holds the statements the enabled company report sources stored for the code.
	CompanyReports []companyReportView `json:"company_reports,omitzero"`
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
		Issuer:        issuerText(in.Issuer),
		Owned:         in.BooksID != 0,
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

	payments := make([]paymentView, 0, len(t.Payments))
	for _, p := range t.Payments {
		payments = append(payments, paymentView{
			PaysOn: tool.DateOf(
				p.PaysOn,
			),
			AmortizationBP: p.AmortizationBP,
			PaysInterest:   p.PaysInterest,
		})
	}

	return termsView{
		Payments:         payments,
		IssuedOn:         tool.DateOf(t.IssuedOn),
		MaturesOn:        tool.DateOf(t.MaturesOn),
		IndexID:          t.IndexID,
		PercentOfIndexBP: t.PercentOfIndexBP,
		SpreadBP:         t.SpreadBP,
		DayCount:         t.DayCount,
		FaceValue:        tool.MoneyOf(face),
		CalendarID:       t.CalendarID,
		DailyLiquidity:   t.DailyLiquidity,
		RedeemableFrom:   tool.DateOf(t.RedeemableFrom),
	}, nil
}
