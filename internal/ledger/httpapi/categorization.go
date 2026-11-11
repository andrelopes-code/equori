package httpapi

import (
	"context"
	"errors"
	"fmt"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) CategorizeTransaction(ctx context.Context, req CategorizeTransactionRequestObject) (CategorizeTransactionResponseObject, error) {
	booksID := auth.MustBooksID(ctx)

	c := app.Categorization{
		TransactionID: req.Id, ExpectedVersion: req.Body.ExpectedVersion, PayeeID: req.Body.PayeeId,
		Parts: make([]domain.CategoryPart, len(req.Body.Parts)), Cause: app.Cause{Method: app.MethodManual},
	}
	for i, p := range req.Body.Parts {
		amount, err := fromMoneyAPI(fmt.Sprintf("parts[%d].amount", i), p.Amount)
		if err != nil {
			return nil, err
		}

		c.Parts[i] = domain.CategoryPart{AccountID: p.AccountId, Amount: amount}
	}

	errs, err := s.svc.Categorize(ctx, booksID, []app.Categorization{c})
	if err != nil {
		return nil, err
	}

	if errs[0] != nil {
		return nil, errs[0]
	}

	t, err := s.svc.Transaction(ctx, booksID, req.Id)
	if err != nil {
		return nil, err
	}

	return CategorizeTransaction200JSONResponse(toTransactionAPI(t)), nil
}

func (s *Server) CategorizeTransactions(ctx context.Context, req CategorizeTransactionsRequestObject) (CategorizeTransactionsResponseObject, error) {
	booksID := auth.MustBooksID(ctx)

	items := make([]app.BulkItem, len(req.Body.Items))
	for i, it := range req.Body.Items {
		items[i] = app.BulkItem{ID: it.Id, ExpectedVersion: it.ExpectedVersion}
	}

	errs, err := s.svc.CategorizeMany(ctx, booksID, req.Body.CategoryId, items)
	if err != nil {
		return nil, err
	}

	out := CategorizeTransactions200JSONResponse{Results: make([]BulkCategorizeItemResult, len(items))}
	for i, it := range items {
		r := BulkCategorizeItemResult{Id: it.ID, Status: bulkStatus(errs[i])}
		if errs[i] == nil {
			t, err := s.svc.Transaction(ctx, booksID, it.ID)
			if err != nil {
				return nil, err
			}

			r.Version = &t.Version
		}

		out.Results[i] = r
	}

	return out, nil
}

// bulkStatus names an item error by the problem code of the same failure (A78).
func bulkStatus(err error) BulkCategorizeItemResultStatus {
	switch {
	case err == nil:
		return BulkCategorizeItemResultStatusCategorized
	case errors.Is(err, app.ErrNotFound):
		return BulkCategorizeItemResultStatusNotFound
	case errors.Is(err, domain.ErrVersionConflict):
		return BulkCategorizeItemResultStatusVersionConflict
	case errors.Is(err, domain.ErrVoided):
		return BulkCategorizeItemResultStatusTransactionVoided
	}

	return BulkCategorizeItemResultStatusNotCategorizable
}
