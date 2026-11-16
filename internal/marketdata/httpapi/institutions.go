package httpapi

import (
	"context"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

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

	return InstitutionIndicators{
		Source:           x.Source,
		SourceUrl:        x.SourceURL,
		Period:           openapi_types.Date{Time: x.Period},
		Currency:         x.Currency,
		ConglomerateCode: x.ConglomerateCode,
		ConglomerateName: x.ConglomerateName,
		Basel:            x.Basel,
		PrincipalCapital: x.PrincipalCapital,
		FixedAsset:       x.FixedAsset,
		Equity:           x.Equity,
		NetIncome:        x.NetIncome,
	}, nil
}
