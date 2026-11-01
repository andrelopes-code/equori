package app

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
)

// ErrNotGroupable: the transaction has installments, a trade or an income (A169).
var ErrNotGroupable = errors.New("the transaction cannot be confirmed by a group of lines")

const (
	groupReason     = "matched to the institution's lines"
	groupVoidReason = "grouped with the owner's entry"
)

// GroupPart is one line of a group: its record, amount, date and status, and the transaction the
// import created for it, uuid.Nil for a line without one.
type GroupPart struct {
	RecordID  uuid.UUID
	Amount    int64
	Date      time.Time
	Pending   bool
	CreatedTx uuid.UUID
}

// ConfirmGroup replaces the entry's posting on the account by one posting per part, ordered by
// date then record id, each linked to its record; the transactions created for parts are
// released and voided. It runs in one database transaction and is a no-op when the entry's
// postings already carry every record of the parts (A169).
func (s *Service) ConfirmGroup(
	ctx context.Context,
	booksID int64,
	txID,
	accountID uuid.UUID,
	parts []GroupPart,
) error {
	if len(parts) < 2 {
		return fmt.Errorf("%w: a group has at least two lines", domain.ErrValidation)
	}

	parts = slices.Clone(parts)
	slices.SortFunc(parts, func(a, b GroupPart) int {
		if c := a.Date.Compare(b.Date); c != 0 {
			return c
		}

		return bytes.Compare(a.RecordID[:], b.RecordID[:])
	})

	return s.repo.InTx(ctx, func(r Repository) error {
		prev, err := r.LockTransaction(ctx, booksID, txID)
		if err != nil {
			return err
		}

		if prev.VoidedAt != nil {
			return domain.ErrVoided
		}

		if holdsParts(prev, accountID, parts) {
			return nil
		}

		if prev.HasInstallments() || prev.Trade != nil || prev.Income != nil {
			return ErrNotGroupable
		}

		if err := s.dropCreated(ctx, r, booksID, parts); err != nil {
			return err
		}

		lineParts := make([]domain.LinePart, len(parts))
		for i, p := range parts {
			lineParts[i] = domain.LinePart{Amount: p.Amount, Pending: p.Pending}
		}

		next, err := prev.SplitToLines(accountID, parts[0].Date, lineParts)
		if err != nil {
			return err
		}

		corrected, err := s.correctIn(ctx, r, booksID, txID, prev.Version, next, groupReason)
		if err != nil {
			return err
		}

		return linkParts(ctx, r, booksID, corrected, accountID, parts)
	})
}

// GroupableTransactions returns the ids among txIDs that a group may take over (A167
// condition 6): not voided, version 1, origin import, no reconciled posting, no installment,
// no trade, no income.
func (s *Service) GroupableTransactions(
	ctx context.Context,
	booksID int64,
	txIDs []uuid.UUID) ([]uuid.UUID,
	error,
) {
	var out []uuid.UUID

	for _, id := range txIDs {
		tx, err := s.repo.Transaction(ctx, booksID, id)
		if errors.Is(err, ErrNotFound) {
			continue
		}

		if err != nil {
			return nil, err
		}

		if groupable(tx) {
			out = append(out, id)
		}
	}

	return out, nil
}

func groupable(tx domain.Transaction) bool {
	reconciled := slices.ContainsFunc(tx.Postings, func(p domain.Posting) bool { return p.Status == domain.StatusReconciled })

	return tx.VoidedAt == nil && tx.Version == 1 && tx.Origin == domain.OriginImport && !reconciled &&
		!tx.HasInstallments() && tx.Trade == nil && tx.Income == nil
}

// holdsParts reports whether the transaction's postings on the account already carry the record
// of every part.
func holdsParts(tx domain.Transaction, accountID uuid.UUID, parts []GroupPart) bool {
	return !slices.ContainsFunc(parts, func(part GroupPart) bool {
		return !slices.ContainsFunc(tx.Postings, func(p domain.Posting) bool {
			return p.AccountID == accountID && p.ExternalRecordID == part.RecordID
		})
	})
}

// dropCreated releases the records of the parts that the import had created a transaction for
// and voids those transactions.
func (s *Service) dropCreated(
	ctx context.Context,
	r Repository,
	booksID int64,
	parts []GroupPart,
) error {
	for _, part := range parts {
		if part.CreatedTx == uuid.Nil {
			continue
		}

		if err := r.ReleaseExternalRecord(ctx, booksID, part.RecordID); err != nil {
			return err
		}

		if err := s.voidIn(ctx, r, booksID, part.CreatedTx, groupVoidReason); err != nil {
			return err
		}
	}

	return nil
}

// linkParts links each part's record to the posting of the same position on the account.
func linkParts(
	ctx context.Context,
	r Repository,
	booksID int64,
	tx domain.Transaction,
	accountID uuid.UUID,
	parts []GroupPart,
) error {
	var postings []domain.Posting

	for _, p := range tx.Postings {
		if p.AccountID == accountID {
			postings = append(postings, p)
		}
	}

	if len(postings) != len(parts) {
		return fmt.Errorf("link group: %d postings for %d parts", len(postings), len(parts))
	}

	for i, p := range postings {
		if err := r.LinkExternalRecord(ctx, booksID, p.ID, parts[i].RecordID); err != nil {
			return fmt.Errorf("link group record: %w", err)
		}
	}

	return nil
}
