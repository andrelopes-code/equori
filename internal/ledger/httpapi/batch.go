package httpapi

import (
	"context"
	"fmt"
	"net/http"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) createTransactionBatch(
	ctx context.Context,
	r *http.Request,
	in CreateTransactionBatchJSONRequestBody,
) (TransactionBatch, error) {
	entries := make([]app.BatchEntry, len(in.Entries))
	for i, e := range in.Entries {
		if e.Transaction != nil {
			t, err := fromTransactionInput(ctx, *e.Transaction, s.svc.AmountOf)
			if err != nil {
				return TransactionBatch{}, domain.WithFieldPrefix(fmt.Sprintf("entries[%d].transaction.", i), err)
			}

			entries[i].Transaction = &t
		}

		if e.InstallmentPurchase != nil {
			p, err := fromInstallmentPurchaseInput(*e.InstallmentPurchase)
			if err != nil {
				return TransactionBatch{}, domain.WithFieldPrefix(fmt.Sprintf("entries[%d].installment_purchase.", i), err)
			}

			entries[i].Purchase = &p
		}
	}

	created, err := s.svc.RecordBatch(ctx, auth.MustBooksID(ctx), entries)
	if err != nil {
		return TransactionBatch{}, err
	}

	items := make([]Transaction, len(created))
	for i, t := range created {
		items[i] = toTransactionAPI(t)
	}

	return TransactionBatch{Items: items}, nil
}
