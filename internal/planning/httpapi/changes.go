package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) skipOccurrence(ctx context.Context, r *http.Request, in SkipOccurrenceJSONRequestBody) (Occurrence, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Occurrence{}, err
	}

	var reason string
	if in.Reason != nil {
		reason = *in.Reason
	}

	o, err := s.svc.Skip(ctx, auth.MustBooksID(ctx), id, reason)
	if err != nil {
		return Occurrence{}, err
	}

	return toOccurrenceAPI(o), nil
}

func (s *Server) moveOccurrence(ctx context.Context, r *http.Request, in MoveOccurrenceJSONRequestBody) (Occurrence, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Occurrence{}, err
	}

	o, err := s.svc.Move(ctx, auth.MustBooksID(ctx), id, in.Date.Time)
	if err != nil {
		return Occurrence{}, err
	}

	return toOccurrenceAPI(o), nil
}

func (s *Server) changeScheduleTerms(ctx context.Context, r *http.Request, in ChangeScheduleTermsJSONRequestBody) (Schedule, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Schedule{}, err
	}

	var amount *money.Money
	if in.Amount != nil {
		m, err := fromMoneyAPI("amount", *in.Amount)
		if err != nil {
			return Schedule{}, err
		}

		amount = &m
	}

	var rule *domain.Rule
	if in.Recurrence != nil {
		rr := fromRecurrenceAPI(*in.Recurrence)
		rule = &rr
	}

	sch, err := s.svc.ChangeTerms(ctx, auth.MustBooksID(ctx), id, in.EffectiveFrom.Time, amount, rule)
	if err != nil {
		return Schedule{}, err
	}

	return toScheduleAPI(sch), nil
}

func (s *Server) updateScheduleMatching(ctx context.Context, r *http.Request, in UpdateScheduleMatchingJSONRequestBody) (Schedule, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Schedule{}, err
	}

	change := app.ScheduleChange{
		Description: in.Description,
		ToleranceBP: in.MatchToleranceBp,
		GraceDays:   in.GraceDays,
		WindowDays:  in.MatchWindowDays,
	}

	if in.StartsOn != nil {
		change.StartsOn = &in.StartsOn.Time
	}

	sch, err := s.svc.Update(ctx, auth.MustBooksID(ctx), id, change)
	if err != nil {
		return Schedule{}, err
	}

	return toScheduleAPI(sch), nil
}

func (s *Server) pauseSchedule(ctx context.Context, r *http.Request, in PauseScheduleJSONRequestBody) (Schedule, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Schedule{}, err
	}

	sch, err := s.svc.Pause(ctx, auth.MustBooksID(ctx), id, in.From.Time, in.To.Time)
	if err != nil {
		return Schedule{}, err
	}

	return toScheduleAPI(sch), nil
}

func (s *Server) endSchedule(ctx context.Context, r *http.Request, in EndScheduleJSONRequestBody) (Schedule, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Schedule{}, err
	}

	sch, err := s.svc.End(ctx, auth.MustBooksID(ctx), id, in.From.Time)
	if err != nil {
		return Schedule{}, err
	}

	return toScheduleAPI(sch), nil
}
