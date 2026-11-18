package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) listFixedIncomeEvents(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (FixedIncomeEventList, error) {
	params, err := httpserver.Query[ListFixedIncomeEventsParams](r)
	if err != nil {
		return FixedIncomeEventList{}, err
	}

	es, err := s.svc.FixedIncomeEvents(
		ctx,
		auth.MustBooksID(ctx),
		params.From.Time,
		params.To.Time,
	)
	if err != nil {
		return FixedIncomeEventList{}, err
	}

	items := make([]FixedIncomeEvent, len(es))
	for i, e := range es {
		items[i] = FixedIncomeEvent{
			AccountId:   e.AccountID,
			Instrument:  string(e.Instrument),
			Date:        date(e.Date),
			Kind:        e.Kind,
			Quantity:    toMoney(e.Quantity),
			Gross:       optionalMoney(e.Gross),
			RateMissing: e.RateMissing,
			State:       FixedIncomeEventState(e.State),

			EstimatedTax: optionalMoney(e.EstimatedTax),
		}
	}

	return FixedIncomeEventList{Items: items}, nil
}
