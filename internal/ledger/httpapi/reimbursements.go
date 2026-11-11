package httpapi

import (
	"context"
	"fmt"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) ReimburseTransaction(ctx context.Context, req ReimburseTransactionRequestObject) (ReimburseTransactionResponseObject, error) {
	booksID := auth.MustBooksID(ctx)

	in := app.ReimbursementRequest{
		TransactionID: req.Id, ExpectedVersion: req.Body.ExpectedVersion, Cause: app.Cause{Method: app.MethodManual},
		Allocations: make([]app.AllocationRequest, len(req.Body.Allocations)),
	}
	for i, a := range req.Body.Allocations {
		amount, err := fromMoneyAPI(fmt.Sprintf("allocations[%d].amount", i), a.Amount)
		if err != nil {
			return nil, err
		}

		in.Allocations[i] = app.AllocationRequest{OriginalID: a.OriginalId, Amount: amount}
		if a.CategoryId != nil {
			in.Allocations[i].CategoryID = *a.CategoryId
		}
	}

	done, err := s.svc.Reimburse(ctx, booksID, in)
	if err != nil {
		return nil, err
	}

	t, err := s.svc.Transaction(ctx, booksID, done.ID)
	if err != nil {
		return nil, err
	}

	return ReimburseTransaction200JSONResponse(toTransactionAPI(t)), nil
}

func (s *Server) ListReimbursementCandidates(ctx context.Context, req ListReimbursementCandidatesRequestObject) (ListReimbursementCandidatesResponseObject, error) {
	candidates, suggestion, err := s.svc.ReimbursementCandidates(ctx, auth.MustBooksID(ctx), req.Id)
	if err != nil {
		return nil, err
	}

	out := ListReimbursementCandidates200JSONResponse{Items: make([]ReimbursementCandidate, len(candidates))}
	for i, c := range candidates {
		out.Items[i] = ReimbursementCandidate{
			Transaction: toTransactionAPI(c.Transaction), Remaining: toMoneyAPI(c.Remaining), Allocated: toMoneyAPI(c.Allocated),
		}
	}

	if len(suggestion) > 0 {
		out.Suggestion = &suggestion
	}

	return out, nil
}

func (s *Server) ListReimbursementSources(ctx context.Context, req ListReimbursementSourcesRequestObject) (ListReimbursementSourcesResponseObject, error) {
	sources, err := s.svc.ReimbursementSources(ctx, auth.MustBooksID(ctx), req.Id)
	if err != nil {
		return nil, err
	}

	out := ListReimbursementSources200JSONResponse{Items: make([]ReimbursementSource, len(sources))}
	for i, c := range sources {
		out.Items[i] = ReimbursementSource{Transaction: toTransactionAPI(c.Transaction), Free: toMoneyAPI(c.Free)}
	}

	return out, nil
}
