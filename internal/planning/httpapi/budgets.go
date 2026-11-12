package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

const monthLayout = "2006-01"

// parseMonth reads YYYY-MM; the contract checks the shape, the month number is checked here.
func parseMonth(field, s string) (time.Time, error) {
	m, err := time.Parse(monthLayout, s)
	if err != nil {
		return time.Time{}, &domain.FieldError{
			Field:   field,
			Message: "must be a month YYYY-MM",
			Err:     domain.ErrValidation,
		}
	}

	return m, nil
}

func toBudgetAPI(b domain.Budget) Budget {
	out := Budget{
		Id:         b.ID,
		CategoryId: b.CategoryID,
		Rollover:   b.Rollover,
		Amounts:    make([]BudgetAmount, len(b.Amounts)),
	}
	for i, a := range b.Amounts {
		out.Amounts[i] = BudgetAmount{
			EffectiveFrom: a.EffectiveFrom.Format(monthLayout),
			Amount:        toMoneyAPI(a.Amount, b.Currency),
		}
	}

	return out
}

func (s *Server) createBudget(
	ctx context.Context, _ *http.Request, in CreateBudgetJSONRequestBody,
) (Budget, string, error) {
	b, err := s.addBudget(ctx, in)
	if err != nil {
		return Budget{}, "", err
	}

	return toBudgetAPI(b), BaseURL + "/budgets/" + b.ID.String(), nil
}

func (s *Server) getBudget(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (Budget, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Budget{}, err
	}

	b, err := s.svc.Budget(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return Budget{}, err
	}

	return toBudgetAPI(b), nil
}

func (s *Server) deleteBudget(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.DeleteBudget(ctx, auth.MustBooksID(ctx), id); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func (s *Server) listBudgets(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (BudgetPage, error) {
	params, err := httpserver.Query[ListBudgetsParams](r)
	if err != nil {
		return BudgetPage{}, err
	}

	p, err := listPage[app.IDKey](params.Limit, params.Cursor)
	if err != nil {
		return BudgetPage{}, err
	}

	bs, next, err := s.svc.ListBudgets(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return BudgetPage{}, err
	}

	out := BudgetPage{Items: make([]Budget, len(bs))}
	for i, b := range bs {
		out.Items[i] = toBudgetAPI(b)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) addBudgetAmount(
	ctx context.Context,
	r *http.Request,
	in AddBudgetAmountJSONRequestBody,
) (Budget, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Budget{}, err
	}

	amount, err := fromMoneyAPI("amount", in.Amount)
	if err != nil {
		return Budget{}, err
	}

	from, err := parseMonth("effective_from", in.EffectiveFrom)
	if err != nil {
		return Budget{}, err
	}

	b, err := s.svc.AddBudgetAmount(ctx, auth.MustBooksID(ctx), id, from, amount)
	if err != nil {
		return Budget{}, err
	}

	return toBudgetAPI(b), nil
}

func (s *Server) getBudgetProgress(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (BudgetProgress, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return BudgetProgress{}, err
	}

	params, err := httpserver.Query[GetBudgetProgressParams](r)
	if err != nil {
		return BudgetProgress{}, err
	}

	month, err := parseMonth("month", params.Month)
	if err != nil {
		return BudgetProgress{}, err
	}

	p, currency, err := s.svc.BudgetProgress(ctx, auth.MustBooksID(ctx), id, month)
	if err != nil {
		return BudgetProgress{}, err
	}

	return BudgetProgress{
		Month: p.Month.Format(
			monthLayout,
		),
		Planned:   toMoneyAPI(p.Planned, currency),
		Carried:   toMoneyAPI(p.Carried, currency),
		Spent:     toMoneyAPI(p.Spent, currency),
		Available: toMoneyAPI(p.Available, currency),
	}, nil
}

func (s *Server) addBudget(
	ctx context.Context,
	in CreateBudgetJSONRequestBody,
) (domain.Budget, error) {
	amount, err := fromMoneyAPI("amount", in.Amount)
	if err != nil {
		return domain.Budget{}, err
	}

	from, err := parseMonth("effective_from", in.EffectiveFrom)
	if err != nil {
		return domain.Budget{}, err
	}

	return s.svc.CreateBudget(ctx, auth.MustBooksID(ctx), in.CategoryId, amount, from, in.Rollover)
}
