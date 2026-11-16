package httpapi

import (
	"context"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) getInstitutionIndicators(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (InstitutionIndicators, error) {
	q := r.URL.Query()

	x, err := s.svc.InstitutionIndicators(ctx, q.Get("scheme"), q.Get("identifier"))
	if err != nil {
		return InstitutionIndicators{}, err
	}

	periods := make([]InstitutionPeriod, len(x.Periods))
	for i, p := range x.Periods {
		periods[i] = InstitutionPeriod{
			Period:           openapi_types.Date{Time: p.Period},
			Basel:            p.Basel,
			PrincipalCapital: p.PrincipalCapital,
			FixedAsset:       p.FixedAsset,
			Equity:           p.Equity,
			NetIncome:        p.NetIncome,
		}
	}

	return InstitutionIndicators{
		Source:           x.Source,
		SourceUrl:        x.SourceURL,
		Currency:         x.Currency,
		ConglomerateCode: x.ConglomerateCode,
		ConglomerateName: x.ConglomerateName,
		Limits:           limitsOf(x.Limits),
		Periods:          periods,
	}, nil
}

func limitsOf(l domain.InstitutionLimits) InstitutionLimits {
	return InstitutionLimits{
		Basel: InstitutionFloor{
			Minimum:    l.Basel.Minimum,
			WithBuffer: l.Basel.WithBuffer,
		},
		PrincipalCapital: InstitutionFloor{
			Minimum:    l.PrincipalCapital.Minimum,
			WithBuffer: l.PrincipalCapital.WithBuffer,
		},
		Rule: l.Rule,
	}
}
