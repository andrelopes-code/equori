package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type companyFiguresView struct {
	Source              string            `json:"source"`
	Name                string            `json:"name"`
	Currency            string            `json:"currency"`
	PriceDate           tool.Date         `json:"price_date,omitzero"`
	PriceEarnings       companyFigureView `json:"price_earnings"`
	PriceBook           companyFigureView `json:"price_book"`
	PriceEarningsRange  companyRangeView  `json:"price_earnings_range,omitzero"`
	PriceBookRange      companyRangeView  `json:"price_book_range,omitzero"`
	ReturnOnEquity      companyFigureView `json:"return_on_equity"`
	NetMargin           companyFigureView `json:"net_margin"`
	NetDebtToEquity     companyFigureView `json:"net_debt_to_equity"`
	GrossProfitToAssets companyFigureView `json:"gross_profit_to_assets"`
	CurrentRatio        companyFigureView `json:"current_ratio"`
	RevenueGrowth       companyFigureView `json:"revenue_growth"`
	PositiveYears       int               `json:"positive_years"`
	FiscalYears         int               `json:"fiscal_years"`
	Profit              companyChangeView `json:"profit"`
	Revenue             companyChangeView `json:"revenue"`
}

// companyFigureView holds a value and the end of what it reads, or the reason it has none.
type companyFigureView struct {
	Value  string    `json:"value,omitzero"`
	Date   tool.Date `json:"date,omitzero"`
	Reason string    `json:"reason,omitzero"`
}

type companyRangeView struct {
	Least    string `json:"least"`
	Greatest string `json:"greatest"`
	Years    int    `json:"years"`
}

type companyChangeView struct {
	State  string    `json:"state,omitzero"`
	Rate   string    `json:"rate,omitzero"`
	Date   tool.Date `json:"date,omitzero"`
	Months int       `json:"months,omitzero"`
	Reason string    `json:"reason,omitzero"`
}

func marketCompanyFigures(
	ctx context.Context,
	svc Service,
	in getMarketDataIn,
) (getMarketDataOut, error) {
	sets, err := svc.CurrentCompanyFigures(ctx, in.Code)
	if err != nil {
		return getMarketDataOut{}, err
	}

	out := getMarketDataOut{CompanyFigures: make([]companyFiguresView, len(sets))}
	for i, set := range sets {
		out.CompanyFigures[i] = toCompanyFiguresView(set)
	}

	return out, nil
}

func toCompanyFiguresView(set domain.CompanyFigureSet) companyFiguresView {
	f := set.Figures
	v := companyFiguresView{
		Source:              set.Report.Source,
		Name:                set.Report.Name,
		Currency:            set.Report.Currency,
		PriceEarnings:       toFigureView(f.PriceEarnings),
		PriceBook:           toFigureView(f.PriceBook),
		PriceEarningsRange:  toRangeView(f.PriceEarningsRange),
		PriceBookRange:      toRangeView(f.PriceBookRange),
		ReturnOnEquity:      toFigureView(f.ReturnOnEquity),
		NetMargin:           toFigureView(f.NetMargin),
		NetDebtToEquity:     toFigureView(f.NetDebtToEquity),
		GrossProfitToAssets: toFigureView(f.GrossProfitToAssets),
		CurrentRatio:        toFigureView(f.CurrentRatio),
		RevenueGrowth:       toFigureView(f.RevenueGrowth),
		PositiveYears:       f.PositiveYears.Positive,
		FiscalYears:         f.PositiveYears.Years,
		Profit:              toChangeView(f.Profit),
		Revenue:             toChangeView(f.Revenue),
	}

	if f.PriceDate != nil {
		v.PriceDate = tool.DateOf(*f.PriceDate)
	}

	return v
}

func toFigureView(f domain.Figure) companyFigureView {
	if f.Value == nil {
		return companyFigureView{Reason: f.Reason}
	}

	return companyFigureView{Value: domain.FigureText(f.Value), Date: tool.DateOf(f.Date)}
}

func toRangeView(r *domain.Range) companyRangeView {
	if r == nil {
		return companyRangeView{}
	}

	return companyRangeView{
		Least:    domain.FigureText(r.Least),
		Greatest: domain.FigureText(r.Greatest),
		Years:    r.Years,
	}
}

func toChangeView(c domain.Change) companyChangeView {
	if c.State == "" {
		return companyChangeView{Reason: c.Reason}
	}

	v := companyChangeView{State: c.State, Date: tool.DateOf(c.Date), Months: c.Months}
	if c.Rate != nil {
		v.Rate = domain.FigureText(c.Rate)
	}

	return v
}
