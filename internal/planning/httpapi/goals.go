package httpapi

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toGoalAPI(g app.GoalView) Goal {
	out := Goal{
		Id:              g.ID,
		Name:            g.Name,
		Target:          toMoneyAPI(g.Target, g.Currency),
		DueOn:           apiDate(g.DueOn),
		AccountIds:      g.AccountIDs,
		CountsAsSavings: g.CountsAsSavings,
		Current: toMoneyAPI(
			g.Progress.Current,
			g.Currency,
		),
		Remaining:  toMoneyAPI(g.Progress.Remaining, g.Currency),
		ProgressBp: g.Progress.ProgressBP,
		Spent:      toMoneyAPI(g.Spent.Amount(), g.Spent.Currency()),
		Prices:     toPricesAPI(g.Prices),
		Parts:      toGoalPartsAPI(g.Parts),
	}
	if g.Withdrawal != nil {
		out.UnexplainedWithdrawal = &GoalWithdrawal{
			Amount: toMoneyAPI(g.Withdrawal.Amount.Amount(), g.Withdrawal.Amount.Currency()),
			Since:  apiDate(g.Withdrawal.Since),
		}
	}

	if g.Trailing != nil {
		out.TrailingReturn = &TrailingReturn{
			PeriodMonths: g.Trailing.Months,
			AnnualBp:     g.Trailing.BP,
		}
	}

	return out
}

func toGoalPartsAPI(ps []app.ValuedPart) *[]GoalPart {
	if len(ps) == 0 {
		return nil
	}

	out := make([]GoalPart, len(ps))
	for i, p := range ps {
		out[i] = GoalPart{
			AccountId:  p.AccountID,
			Instrument: string(p.Instrument),
			Quantity: toMoneyAPI(
				p.Quantity.Amount(),
				p.Quantity.Currency(),
			),
			Value: toMoneyAPI(p.Value.Amount(), p.Value.Currency()),
		}
	}

	return &out
}

func (s *Server) createGoal(
	ctx context.Context, _ *http.Request, in CreateGoalJSONRequestBody,
) (Goal, string, error) {
	g, err := s.addGoal(ctx, in)
	if err != nil {
		return Goal{}, "", err
	}

	return toGoalAPI(g), BaseURL + "/goals/" + g.ID.String(), nil
}

func (s *Server) updateGoal(
	ctx context.Context,
	r *http.Request,
	in UpdateGoalJSONRequestBody,
) (Goal, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Goal{}, err
	}

	patch := app.GoalPatch{
		Name:            in.Name,
		AccountIDs:      in.AccountIds,
		CountsAsSavings: in.CountsAsSavings,
	}
	if in.Target != nil {
		target, err := fromMoneyAPI("target", *in.Target)
		if err != nil {
			return Goal{}, err
		}

		patch.Target = &target
	}

	if in.DueOn != nil {
		patch.DueOn = &in.DueOn.Time
	}

	g, err := s.svc.UpdateGoal(ctx, auth.MustBooksID(ctx), id, patch)
	if err != nil {
		return Goal{}, err
	}

	return toGoalAPI(g), nil
}

func (s *Server) deleteGoal(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.DeleteGoal(ctx, auth.MustBooksID(ctx), id); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func (s *Server) getGoal(ctx context.Context, r *http.Request, _ httpserver.None) (Goal, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Goal{}, err
	}

	g, err := s.svc.Goal(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return Goal{}, err
	}

	return toGoalAPI(g), nil
}

func (s *Server) listGoals(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (GoalPage, error) {
	params, err := httpserver.Query[ListGoalsParams](r)
	if err != nil {
		return GoalPage{}, err
	}

	p, err := listPage[app.IDKey](params.Limit, params.Cursor)
	if err != nil {
		return GoalPage{}, err
	}

	gs, next, err := s.svc.ListGoals(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return GoalPage{}, err
	}

	out := GoalPage{Items: make([]Goal, len(gs))}
	for i, g := range gs {
		out.Items[i] = toGoalAPI(g)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) addGoal(ctx context.Context, in CreateGoalJSONRequestBody) (app.GoalView, error) {
	target, err := fromMoneyAPI("target", in.Target)
	if err != nil {
		return app.GoalView{}, err
	}

	return s.svc.CreateGoal(
		ctx,
		auth.MustBooksID(ctx),
		in.Name,
		target,
		in.DueOn.Time,
		in.AccountIds,
		in.CountsAsSavings != nil && *in.CountsAsSavings,
	)
}

func (s *Server) linkGoalExpense(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	goal, tx, err := goalExpensePath(r)
	if err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, s.svc.LinkGoalExpense(ctx, auth.MustBooksID(ctx), goal, tx)
}

func (s *Server) unlinkGoalExpense(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	goal, tx, err := goalExpensePath(r)
	if err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, s.svc.UnlinkGoalExpense(ctx, auth.MustBooksID(ctx), goal, tx)
}

// goalExpensePath reads the goal and the transaction of the path.
func goalExpensePath(r *http.Request) (goal, tx uuid.UUID, err error) {
	if goal, err = httpserver.PathUUID(r, "id"); err != nil {
		return uuid.Nil, uuid.Nil, err
	}

	tx, err = httpserver.PathUUID(r, "transaction_id")

	return goal, tx, err
}

func (s *Server) listGoalExpenses(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (GoalExpenses, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return GoalExpenses{}, err
	}

	expenses, currency, err := s.svc.GoalExpenses(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return GoalExpenses{}, err
	}

	out := GoalExpenses{Items: make([]GoalExpense, len(expenses))}
	for i, e := range expenses {
		out.Items[i] = GoalExpense{
			TransactionId: e.TransactionID,
			Date:          apiDate(e.Date),
			Description:   e.Description,
			Amount:        toMoneyAPI(e.Amount, currency),
			Direct:        e.Direct,
		}
	}

	return out, nil
}
