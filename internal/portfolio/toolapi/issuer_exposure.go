package toolapi

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

type issuerExposureView struct {
	Key            string     `json:"key,omitzero"`
	Issuer         string     `json:"issuer,omitzero"`
	MarketValue    tool.Money `json:"market_value"`
	CoveredValue   tool.Money `json:"covered_value"`
	UncoveredValue tool.Money `json:"uncovered_value"`
	Limit          tool.Money `json:"limit,omitzero"`
	Excess         tool.Money `json:"excess,omitzero"`
}

type guaranteeView struct {
	Name           string     `json:"name"`
	LimitPerIssuer tool.Money `json:"limit_per_issuer"`
	LimitPerPeriod tool.Money `json:"limit_per_period"`
	PeriodYears    int        `json:"period_years"`
}

func issuerExposureResult(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	date time.Time,
) (getPortfolioOut, error) {
	e, err := svc.IssuerExposure(ctx, booksID, date)
	if err != nil {
		return getPortfolioOut{}, err
	}

	out := getPortfolioOut{
		Issuers:       []issuerExposureView{},
		PeriodNote:    e.PeriodNote,
		MissingPrices: make([]string, len(e.MissingPrices)),
	}
	for i, c := range e.MissingPrices {
		out.MissingPrices[i] = string(c)
	}

	for _, x := range e.Issuers {
		v := issuerExposureView{
			Key:            x.Key,
			Issuer:         x.Issuer,
			MarketValue:    tool.MoneyOf(x.MarketValue),
			CoveredValue:   tool.MoneyOf(x.CoveredValue),
			UncoveredValue: tool.MoneyOf(x.UncoveredValue),
		}
		if x.Limit != nil {
			v.Limit = tool.MoneyOf(*x.Limit)
		}

		if x.Excess != nil {
			v.Excess = tool.MoneyOf(*x.Excess)
		}

		out.Issuers = append(out.Issuers, v)
	}

	if g := e.Guarantee; g != nil {
		out.Guarantee = guaranteeView{
			Name:           g.Name,
			LimitPerIssuer: tool.MoneyOf(g.LimitPerIssuer),
			LimitPerPeriod: tool.MoneyOf(g.LimitPerPeriod),
			PeriodYears:    g.PeriodYears,
		}
	}

	return out, nil
}
