package httpapi

import (
	"context"
	"fmt"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) CreateTransactionBatch(ctx context.Context, req CreateTransactionBatchRequestObject) (CreateTransactionBatchResponseObject, error) {
	entries := make([]app.BatchEntry, len(req.Body.Entries))
	for i, e := range req.Body.Entries {
		if e.Transaction != nil {
			t, err := fromTransactionInput(ctx, *e.Transaction, s.svc.AmountOf)
			if err != nil {
				return nil, domain.WithFieldPrefix(fmt.Sprintf("entries[%d].transaction.", i), err)
			}
			entries[i].Transaction = &t
		}
		if e.InstallmentPurchase != nil {
			p, err := fromInstallmentPurchaseInput(*e.InstallmentPurchase)
			if err != nil {
				return nil, domain.WithFieldPrefix(fmt.Sprintf("entries[%d].installment_purchase.", i), err)
			}
			entries[i].Purchase = &p
		}
	}
	created, err := s.svc.RecordBatch(ctx, auth.MustUserID(ctx), entries)
	if err != nil {
		return nil, err
	}
	items := make([]Transaction, len(created))
	for i, t := range created {
		items[i] = toTransactionAPI(t)
	}
	return CreateTransactionBatch201JSONResponse{Items: items}, nil
}
