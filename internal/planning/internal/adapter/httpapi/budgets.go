package httpapi

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

const monthLayout = "2006-01"

// parseMonth reads YYYY-MM; the contract checks the shape, the month number is checked here.
func parseMonth(field, s string) (time.Time, error) {
	m, err := time.Parse(monthLayout, s)
	if err != nil {
		return time.Time{}, &domain.FieldError{Field: field, Message: "must be a month YYYY-MM", Err: domain.ErrValidation}
	}
	return m, nil
}

func toBudgetAPI(b domain.Budget) Budget {
	out := Budget{Id: b.ID, CategoryId: b.CategoryID, Rollover: b.Rollover, Amounts: make([]BudgetAmount, len(b.Amounts))}
	for i, a := range b.Amounts {
		out.Amounts[i] = BudgetAmount{EffectiveFrom: a.EffectiveFrom.Format(monthLayout), Amount: toMoneyAPI(a.Amount, b.Currency)}
	}
	return out
}

func (s *Server) CreateBudget(ctx context.Context, req CreateBudgetRequestObject) (CreateBudgetResponseObject, error) {
	amount, err := fromMoneyAPI("amount", req.Body.Amount)
	if err != nil {
		return nil, err
	}
	from, err := parseMonth("effective_from", req.Body.EffectiveFrom)
	if err != nil {
		return nil, err
	}
	b, err := s.svc.CreateBudget(ctx, auth.MustUserID(ctx), req.Body.CategoryId, amount, from, req.Body.Rollover)
	if err != nil {
		return nil, err
	}
	return CreateBudget201JSONResponse{Body: toBudgetAPI(b), Headers: CreateBudget201ResponseHeaders{Location: location("/budgets/", b.ID)}}, nil
}

func (s *Server) GetBudget(ctx context.Context, req GetBudgetRequestObject) (GetBudgetResponseObject, error) {
	b, err := s.svc.Budget(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	return GetBudget200JSONResponse(toBudgetAPI(b)), nil
}

func (s *Server) ListBudgets(ctx context.Context, req ListBudgetsRequestObject) (ListBudgetsResponseObject, error) {
	p, err := listPage[app.IDKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	bs, next, err := s.svc.ListBudgets(ctx, auth.MustUserID(ctx), p)
	if err != nil {
		return nil, err
	}
	out := ListBudgets200JSONResponse{Items: make([]Budget, len(bs))}
	for i, b := range bs {
		out.Items[i] = toBudgetAPI(b)
	}
	out.NextCursor, err = page.Next(next)
	return out, err
}

func (s *Server) AddBudgetAmount(ctx context.Context, req AddBudgetAmountRequestObject) (AddBudgetAmountResponseObject, error) {
	amount, err := fromMoneyAPI("amount", req.Body.Amount)
	if err != nil {
		return nil, err
	}
	from, err := parseMonth("effective_from", req.Body.EffectiveFrom)
	if err != nil {
		return nil, err
	}
	b, err := s.svc.AddBudgetAmount(ctx, auth.MustUserID(ctx), req.Id, from, amount)
	if err != nil {
		return nil, err
	}
	return AddBudgetAmount201JSONResponse(toBudgetAPI(b)), nil
}

func (s *Server) GetBudgetProgress(ctx context.Context, req GetBudgetProgressRequestObject) (GetBudgetProgressResponseObject, error) {
	month, err := parseMonth("month", req.Params.Month)
	if err != nil {
		return nil, err
	}
	p, currency, err := s.svc.BudgetProgress(ctx, auth.MustUserID(ctx), req.Id, month)
	if err != nil {
		return nil, err
	}
	return GetBudgetProgress200JSONResponse{
		Month: p.Month.Format(monthLayout), Planned: toMoneyAPI(p.Planned, currency), Carried: toMoneyAPI(p.Carried, currency),
		Spent: toMoneyAPI(p.Spent, currency), Available: toMoneyAPI(p.Available, currency),
	}, nil
}
