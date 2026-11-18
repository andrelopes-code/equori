package app

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
)

// retainedIncome returns, by first day of month in [from, to), the yields and the realized gains
// of the transactions without a posting in an account of the spending set: income that stayed in
// the investments (planning coherence A252). Income postings are negative; the amounts returned
// are positive.
func (s *Service) retainedIncome(
	ctx context.Context,
	booksID int64,
	facts []Account,
	from, to time.Time,
) (map[time.Time]int64, error) {
	sets, err := s.accountSets(ctx, booksID, facts)
	if err != nil {
		return nil, err
	}

	postings, err := s.ledger.OwnCategoryPostings(ctx, booksID, "income", from, to)
	if err != nil {
		return nil, err
	}

	postings = slices.DeleteFunc(postings, func(p CategoryPosting) bool {
		return !isRetainedRole(sets.facts[p.CategoryID].SystemRole)
	})

	ids := make([]uuid.UUID, len(postings))
	for i, p := range postings {
		ids[i] = p.TransactionID
	}

	slices.SortFunc(ids, func(a, b uuid.UUID) int { return slices.Compare(a[:], b[:]) })

	txs, err := s.ledger.TransactionFacts(ctx, booksID, slices.Compact(ids))
	if err != nil {
		return nil, err
	}

	spent := make(map[uuid.UUID]bool, len(txs))
	for _, tx := range txs {
		spent[tx.ID] = slices.ContainsFunc(tx.Postings, func(p domain.Posting) bool {
			set, ok := sets.of(p.AccountID)
			return ok && set == SetSpending
		})
	}

	out := make(map[time.Time]int64)
	for _, p := range postings {
		if !spent[p.TransactionID] {
			out[domain.MonthOf(p.BookedOn)] -= p.Amount
		}
	}

	return out, nil
}
