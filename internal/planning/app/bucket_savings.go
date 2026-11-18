package app

import (
	"context"
	"time"

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
	sets, err := s.accountSets(ctx, booksID, facts)
	if err != nil {
		return nil, err
	}

	return s.setFlows(ctx, booksID, facts, base, sets, SetSavings, from, to)
}

func isSavingsKind(kind string) bool {
	return kind == "savings" || kind == "reserve" || kind == "brokerage"
}
