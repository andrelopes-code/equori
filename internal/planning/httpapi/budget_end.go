package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) endBudget(
	ctx context.Context,
	r *http.Request,
	in EndBudgetJSONRequestBody,
) (Budget, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Budget{}, err
	}

	month, err := parseMonth("month", in.Month)
	if err != nil {
		return Budget{}, err
	}

	b, err := s.svc.EndBudget(ctx, auth.MustBooksID(ctx), id, month)
	if err != nil {
		return Budget{}, err
	}

	return toBudgetAPI(b), nil
}
