package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) SkipOccurrence(ctx context.Context, req SkipOccurrenceRequestObject) (SkipOccurrenceResponseObject, error) {
	var reason string
	if req.Body.Reason != nil {
		reason = *req.Body.Reason
	}
	o, err := s.svc.Skip(ctx, auth.MustUserID(ctx), req.Id, reason)
	if err != nil {
		return nil, err
	}
	return SkipOccurrence200JSONResponse(toOccurrenceAPI(o)), nil
}

func (s *Server) MoveOccurrence(ctx context.Context, req MoveOccurrenceRequestObject) (MoveOccurrenceResponseObject, error) {
	o, err := s.svc.Move(ctx, auth.MustUserID(ctx), req.Id, req.Body.Date.Time)
	if err != nil {
		return nil, err
	}
	return MoveOccurrence200JSONResponse(toOccurrenceAPI(o)), nil
}

func (s *Server) ChangeScheduleTerms(ctx context.Context, req ChangeScheduleTermsRequestObject) (ChangeScheduleTermsResponseObject, error) {
	var amount *money.Money
	if req.Body.Amount != nil {
		m, err := fromMoneyAPI("amount", *req.Body.Amount)
		if err != nil {
			return nil, err
		}
		amount = &m
	}
	var rule *domain.Rule
	if req.Body.Recurrence != nil {
		r := fromRecurrenceAPI(*req.Body.Recurrence)
		rule = &r
	}
	sch, err := s.svc.ChangeTerms(ctx, auth.MustUserID(ctx), req.Id, req.Body.EffectiveFrom.Time, amount, rule)
	if err != nil {
		return nil, err
	}
	return ChangeScheduleTerms201JSONResponse(toScheduleAPI(sch)), nil
}

func (s *Server) PauseSchedule(ctx context.Context, req PauseScheduleRequestObject) (PauseScheduleResponseObject, error) {
	sch, err := s.svc.Pause(ctx, auth.MustUserID(ctx), req.Id, req.Body.From.Time, req.Body.To.Time)
	if err != nil {
		return nil, err
	}
	return PauseSchedule201JSONResponse(toScheduleAPI(sch)), nil
}

func (s *Server) EndSchedule(ctx context.Context, req EndScheduleRequestObject) (EndScheduleResponseObject, error) {
	sch, err := s.svc.End(ctx, auth.MustUserID(ctx), req.Id, req.Body.From.Time)
	if err != nil {
		return nil, err
	}
	return EndSchedule200JSONResponse(toScheduleAPI(sch)), nil
}
