package app

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

// MaxTransactionSuggestions is the most transactions one request names (ADR 014 L1a).
const MaxTransactionSuggestions = 50

var (
	ErrTransactionNotFound = errors.New("transaction not found")
	ErrNotUncategorized    = errors.New("the transaction is not an uncategorized expense or income")
)

// Transaction is a recorded transaction; Class is expense or income when its only category
// postings are on the uncategorized category of that class, and empty otherwise.
type Transaction struct {
	ID          uuid.UUID
	Description string
	Class       string
}

// SuggestForTransactions names a category for each uncategorized transaction as Suggest does
// for a capture line of its class (ADR 014 L1a). It records nothing.
func (s *Service) SuggestForTransactions(ctx context.Context, userID int64, ids []uuid.UUID) ([]Suggestion, bool, error) {
	txs, err := s.ledger.Transactions(ctx, userID, ids)
	if err != nil {
		return nil, false, err
	}
	if len(txs) != len(ids) {
		return nil, false, ErrTransactionNotFound
	}
	items := make([]SuggestItem, len(txs))
	for i, t := range txs {
		if t.Class == "" {
			return nil, false, ErrNotUncategorized
		}
		items[i] = SuggestItem{Description: t.Description, Class: t.Class}
	}
	out := make([]Suggestion, 0, len(items))
	available := true
	for start := 0; start < len(items); start += MaxSuggestions {
		got, ok, err := s.Suggest(ctx, userID, items[start:min(start+MaxSuggestions, len(items))])
		if err != nil {
			return nil, false, err
		}
		out, available = append(out, got...), available && ok
	}
	return out, available, nil
}
