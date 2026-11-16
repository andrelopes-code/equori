package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// savingsInflows returns, by first day of month in [from, to), what went into the book's savings,
// reserve and brokerage accounts outside the accounts of its goals: money moved, not yields or
// prices (income buckets A233). A withdrawal counts against its month; a move between two such
// accounts counts nothing.
func (s *Service) savingsInflows(
	ctx context.Context,
	booksID int64,
	facts []Account,
	base money.Currency,
	from, to time.Time,
) (map[time.Time]int64, error) {
	goals, err := s.goalAccounts(ctx, booksID, facts)
	if err != nil {
		return nil, err
	}

	held := make(map[uuid.UUID]bool)
	for _, a := range facts {
		if a.Class == "asset" && isSavingsKind(a.Kind) && !goals[a.ID] {
			held[a.ID] = true
		}
	}

	return s.inflows(ctx, booksID, facts, base, held, from, to)
}

func isSavingsKind(kind string) bool {
	return kind == "savings" || kind == "reserve" || kind == "brokerage"
}
