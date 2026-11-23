package portfolio

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

func (p marketPort) CompanyFacts(
	ctx context.Context,
	code money.Currency,
	priceDate time.Time,
) (domain.CompanyFacts, bool, error) {
	sets, err := p.md.CompanyFigures(ctx, string(code), priceDate)
	if err != nil || len(sets) == 0 {
		return domain.CompanyFacts{}, false, err
	}

	report := sets[0].Report
	facts := domain.CompanyFacts{
		Standard: report.Plan == "standard",
		Criteria: companyCriteria(sets[0].Figures),
	}

	for _, r := range report.Periods {
		if r.Months != fiscalYearMonths {
			continue
		}

		facts.Years = append(facts.Years, domain.FiscalYear{
			End:                r.Period,
			TotalAssets:        r.TotalAssets,
			CurrentAssets:      r.CurrentAssets,
			CurrentLiabilities: r.CurrentLiabilities,
			LongDebt:           r.LongDebt,
			Revenue:            r.Revenue,
			GrossProfit:        r.GrossProfit,
			NetIncome:          r.NetIncome,
			OperatingCashFlow:  r.OperatingCashFlow,
			SharesIssued:       r.SharesIssued,
		})
	}

	if len(facts.Years) > 0 {
		facts.Criteria.YearsEnd = facts.Years[0].End
	}

	return facts, true, nil
}

// companyCriteria maps each figure to the criterion that reads it (AC10).
func companyCriteria(f marketdata.CompanyFigures) domain.CompanyCriteria {
	return domain.CompanyCriteria{
		Figures: map[string]domain.Criterion{
			"price_earnings_max":      domain.Criterion(f.PriceEarnings),
			"price_book_max":          domain.Criterion(f.PriceBook),
			"roe_min":                 domain.Criterion(f.ReturnOnEquity),
			"net_margin_min":          domain.Criterion(f.NetMargin),
			"gross_profit_assets_min": domain.Criterion(f.GrossProfitToAssets),
			"net_debt_equity_max":     domain.Criterion(f.NetDebtToEquity),
			"current_ratio_min":       domain.Criterion(f.CurrentRatio),
		},
		Growth: domain.Growth{
			Criterion: domain.Criterion(f.RevenueGrowth),
			First:     f.Growth.First,
			Last:      f.Growth.Last,
			Years:     f.Growth.Years,
		},
		PositiveYears: f.PositiveYears.Positive,
		FiscalYears:   f.PositiveYears.Years,
	}
}
