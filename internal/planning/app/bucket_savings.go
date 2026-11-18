package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// savingsInflows returns, by first day of month in [from, to), what went into the book's savings,
// reserve and brokerage accounts outside the accounts of its goals, and into the accounts of the
// goals that count as savings: money moved, not yields or prices (income buckets A233, A239). A
// withdrawal counts against its month; a move between two such accounts counts nothing.
func (s *Service) savingsInflows(
	ctx context.Context,
	booksID int64,
	facts []Account,
	base money.Currency,
	from, to time.Time,
) (map[time.Time]flow, error) {
	held, err := s.savingsAccounts(ctx, booksID, facts)
	if err != nil {
		return nil, err
	}

	return s.inflows(ctx, booksID, facts, base, held, from, to)
}

// savingsAccounts returns the accounts that count as savings: the savings, reserve and brokerage
// accounts outside the goals' accounts, and the accounts of the goals that count as savings.
func (s *Service) savingsAccounts(
	ctx context.Context,
	booksID int64,
	facts []Account,
) (map[uuid.UUID]bool, error) {
	goals, held, err := s.goalAccounts(ctx, booksID, facts)
	if err != nil {
		return nil, err
	}

	for _, a := range facts {
		if a.Class == "asset" && isSavingsKind(a.Kind) && !goals[a.ID] {
			held[a.ID] = true
		}
	}

	return held, nil
}

func isSavingsKind(kind string) bool {
	return kind == "savings" || kind == "reserve" || kind == "brokerage"
}
