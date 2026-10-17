package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toGoalAPI(g app.GoalView) Goal {
	return Goal{
		Id: g.ID, Name: g.Name, Target: toMoneyAPI(g.Target, g.Currency), DueOn: apiDate(g.DueOn), AccountIds: g.AccountIDs,
		Current: toMoneyAPI(g.Progress.Current, g.Currency), Remaining: toMoneyAPI(g.Progress.Remaining, g.Currency),
		ProgressBp: g.Progress.ProgressBP,
	}
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
