package httpapi

import (
	"context"

	openapi_types "github.com/oapi-codegen/runtime/types"
)

func (s *Server) ListIndexes(ctx context.Context, _ ListIndexesRequestObject) (ListIndexesResponseObject, error) {
	xs, err := s.svc.Indexes(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]Index, len(xs))
	for i, x := range xs {
		items[i] = Index{Id: x.ID, Period: IndexPeriod(x.Period), First: openapi_types.Date{Time: x.First}, Last: openapi_types.Date{Time: x.Last}}
	}
	return ListIndexes200JSONResponse{Items: items}, nil
}

func (s *Server) ListIndexRates(ctx context.Context, req ListIndexRatesRequestObject) (ListIndexRatesResponseObject, error) {
	rs, err := s.svc.IndexRates(ctx, req.Id, req.Params.From.Time, req.Params.To.Time)
	if err != nil {
		return nil, err
	}
	items := make([]IndexRate, len(rs))
	for i, r := range rs {
		items[i] = IndexRate{Date: openapi_types.Date{Time: r.Date}, Rate: r.Rate}
	}
	return ListIndexRates200JSONResponse{Items: items}, nil
}
