package app

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Statistics counts the categorizable, non-voided transactions of a period by method (SC5).
type Statistics struct {
	Total, Rule, Source, History, Manual, Uncategorized int
}

func (s *Service) Statistics(ctx context.Context, userID int64, from, to time.Time) (Statistics, error) {
	counts, err := s.repo.CountMethods(ctx, userID, from, to)
	if err != nil {
		return Statistics{}, err
	}
	st := Statistics{
		Rule: counts[MethodRule], Source: counts[MethodSource], History: counts[MethodHistory],
		Manual: counts[MethodManual], Uncategorized: counts[""],
	}
	st.Total = st.Rule + st.Source + st.History + st.Manual + st.Uncategorized
	return st, nil
}

// Categorization returns the record of a transaction; ErrNotFound when it has none.
func (s *Service) Categorization(ctx context.Context, userID int64, transactionID uuid.UUID) (Record, error) {
	return s.repo.Categorization(ctx, userID, transactionID)
}

// RuleUsage is how many current categorizations a rule decided and when it last did (A80).
type RuleUsage struct {
	Count int
	Last  time.Time
}

func (s *Service) Categorizations(ctx context.Context, userID int64, ids []uuid.UUID) ([]Record, error) {
	return s.repo.Categorizations(ctx, userID, ids)
}

func (s *Service) RuleUsage(ctx context.Context, userID int64, ids []uuid.UUID) (map[uuid.UUID]RuleUsage, error) {
	return s.repo.RuleUsage(ctx, userID, ids)
}
