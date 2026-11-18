package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

// idsOf returns the ids of an optional list.
func idsOf(ids *[]uuid.UUID) []uuid.UUID {
	if ids == nil {
		return nil
	}

	return *ids
}

// idsOrEmpty writes a list without ids as an empty array.
func idsOrEmpty(ids []uuid.UUID) []uuid.UUID {
	if ids == nil {
		return []uuid.UUID{}
	}

	return ids
}

// setGoalAllocations writes the accounts a goal holds by allocations and its over-allocated
// amount (planning coherence A255).
func setGoalAllocations(out *Goal, g app.GoalView) {
	out.AllocatedAccounts = make([]GoalAllocatedAccount, len(g.AllocatedAccounts))
	for i, a := range g.AllocatedAccounts {
		out.AllocatedAccounts[i] = GoalAllocatedAccount{
			AccountId: a.AccountID,
			Allocated: toMoneyAPI(a.Allocated.Amount(), a.Allocated.Currency()),
			Available: toMoneyAPI(a.Available.Amount(), a.Available.Currency()),
		}
	}

	if g.OverAllocated != nil {
		over := toMoneyAPI(g.OverAllocated.Amount(), g.OverAllocated.Currency())
		out.OverAllocated = &over
	}
}

func (s *Server) createGoalAllocation(
	ctx context.Context,
	r *http.Request,
	in CreateGoalAllocationJSONRequestBody,
) (Goal, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Goal{}, err
	}

	amount, err := fromMoneyAPI("amount", in.Amount)
	if err != nil {
		return Goal{}, err
	}

	var on *time.Time
	if in.BookedOn != nil {
		on = &in.BookedOn.Time
	}

	g, err := s.svc.CreateGoalAllocation(ctx, auth.MustBooksID(ctx), id, in.AccountId, amount, on)
	if err != nil {
		return Goal{}, err
	}

	return toGoalAPI(g), nil
}

func (s *Server) listGoalAllocations(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (GoalAllocations, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return GoalAllocations{}, err
	}

	allocations, err := s.svc.GoalAllocations(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return GoalAllocations{}, err
	}

	out := GoalAllocations{Items: make([]GoalAllocation, len(allocations))}
	for i, a := range allocations {
		out.Items[i] = GoalAllocation{
			Id:        a.ID,
			AccountId: a.AccountID,
			BookedOn:  apiDate(a.BookedOn),
			Amount:    toMoneyAPI(a.Amount, a.Currency),
		}
		if a.OccurrenceID != uuid.Nil {
			out.Items[i].OccurrenceId = &a.OccurrenceID
		}
	}

	return out, nil
}

func (s *Server) deleteGoalAllocation(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	goal, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	id, err := httpserver.PathUUID(r, "allocation_id")
	if err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, s.svc.DeleteGoalAllocation(ctx, auth.MustBooksID(ctx), goal, id)
}
