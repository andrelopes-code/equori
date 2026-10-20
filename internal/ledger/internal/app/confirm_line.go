package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
)

// lineReason is the version reason of a transaction corrected to its statement line (A101).
const lineReason = "matched to the institution's line"

// ConfirmLine corrects the transaction to the amount and date of the statement line matched
// to it on accountID, as a new version, keeping its description, payee, categories and tags
// (A101). A voided transaction is refused with ErrVoided.
func (s *Service) ConfirmLine(ctx context.Context, userID int64, txID, accountID uuid.UUID, amount int64, date time.Time) error {
	tx, err := s.repo.Transaction(ctx, userID, txID)
	if err != nil {
		return err
	}
	if tx.VoidedAt != nil {
		return domain.ErrVoided
	}
	next, changed, err := tx.ToLine(accountID, amount, date)
	if err != nil || !changed {
		return err
	}
	_, err = s.CorrectTransaction(ctx, userID, txID, tx.Version, next, lineReason)
	return err
}
