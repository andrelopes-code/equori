package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/problem"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

const monthLayout = "2006-01"

func (s *Server) listOpeningLosses(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (OpeningLossSet, error) {
	set, _, err := s.openingLossSet(ctx, auth.MustBooksID(ctx))

	return set, err
}

func (s *Server) saveOpeningLosses(
	ctx context.Context,
	_ *http.Request,
	in OpeningLossList,
) (OpeningLossSet, error) {
	booksID := auth.MustBooksID(ctx)

	_, base, err := s.openingLossSet(ctx, booksID)
	if err != nil {
		return OpeningLossSet{}, err
	}

	losses, err := openingLosses(in.Losses, base)
	if err != nil {
		return OpeningLossSet{}, err
	}

	if err := s.svc.SaveOpeningLosses(ctx, booksID, losses); err != nil {
		return OpeningLossSet{}, err
	}

	set, _, err := s.openingLossSet(ctx, booksID)

	return set, err
}

func (s *Server) openingLossSet(
	ctx context.Context,
	booksID int64,
) (OpeningLossSet, money.Currency, error) {
	pools, losses, base, err := s.svc.OpeningLosses(ctx, booksID)
	if err != nil {
		return OpeningLossSet{}, "", err
	}

	out := OpeningLossSet{Pools: pools, Losses: make([]OpeningLoss, len(losses))}
	if out.Pools == nil {
		out.Pools = []string{}
	}

	for i, l := range losses {
		out.Losses[i] = OpeningLoss{
			Pool:   l.Pool,
			Month:  l.Month.Format(monthLayout),
			Amount: Money{Amount: l.Amount, Currency: string(base)},
		}
	}

	return out, base, nil
}

func openingLosses(in []OpeningLoss, base money.Currency) ([]domain.OpeningLoss, error) {
	out := make([]domain.OpeningLoss, len(in))

	for i, l := range in {
		month, err := time.Parse(monthLayout, l.Month)
		if err != nil {
			return nil, &app.OpeningLossError{
				Field:   itemField(i, "month"),
				Message: "must be a month",
			}
		}

		if l.Amount.Currency != string(base) {
			return nil, &app.OpeningLossError{
				Field:   itemField(i, "amount"),
				Message: "must be in the base currency " + string(base),
			}
		}

		out[i] = domain.OpeningLoss{Pool: l.Pool, Month: month, Amount: l.Amount.Amount}
	}

	return out, nil
}

func itemField(i int, name string) string { return fmt.Sprintf("losses[%d].%s", i, name) }

func openingLossProblem(err error) (problem.Details, bool) {
	e, ok := errors.AsType[*app.OpeningLossError](err)
	if !ok {
		return problem.Details{}, false
	}

	d := problem.New(http.StatusUnprocessableEntity, "validation_failed", e.Error())
	d.Errors = []problem.FieldError{{Field: e.Field, Message: e.Message}}

	return d, true
}
