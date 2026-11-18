package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
)

// coveredSpending returns, by month of the window and bucket of its method, the spending that the
// accumulated balance of the counted rollover budgets paid: for each budget, the balance carried
// into the month, never below zero, up to the spending of its categories in the bucket (planning
// coherence A254). own holds the own postings of each expense category by month and paid the
// part of them that a goal pays, which counts neither as spending of the budget nor as covered
// (A257); to is the end of the window.
func (s *Service) coveredSpending(
	ctx context.Context,
	booksID int64,
	facts []Account,
	months []windowMethod,
	budgets []domain.Budget,
	own, paid map[uuid.UUID]map[time.Time]int64,
	to time.Time,
) (map[time.Time][]int64, error) {
	parents := expenseParents(facts)
	byCategory := make(map[uuid.UUID]domain.Budget, len(budgets))
	for _, b := range budgets {
		if _, expense := parents[b.CategoryID]; expense {
			byCategory[b.CategoryID] = b
		}
	}

	out := make(map[time.Time][]int64, len(months))
	for _, wm := range months {
		out[wm.month] = make([]int64, len(wm.method.Buckets))
	}

	for _, b := range byCategory {
		if !b.Rollover || len(b.Amounts) == 0 {
			continue
		}

		start := b.Amounts[0].EffectiveFrom

		totals, err := s.ledger.CategoryMonthlyTotals(ctx, booksID, b.CategoryID, start, to)
		if err != nil {
			return nil, err
		}

		subtree := categorySubtree(b.CategoryID, parents)
		goalPaid := subtreePaid(paid, subtree)
		spent := func(m time.Time) (int64, error) { return totals[m] - goalPaid[m], nil }

		for _, wm := range months {
			if !domain.CountedBudget(b, wm.month, byCategory, parents) {
				continue
			}

			p, _, _ := b.Progress(wm.month, spent)
			resolve := domain.BucketResolver(wm.method.Buckets, parents)
			cover(out[wm.month], p.Carried, subtree, resolve, own, paid, wm.month)
		}
	}

	return out, nil
}

// cover adds to covered, by bucket, the spending of the categories of subtree in month that
// carried pays, in the order of the buckets.
func cover(
	covered []int64,
	carried int64,
	subtree []uuid.UUID,
	resolve func(uuid.UUID) (int, bool),
	own, paid map[uuid.UUID]map[time.Time]int64,
	month time.Time,
) {
	spent := make([]int64, len(covered))
	for _, c := range subtree {
		if i, ok := resolve(c); ok {
			spent[i] += own[c][month] - paid[c][month]
		}
	}

	for i := range covered {
		paid := min(max(carried, 0), max(spent[i], 0))
		covered[i] += paid
		carried -= paid
	}
}

// categorySubtree returns root and every category under it, at any depth.
func categorySubtree(root uuid.UUID, parents map[uuid.UUID]uuid.UUID) []uuid.UUID {
	out := []uuid.UUID{root}

	for id := range parents {
		for p := parents[id]; p != uuid.Nil; p = parents[p] {
			if p == root {
				out = append(out, id)
				break
			}
		}
	}

	return out
}
