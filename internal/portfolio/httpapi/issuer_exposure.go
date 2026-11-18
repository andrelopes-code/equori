package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

func (s *Server) getIssuerExposure(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (IssuerExposureReport, error) {
	params, err := httpserver.Query[GetIssuerExposureParams](r)
	if err != nil {
		return IssuerExposureReport{}, err
	}

	var on time.Time
	if params.Date != nil {
		on = params.Date.Time
	}

	res, err := s.svc.IssuerExposure(ctx, auth.MustBooksID(ctx), on)
	if err != nil {
		return IssuerExposureReport{}, err
	}

	return issuerExposureReport(res), nil
}

func issuerExposureReport(e app.Exposure) IssuerExposureReport {
	out := IssuerExposureReport{
		Date:          date(e.Date),
		Issuers:       make([]IssuerExposure, len(e.Issuers)),
		PeriodNote:    e.PeriodNote,
		MissingPrices: make([]string, len(e.MissingPrices)),
	}

	for i, x := range e.Issuers {
		out.Issuers[i] = IssuerExposure{
			MarketValue:    toMoney(x.MarketValue),
			CoveredValue:   toMoney(x.CoveredValue),
			UncoveredValue: toMoney(x.UncoveredValue),
			SovereignValue: toMoney(x.SovereignValue),
			SpecialValue:   toMoney(x.SpecialValue),
			Limit:          optionalMoney(x.Limit),
			Excess:         optionalMoney(x.Excess),
		}
		if x.Key != "" {
			out.Issuers[i].Key = &x.Key
		}

		if x.Issuer != "" {
			out.Issuers[i].Issuer = &x.Issuer
		}
	}

	for i, c := range e.MissingPrices {
		out.MissingPrices[i] = string(c)
	}

	if g := e.Guarantee; g != nil {
		out.Guarantee = &DepositGuarantee{
			Name:           g.Name,
			LimitPerIssuer: toMoney(g.LimitPerIssuer),
			LimitPerPeriod: toMoney(g.LimitPerPeriod),
			PeriodYears:    g.PeriodYears,
			Covered:        g.CoveredSubtypes(),
		}
		if special := g.SpecialSubtypes(); len(special) > 0 {
			limit := toMoney(g.SpecialLimit)
			out.Guarantee.SpecialLimit, out.Guarantee.Special = &limit, &special
		}
	}

	return out
}
