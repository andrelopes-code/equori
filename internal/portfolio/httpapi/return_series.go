package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

func (s *Server) getReturnSeries(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (ReturnSeries, error) {
	params, err := httpserver.Query[GetReturnSeriesParams](r)
	if err != nil {
		return ReturnSeries{}, err
	}

	var in money.Currency
	if params.ValueIn != nil {
		in = money.Currency(*params.ValueIn)
	}

	var account uuid.UUID
	if params.AccountId != nil {
		account = *params.AccountId
	}

	var from time.Time
	if params.From != nil {
		from = params.From.Time
	}

	res, err := s.svc.ReturnSeries(
		ctx,
		auth.MustBooksID(ctx),
		account,
		from,
		params.To.Time,
		in,
		string(params.Step),
	)
	if err != nil {
		return ReturnSeries{}, err
	}

	return toReturnSeriesAPI(res), nil
}

func toReturnSeriesAPI(res app.ReturnSeries) ReturnSeries {
	out := ReturnSeries{
		From:     date(res.From),
		To:       date(res.To),
		Currency: string(res.Currency),
		Opening:  res.Opening,
		Points:   make([]ReturnSeriesPoint, len(res.Points)),
		Indexes:  make([]ReturnSeriesIndex, len(res.Indexes)),
	}

	for i, p := range res.Points {
		out.Points[i] = ReturnSeriesPoint{
			Date:     date(p.Date),
			Value:    p.Value,
			Flows:    p.Flows,
			ReturnBp: p.ReturnBP,
		}
	}

	for i, x := range res.Indexes {
		out.Indexes[i] = toReturnSeriesIndexAPI(x)
	}

	return out
}

func toReturnSeriesIndexAPI(x app.IndexSeries) ReturnSeriesIndex {
	points := make([]ReturnSeriesIndexPoint, len(x.Points))
	for i, p := range x.Points {
		points[i] = ReturnSeriesIndexPoint{Date: date(p.Date), ReturnBp: p.ReturnBP}
	}

	return ReturnSeriesIndex{
		Index:  x.Index,
		Period: ReturnSeriesIndexPeriod(x.Period),
		Points: points,
	}
}
