package httpapi

import (
	"context"
	"fmt"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) reimburseTransaction(
	ctx context.Context,
	r *http.Request,
	in ReimburseTransactionJSONRequestBody,
) (Transaction, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Transaction{}, err
	}

	booksID := auth.MustBooksID(ctx)

	input := app.ReimbursementRequest{
		TransactionID:   id,
		ExpectedVersion: in.ExpectedVersion,
		Cause:           app.Cause{Method: app.MethodManual},
		Allocations:     make([]app.AllocationRequest, len(in.Allocations)),
	}
	for i, a := range in.Allocations {
		amount, err := fromMoneyAPI(fmt.Sprintf("allocations[%d].amount", i), a.Amount)
		if err != nil {
			return Transaction{}, err
		}

		input.Allocations[i] = app.AllocationRequest{OriginalID: a.OriginalId, Amount: amount}
		if a.CategoryId != nil {
			input.Allocations[i].CategoryID = *a.CategoryId
		}
	}

	done, err := s.svc.Reimburse(ctx, booksID, input)
	if err != nil {
		return Transaction{}, err
	}

	t, err := s.svc.Transaction(ctx, booksID, done.ID)
	if err != nil {
		return Transaction{}, err
	}

	return toTransactionAPI(t), nil
}

func (s *Server) listReimbursementCandidates(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (ReimbursementCandidateList, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return ReimbursementCandidateList{}, err
	}

	candidates, suggestion, err := s.svc.ReimbursementCandidates(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return ReimbursementCandidateList{}, err
	}

	out := ReimbursementCandidateList{Items: make([]ReimbursementCandidate, len(candidates))}
	for i, c := range candidates {
		out.Items[i] = ReimbursementCandidate{
			Transaction: toTransactionAPI(
				c.Transaction,
			),
			Remaining: toMoneyAPI(c.Remaining),
			Allocated: toMoneyAPI(c.Allocated),
		}
	}

	if len(suggestion) > 0 {
		out.Suggestion = &suggestion
	}

	return out, nil
}

func (s *Server) listReimbursementSources(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (ReimbursementSourceList, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return ReimbursementSourceList{}, err
	}

	sources, err := s.svc.ReimbursementSources(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return ReimbursementSourceList{}, err
	}

	out := ReimbursementSourceList{Items: make([]ReimbursementSource, len(sources))}
	for i, c := range sources {
		out.Items[i] = ReimbursementSource{
			Transaction: toTransactionAPI(c.Transaction),
			Free:        toMoneyAPI(c.Free),
		}
	}

	return out, nil
}
