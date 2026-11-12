package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) categorizeTransaction(
	ctx context.Context,
	r *http.Request,
	in CategorizeTransactionJSONRequestBody,
) (Transaction, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Transaction{}, err
	}

	booksID := auth.MustBooksID(ctx)

	c := app.Categorization{
		TransactionID:   id,
		ExpectedVersion: in.ExpectedVersion,
		PayeeID:         in.PayeeId,
		Parts: make(
			[]domain.CategoryPart,
			len(in.Parts),
		),
		Cause: app.Cause{Method: app.MethodManual},
	}
	for i, p := range in.Parts {
		amount, err := fromMoneyAPI(fmt.Sprintf("parts[%d].amount", i), p.Amount)
		if err != nil {
			return Transaction{}, err
		}

		c.Parts[i] = domain.CategoryPart{AccountID: p.AccountId, Amount: amount}
	}

	errs, err := s.svc.Categorize(ctx, booksID, []app.Categorization{c})
	if err != nil {
		return Transaction{}, err
	}

	if errs[0] != nil {
		return Transaction{}, errs[0]
	}

	t, err := s.svc.Transaction(ctx, booksID, id)
	if err != nil {
		return Transaction{}, err
	}

	return toTransactionAPI(t), nil
}

func (s *Server) categorizeTransactions(
	ctx context.Context,
	r *http.Request,
	in CategorizeTransactionsJSONRequestBody,
) (BulkCategorizeResult, error) {
	booksID := auth.MustBooksID(ctx)

	items := make([]app.BulkItem, len(in.Items))
	for i, it := range in.Items {
		items[i] = app.BulkItem{ID: it.Id, ExpectedVersion: it.ExpectedVersion}
	}

	errs, err := s.svc.CategorizeMany(ctx, booksID, in.CategoryId, items)
	if err != nil {
		return BulkCategorizeResult{}, err
	}

	out := BulkCategorizeResult{Results: make([]BulkCategorizeItemResult, len(items))}
	for i, it := range items {
		rec := BulkCategorizeItemResult{Id: it.ID, Status: bulkStatus(errs[i])}
		if errs[i] == nil {
			t, err := s.svc.Transaction(ctx, booksID, it.ID)
			if err != nil {
				return BulkCategorizeResult{}, err
			}

			rec.Version = &t.Version
		}

		out.Results[i] = rec
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
