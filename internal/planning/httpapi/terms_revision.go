package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) reviseScheduleTerms(
	ctx context.Context,
	r *http.Request,
	in ReviseScheduleTermsJSONRequestBody,
) (Schedule, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Schedule{}, err
	}

	latest, err := pathDate(r, "effective_from")
	if err != nil {
		return Schedule{}, err
	}

	amount, rule, err := termsChanges(in)
	if err != nil {
		return Schedule{}, err
	}

	sch, err := s.svc.ReviseTerms(
		ctx,
		auth.MustBooksID(ctx),
		id,
		latest,
		in.EffectiveFrom.Time,
		amount,
		rule,
	)
	if err != nil {
		return Schedule{}, err
	}

	return s.scheduleAPI(ctx, sch)
}

func (s *Server) removeScheduleTerms(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (Schedule, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Schedule{}, err
	}

	latest, err := pathDate(r, "effective_from")
	if err != nil {
		return Schedule{}, err
	}

	sch, err := s.svc.RemoveTerms(ctx, auth.MustBooksID(ctx), id, latest)
	if err != nil {
		return Schedule{}, err
	}

	return s.scheduleAPI(ctx, sch)
}

// termsChanges returns the amount and the rule of in; an absent one is nil.
func termsChanges(in TermsInput) (*money.Money, *domain.Rule, error) {
	var amount *money.Money
	if in.Amount != nil {
		m, err := fromMoneyAPI("amount", *in.Amount)
		if err != nil {
			return nil, nil, err
		}

		amount = &m
	}

	var rule *domain.Rule
	if in.Recurrence != nil {
		rr := fromRecurrenceAPI(*in.Recurrence)
		rule = &rr
	}

	return amount, rule, nil
}

func pathDate(r *http.Request, name string) (time.Time, error) {
	d, err := time.Parse(time.DateOnly, r.PathValue(name))
	if err != nil {
		return time.Time{}, &domain.FieldError{
			Field:   name,
			Message: "must be a date YYYY-MM-DD",
			Err:     domain.ErrValidation,
		}
	}

	return d, nil
}
