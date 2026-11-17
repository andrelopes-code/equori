package httpapi

import (
	"context"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) listCurves(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (CurveList, error) {
	cs, err := s.svc.Curves(ctx)
	if err != nil {
		return CurveList{}, err
	}

	items := make([]Curve, len(cs))
	for i, c := range cs {
		points := make([]CurvePoint, len(c.Points))
		for j, p := range c.Points {
			points[j] = CurvePoint{Maturity: openapi_types.Date{Time: p.Maturity}, Rate: p.Rate}
		}

		items[i] = Curve{
			Id:       c.ID,
			Kind:     c.Kind,
			Index:    nullable(c.Index),
			Currency: c.Currency,
			BaseDate: openapi_types.Date{Time: c.Base},
			Source:   c.Source,
			Points:   points,
		}
	}

	return CurveList{Items: items}, nil
}

// nullable maps the empty index of a nominal curve to null.
func nullable(s string) *string {
	if s == "" {
		return nil
	}

	return &s
}
