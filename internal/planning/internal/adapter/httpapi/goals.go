package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toGoalAPI(g app.GoalView) Goal {
	out := Goal{
		Id: g.ID, Name: g.Name, Target: toMoneyAPI(g.Target, g.Currency), DueOn: apiDate(g.DueOn), AccountIds: g.AccountIDs,
		Current: toMoneyAPI(g.Progress.Current, g.Currency), Remaining: toMoneyAPI(g.Progress.Remaining, g.Currency),
		ProgressBp: g.Progress.ProgressBP, Prices: toPricesAPI(g.Prices), Parts: toGoalPartsAPI(g.Parts),
	}
	if g.Trailing != nil {
		out.TrailingReturn = &TrailingReturn{PeriodMonths: g.Trailing.Months, AnnualBp: g.Trailing.BP}
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
			AccountId: p.AccountID, Instrument: string(p.Instrument),
			Quantity: toMoneyAPI(p.Quantity.Amount(), p.Quantity.Currency()), Value: toMoneyAPI(p.Value.Amount(), p.Value.Currency()),
		}
	}
	return &out
}

func (s *Server) CreateGoal(ctx context.Context, req CreateGoalRequestObject) (CreateGoalResponseObject, error) {
	target, err := fromMoneyAPI("target", req.Body.Target)
	if err != nil {
		return nil, err
	}
	g, err := s.svc.CreateGoal(ctx, auth.MustUserID(ctx), req.Body.Name, target, req.Body.DueOn.Time, req.Body.AccountIds)
	if err != nil {
		return nil, err
	}
	return CreateGoal201JSONResponse{Body: toGoalAPI(g), Headers: CreateGoal201ResponseHeaders{Location: location("/goals/", g.ID)}}, nil
}

func (s *Server) UpdateGoal(ctx context.Context, req UpdateGoalRequestObject) (UpdateGoalResponseObject, error) {
	patch := app.GoalPatch{Name: req.Body.Name, AccountIDs: req.Body.AccountIds}
	if req.Body.Target != nil {
		target, err := fromMoneyAPI("target", *req.Body.Target)
		if err != nil {
			return nil, err
		}
		patch.Target = &target
	}
	if req.Body.DueOn != nil {
		patch.DueOn = &req.Body.DueOn.Time
	}
	g, err := s.svc.UpdateGoal(ctx, auth.MustUserID(ctx), req.Id, patch)
	if err != nil {
		return nil, err
	}
	return UpdateGoal200JSONResponse(toGoalAPI(g)), nil
}

func (s *Server) DeleteGoal(ctx context.Context, req DeleteGoalRequestObject) (DeleteGoalResponseObject, error) {
	if err := s.svc.DeleteGoal(ctx, auth.MustUserID(ctx), req.Id); err != nil {
		return nil, err
	}
	return DeleteGoal204Response{}, nil
}

func (s *Server) GetGoal(ctx context.Context, req GetGoalRequestObject) (GetGoalResponseObject, error) {
	g, err := s.svc.Goal(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	return GetGoal200JSONResponse(toGoalAPI(g)), nil
}

func (s *Server) ListGoals(ctx context.Context, req ListGoalsRequestObject) (ListGoalsResponseObject, error) {
	p, err := listPage[app.IDKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	gs, next, err := s.svc.ListGoals(ctx, auth.MustUserID(ctx), p)
	if err != nil {
		return nil, err
	}
	out := ListGoals200JSONResponse{Items: make([]Goal, len(gs))}
	for i, g := range gs {
		out.Items[i] = toGoalAPI(g)
	}
	out.NextCursor, err = page.Next(next)
	return out, err
}
