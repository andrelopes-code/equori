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
// statement, as the owner's choice (A137). Every transaction is checked before the first
// one moves.
func (s *Service) DeferPostings(ctx context.Context, userID int64, statementID uuid.UUID, txIDs []uuid.UUID) error {
	if _, err := s.repo.StatementAccount(ctx, userID, statementID); err != nil {
		return err
	}

	moves := make([]domain.Transaction, len(txIDs))
	for i, id := range txIDs {
		t, err := s.repo.Transaction(ctx, userID, id)
		if err != nil {
			return err
		}

		if moves[i], err = deferred(t, statementID); err != nil {
			return err
		}
	}

	for i, next := range moves {
		if _, err := s.CorrectTransaction(ctx, userID, txIDs[i], next.Version, next, reasonDeferred); err != nil {
			return err
		}
	}

	return nil
}

// deferred is the correction of t that bills its posting on statementID on the next statement.
func deferred(t domain.Transaction, statementID uuid.UUID) (domain.Transaction, error) {
	k := slices.IndexFunc(t.Postings, func(p domain.Posting) bool { return p.StatementID == statementID })
	if k < 0 || t.Postings[k].Installment != nil || t.Postings[k].Statement == nil {
		return domain.Transaction{}, ErrPostingNotMovable
	}

	next := t
	next.Postings = slices.Clone(t.Postings)
	for i := range next.Postings {
		// The correction carries the record links over itself (A27).
		next.Postings[i].ExternalRecordID = uuid.Nil
	}
	later := next.Postings[k].Statement.Add(1)
	next.Postings[k].Statement, next.Postings[k].StatementBasis = &later, domain.BasisOwner

	return next, nil
}
