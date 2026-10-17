package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) GetProjection(ctx context.Context, req GetProjectionRequestObject) (GetProjectionResponseObject, error) {
	p, err := s.svc.Project(ctx, auth.MustUserID(ctx), req.Id, req.Params.To.Time)
	if err != nil {
		return nil, err
	}
	out := GetProjection200JSONResponse{
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

func (s *Server) GetCommitted(ctx context.Context, req GetCommittedRequestObject) (GetCommittedResponseObject, error) {
	month, err := parseMonth("month", req.Params.Month)
	if err != nil {
		return nil, err
	}
	c, err := s.svc.Committed(ctx, auth.MustUserID(ctx), month)
	if err != nil {
		return nil, err
	}
	return GetCommitted200JSONResponse{
		Month: c.Month.Format(monthLayout), Installments: toMoneyAPI(c.Installments, c.Currency),
		Occurrences: toMoneyAPI(c.Occurrences, c.Currency), Total: toMoneyAPI(c.Total, c.Currency), Prices: toPricesAPI(c.Prices),
	}, nil
}
