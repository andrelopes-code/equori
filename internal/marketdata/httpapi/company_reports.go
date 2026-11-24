package httpapi

import (
	"context"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) listCompanyReports(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (CompanyReportList, error) {
	reports, err := s.svc.CompanyReports(ctx, r.URL.Query().Get("code"))
	if err != nil {
		return CompanyReportList{}, err
	}

	items := make([]CompanyReport, len(reports))
	for i, c := range reports {
		periods := make([]CompanyReportPeriod, len(c.Periods))
		for j, p := range c.Periods {
			periods[j] = companyReportPeriod(p)
		}

		items[i] = CompanyReport{
			Source:       c.Source,
			SourceUrl:    c.SourceURL,
			Identifier:   c.Identifier,
			Name:         c.Name,
			Consolidated: c.Consolidated,
			Plan:         c.Plan,
			Financial:    c.Financial,
			Currency:     c.Currency,
			Periods:      periods,
		}
	}

	return CompanyReportList{Items: items}, nil
}

func companyReportPeriod(p domain.CompanyReportPeriod) CompanyReportPeriod {
	return CompanyReportPeriod{
		Period:             openapi_types.Date{Time: p.Period},
		Months:             p.Months,
		Delivered:          date(p.Delivered),
		TotalAssets:        p.TotalAssets,
		CurrentAssets:      p.CurrentAssets,
		Cash:               p.Cash,
		ShortInvestments:   p.ShortInvestments,
		CurrentLiabilities: p.CurrentLiabilities,
		ShortDebt:          p.ShortDebt,
		LongDebt:           p.LongDebt,
		Equity:             p.Equity,
		Revenue:            p.Revenue,
		GrossProfit:        p.GrossProfit,
		NetIncome:          p.NetIncome,
		OperatingCashFlow:  p.OperatingCashFlow,
		SharesIssued:       p.SharesIssued,
		SharesTreasury:     p.SharesTreasury,
		CapitalRaised:      p.CapitalRaised,
	}
}
