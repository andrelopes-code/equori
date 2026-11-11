package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) getProjection(ctx context.Context, r *http.Request, _ httpserver.None) (Projection, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Projection{}, err
	}

	params, err := httpserver.Query[GetProjectionParams](r)
	if err != nil {
		return Projection{}, err
	}

	p, err := s.svc.Project(ctx, auth.MustBooksID(ctx), id, params.To.Time)
	if err != nil {
		return Projection{}, err
	}

	out := Projection{
		AccountId: p.AccountID, From: apiDate(p.From), To: apiDate(p.To),
		Opening: toMoneyAPI(p.Opening, p.Currency), Closing: toMoneyAPI(p.Closing, p.Currency),
		Points: make([]ProjectionPoint, len(p.Points)),
	}
	for i, pt := range p.Points {
		out.Points[i] = ProjectionPoint{
			Date: apiDate(pt.Date), OccurrenceId: pt.OccurrenceID, ScheduleId: pt.ScheduleID,
			Amount: toMoneyAPI(pt.Amount, p.Currency), Balance: toMoneyAPI(pt.Balance, p.Currency),
		}
	}

	return out, nil
}

func (s *Server) getCommitted(ctx context.Context, r *http.Request, _ httpserver.None) (Committed, error) {
	params, err := httpserver.Query[GetCommittedParams](r)
	if err != nil {
		return Committed{}, err
	}

	month, err := parseMonth("month", params.Month)
	if err != nil {
		return Committed{}, err
	}

	c, err := s.svc.Committed(ctx, auth.MustBooksID(ctx), month)
	if err != nil {
		return Committed{}, err
	}

	return Committed{
		Month: c.Month.Format(monthLayout), Installments: toMoneyAPI(c.Installments, c.Currency),
		Occurrences: toMoneyAPI(c.Occurrences, c.Currency), Total: toMoneyAPI(c.Total, c.Currency), Prices: toPricesAPI(c.Prices),
	}, nil
}
