package httpapi

import (
	"context"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) listIndexes(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (IndexList, error) {
	xs, err := s.svc.Indexes(ctx)
	if err != nil {
		return IndexList{}, err
	}

	items := make([]Index, len(xs))
	for i, x := range xs {
		items[i] = Index{
			Id:       x.ID,
			Period:   IndexPeriod(x.Period),
			First:    openapi_types.Date{Time: x.First},
			Last:     openapi_types.Date{Time: x.Last},
			Expected: x.Expected,
		}
	}

	return IndexList{Items: items}, nil
}

func (s *Server) listIndexRates(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (IndexRateList, error) {
	params, err := httpserver.Query[ListIndexRatesParams](r)
	if err != nil {
		return IndexRateList{}, err
	}

	rs, err := s.svc.IndexRates(ctx, r.PathValue("id"), params.From.Time, params.To.Time)
	if err != nil {
		return IndexRateList{}, err
	}

	items := make([]IndexRate, len(rs))
	for i, rate := range rs {
		items[i] = IndexRate{Date: openapi_types.Date{Time: rate.Date}, Rate: rate.Rate}
	}

	return IndexRateList{Items: items}, nil
}

func (s *Server) listIndexExpectations(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (IndexExpectations, error) {
	x, err := s.svc.Expectations(ctx, r.PathValue("id"))
	if err != nil {
		return IndexExpectations{}, err
	}

	items := make([]IndexExpectation, len(x.Points))
	for i, p := range x.Points {
		items[i] = IndexExpectation{Date: openapi_types.Date{Time: p.Date}, Rate: p.Rate}
	}

	return IndexExpectations{SurveyDate: openapi_types.Date{Time: x.SurveyDate}, Items: items}, nil
}
