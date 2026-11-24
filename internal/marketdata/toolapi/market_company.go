package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func marketCompanyReports(
	ctx context.Context,
	svc Service,
	in getMarketDataIn,
) (getMarketDataOut, error) {
	reports, err := svc.CompanyReports(ctx, in.Code)
	if err != nil {
		return getMarketDataOut{}, err
	}

	out := getMarketDataOut{CompanyReports: make([]companyReportView, len(reports))}
	for i, r := range reports {
		v := companyReportView{
			Source:       r.Source,
			SourceURL:    r.SourceURL,
			Identifier:   r.Identifier,
			Name:         r.Name,
			Consolidated: r.Consolidated,
			Plan:         r.Plan,
			Financial:    r.Financial,
			Currency:     r.Currency,
			Periods:      make([]companyReportPeriodView, len(r.Periods)),
		}
		for j, p := range r.Periods {
			v.Periods[j] = companyReportPeriod(p)
		}

		out.CompanyReports[i] = v
	}

	return out, nil
}

func companyReportPeriod(p domain.CompanyReportPeriod) companyReportPeriodView {
	v := companyReportPeriodView{
		Period:             tool.DateOf(p.Period),
		Months:             p.Months,
		TotalAssets:        optionalInt(p.TotalAssets),
		CurrentAssets:      optionalInt(p.CurrentAssets),
		Cash:               optionalInt(p.Cash),
		ShortInvestments:   optionalInt(p.ShortInvestments),
		CurrentLiabilities: optionalInt(p.CurrentLiabilities),
		ShortDebt:          optionalInt(p.ShortDebt),
		LongDebt:           optionalInt(p.LongDebt),
		Equity:             optionalInt(p.Equity),
		Revenue:            optionalInt(p.Revenue),
		GrossProfit:        optionalInt(p.GrossProfit),
		NetIncome:          optionalInt(p.NetIncome),
		OperatingCashFlow:  optionalInt(p.OperatingCashFlow),
		SharesIssued:       optionalInt(p.SharesIssued),
		SharesTreasury:     optionalInt(p.SharesTreasury),
	}
	if p.CapitalRaised != nil {
		v.CapitalRaised = tool.OptionalBool{B: *p.CapitalRaised, Set: true}
	}

	if p.Delivered != nil {
		v.Delivered = tool.DateOf(*p.Delivered)
	}

	return v
}
