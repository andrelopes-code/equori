package app

import (
	"context"
	"errors"
	"fmt"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
)

// BatchEntry is one operation of a transaction batch; exactly one member is set (A114).
type BatchEntry struct {
	Transaction *domain.Transaction
	Purchase    *InstallmentPurchaseInput
}

// RecordBatch records every entry in one database transaction, or none (A114). A rejected
// entry's field is prefixed with entries[i] and the member that holds it.
func (s *Service) RecordBatch(ctx context.Context, userID int64, entries []BatchEntry) ([]domain.Transaction, error) {
	out := make([]domain.Transaction, len(entries))
	err := s.repo.InTx(ctx, func(r Repository) error {
		for i, e := range entries {
			var err error
			switch {
			case e.Transaction != nil && e.Purchase == nil:
				t := *e.Transaction
				t.UserID = userID
				out[i], err = s.insert(ctx, r, t)
				err = domain.WithFieldPrefix(fmt.Sprintf("entries[%d].transaction.", i), err)
			case e.Purchase != nil && e.Transaction == nil:
				out[i], _, err = s.installmentPurchase(ctx, r, userID, *e.Purchase)
				if errors.Is(err, ErrNotFound) {
					err = &domain.FieldError{Field: "card_account_id", Message: "unknown account", Err: domain.ErrUnknownAccount}
				}
				err = domain.WithFieldPrefix(fmt.Sprintf("entries[%d].installment_purchase.", i), err)
			default:
				err = validationError(fmt.Sprintf("entries[%d]", i), "must hold exactly one of transaction and installment_purchase")
			}
			if err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}
