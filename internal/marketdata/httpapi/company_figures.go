package httpapi

import (
	"context"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) listCompanyFigures(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (CompanyFiguresList, error) {
	sets, err := s.svc.CurrentCompanyFigures(ctx, r.URL.Query().Get("code"))
	if err != nil {
		return CompanyFiguresList{}, err
	}

	items := make([]CompanyFigures, len(sets))
	for i, set := range sets {
		items[i] = companyFigures(set)
	}

	return CompanyFiguresList{Items: items}, nil
}

func companyFigures(set domain.CompanyFigureSet) CompanyFigures {
	f := set.Figures

	return CompanyFigures{
		Source:              set.Report.Source,
		SourceUrl:           set.Report.SourceURL,
		Name:                set.Report.Name,
		Currency:            set.Report.Currency,
		PriceDate:           date(f.PriceDate),
		PriceEarnings:       companyFigure(f.PriceEarnings),
		PriceBook:           companyFigure(f.PriceBook),
		PriceEarningsRange:  companyRange(f.PriceEarningsRange),
		PriceBookRange:      companyRange(f.PriceBookRange),
		ReturnOnEquity:      companyFigure(f.ReturnOnEquity),
		NetMargin:           companyFigure(f.NetMargin),
		NetDebtToEquity:     companyFigure(f.NetDebtToEquity),
		GrossProfitToAssets: companyFigure(f.GrossProfitToAssets),
		CurrentRatio:        companyFigure(f.CurrentRatio),
		RevenueGrowth:       companyFigure(f.RevenueGrowth),
		PositiveYears: CompanyPositiveYears{
			Positive: f.PositiveYears.Positive,
			Years:    f.PositiveYears.Years,
		},
		Profit:  companyChange(f.Profit),
		Revenue: companyChange(f.Revenue),
	}
}

func companyFigure(f domain.Figure) CompanyFigure {
	if f.Value == nil {
		return CompanyFigure{Reason: &f.Reason}
	}

	value := domain.FigureText(f.Value)

	return CompanyFigure{Value: &value, Date: &openapi_types.Date{Time: f.Date}}
}

func companyRange(r *domain.Range) *CompanyRange {
	if r == nil {
		return nil
	}

	return &CompanyRange{
		Least:    domain.FigureText(r.Least),
		Greatest: domain.FigureText(r.Greatest),
		Years:    r.Years,
	}
}

func companyChange(c domain.Change) CompanyChange {
	if c.State == "" {
		return CompanyChange{Reason: &c.Reason}
	}

	out := CompanyChange{
		State:  &c.State,
		Date:   &openapi_types.Date{Time: c.Date},
		Months: &c.Months,
	}

	if c.Rate != nil {
		rate := domain.FigureText(c.Rate)
		out.Rate = &rate
	}

	return out
}
