package app

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// allTime bounds a read of every transaction of the book.
var allTime = [2]time.Time{
	time.Date(1, 1, 1, 0, 0, 0, 0, time.UTC),
	time.Date(9999, 12, 31, 0, 0, 0, 0, time.UTC),
}

// paidExpense is one expense posting of a transaction a goal pays (planning coherence A256).
// direct is false for a stored link.
type paidExpense struct {
	goalID, categoryID uuid.UUID
	tx                 domain.Transaction
	amount             int64
	direct             bool
}

// goalPaid returns the expense postings of the transactions dated in [from, to) that a goal
// pays: by a stored link, or directly, when the transaction holds a posting in an account that
// one goal alone holds whole. A stored link wins over a direct payment (A256).
func (s *Service) goalPaid(
	ctx context.Context,
	booksID int64,
	facts []Account,
	base money.Currency,
	from, to time.Time,
) ([]paidExpense, error) {
	links, err := s.repo.GoalExpenseLinks(ctx, booksID)
	if err != nil {
		return nil, err
	}

	holders, err := s.wholeHolders(ctx, booksID, facts)
	if err != nil {
		return nil, err
	}

	linked := make(map[uuid.UUID]uuid.UUID, len(links))
	for _, l := range links {
		linked[l.TransactionID] = l.GoalID
	}

	txs, err := s.paidCandidates(ctx, booksID, linked, holders, from, to)
	if err != nil {
		return nil, err
	}

	spending := spendingCategories(facts, base)

	var out []paidExpense
	for _, tx := range txs {
		if tx.Voided || tx.Date.Before(from) || !tx.Date.Before(to) {
			continue
		}

		goal, direct := linked[tx.ID], false
		if goal == uuid.Nil {
			goal, direct = directPayer(tx, holders), true
		}

		if goal == uuid.Nil {
			continue
		}

		for _, p := range tx.Postings {
			if spending[p.AccountID] {
				out = append(out, paidExpense{
					goalID: goal, categoryID: p.AccountID, tx: tx, amount: p.Amount, direct: direct,
				})
			}
		}
	}

	return out, nil
}

// paidCandidates returns the linked transactions and the ones with a posting in an account of
// holders dated in [from, to).
func (s *Service) paidCandidates(
	ctx context.Context,
	booksID int64,
	linked, holders map[uuid.UUID]uuid.UUID,
	from, to time.Time,
) ([]domain.Transaction, error) {
	ids := make([]uuid.UUID, 0, len(linked))
	for id := range linked {
		ids = append(ids, id)
	}

	for account := range holders {
		got, err := s.ledger.AccountTransactionsBetween(
			ctx, booksID, account, from, to.AddDate(0, 0, -1),
		)
		if err != nil {
			return nil, err
		}

		ids = append(ids, got...)
	}

	slices.SortFunc(ids, func(a, b uuid.UUID) int { return slices.Compare(a[:], b[:]) })

	return s.ledger.TransactionFacts(ctx, booksID, slices.Compact(ids))
}

// directPayer returns the goal that alone holds whole the accounts of holders the transaction
// posts to; uuid.Nil without one or with accounts of two goals.
func directPayer(tx domain.Transaction, holders map[uuid.UUID]uuid.UUID) uuid.UUID {
	payer := uuid.Nil

	for _, p := range tx.Postings {
		goal, held := holders[p.AccountID]

		switch {
		case !held:
		case payer == uuid.Nil:
			payer = goal
		case payer != goal:
			return uuid.Nil
		}
	}

	return payer
}

// wholeHolders maps each account that exactly one goal holds whole, sub-accounts included, to
// that goal (A256).
func (s *Service) wholeHolders(
	ctx context.Context,
	booksID int64,
	facts []Account,
) (map[uuid.UUID]uuid.UUID, error) {
	goals, err := s.allGoals(ctx, booksID)
	if err != nil {
		return nil, err
	}

	holders, shared := make(map[uuid.UUID]uuid.UUID), make(map[uuid.UUID]bool)

	for _, g := range goals {
		held := make(map[uuid.UUID]bool, len(g.AccountIDs))
		for _, id := range g.AccountIDs {
			held[id] = true
		}

		withSubAccounts(held, facts)

		for id := range held {
			if _, taken := holders[id]; taken {
				shared[id] = true
			}

			holders[id] = g.ID
		}
	}

	for id := range shared {
		delete(holders, id)
	}

	return holders, nil
}

// allGoals returns every goal of the book.
func (s *Service) allGoals(ctx context.Context, booksID int64) ([]domain.Goal, error) {
	var out []domain.Goal

	r := page.Request[IDKey]{Limit: page.MaxLimit}
	for {
		got, next, err := s.repo.ListGoals(ctx, booksID, r)
		if err != nil {
			return nil, err
		}

		out = append(out, got...)

		if next == nil {
			return out, nil
		}

		r.After = next
	}
}

// paidByCategory sums the paid expense postings by category and month of the transaction date.
func paidByCategory(paid []paidExpense) map[uuid.UUID]map[time.Time]int64 {
	out := make(map[uuid.UUID]map[time.Time]int64)

	for _, p := range paid {
		if out[p.categoryID] == nil {
			out[p.categoryID] = make(map[time.Time]int64)
		}

		out[p.categoryID][domain.MonthOf(p.tx.Date)] += p.amount
	}

	return out
}

// subtreePaid sums paid over the categories of subtree, by month.
func subtreePaid(
	paid map[uuid.UUID]map[time.Time]int64,
	subtree []uuid.UUID,
) map[time.Time]int64 {
	out := make(map[time.Time]int64)

	for _, c := range subtree {
		for month, amount := range paid[c] {
			out[month] += amount
		}
	}

	return out
}
