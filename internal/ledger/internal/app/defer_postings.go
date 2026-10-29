package app

import (
	"context"
	"errors"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
)

// ErrPostingNotMovable: the transaction has no card posting on the statement, or its posting
// follows an installment plan (A137).
var ErrPostingNotMovable = errors.New("the transaction has no posting the statement can move")

const reasonDeferred = "moved to the next statement"

// DeferPostings moves the card posting each transaction holds on statementID to the next
// statement, as the owner's choice (A137), in one database transaction: either every
// transaction moves or none does. A transaction named twice moves once.
func (s *Service) DeferPostings(ctx context.Context, userID int64, statementID uuid.UUID, txIDs []uuid.UUID) error {
	ids := slices.Compact(slices.SortedFunc(slices.Values(txIDs), func(a, b uuid.UUID) int { return slices.Compare(a[:], b[:]) }))

	return s.repo.InTx(ctx, func(r Repository) error {
		if _, err := r.StatementAccount(ctx, userID, statementID); err != nil {
			return err
		}

		for _, id := range ids {
			t, err := r.LockTransaction(ctx, userID, id)
			if err != nil {
				return err
			}

			next, err := deferred(t, statementID)
			if err != nil {
				return err
			}

			if _, err := s.correctIn(ctx, r, userID, id, next.Version, next, reasonDeferred); err != nil {
				return err
			}
		}

		return nil
	})
}

// deferred is the correction of t that bills its card postings on statementID on the next
// statement.
func deferred(t domain.Transaction, statementID uuid.UUID) (domain.Transaction, error) {
	next := t
	next.Postings = slices.Clone(t.Postings)
	moved := false
	for i, p := range next.Postings {
		// The correction carries the record links over itself (A27).
		next.Postings[i].ExternalRecordID = uuid.Nil
		if p.StatementID != statementID {
			continue
		}

		if p.Installment != nil || p.Statement == nil {
			return domain.Transaction{}, ErrPostingNotMovable
		}

		later := p.Statement.Add(1)
		next.Postings[i].Statement, next.Postings[i].StatementBasis = &later, domain.BasisOwner
		moved = true
	}

	if !moved {
		return domain.Transaction{}, ErrPostingNotMovable
	}

	return next, nil
}
