package app

import (
	"context"
	"maps"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// goalInflows returns, by first day of month in [from, to), what went into the accounts of the
// book's goals that do not count as savings and their sub-accounts from its other asset and
// liability accounts in base: money moved, not yields or prices (income buckets A234, A239). A
// withdrawal counts against its month.
func (s *Service) goalInflows(
	ctx context.Context,
	booksID int64,
	facts []Account,
	base money.Currency,
	from, to time.Time,
) (map[time.Time]int64, error) {
	held, _, err := s.goalAccounts(ctx, booksID, facts)
	if err != nil {
		return nil, err
	}

	return s.inflows(ctx, booksID, facts, base, held, from, to)
}

// inflows returns, by first day of month in [from, to), what went into the accounts of held from
// the book's asset and liability accounts in base outside held. A transaction counts through its
// postings in those other accounts, so a move out of held counts against its month.
func (s *Service) inflows(
	ctx context.Context,
	booksID int64,
	facts []Account,
	base money.Currency,
	held map[uuid.UUID]bool,
	from, to time.Time,
) (map[time.Time]int64, error) {
	var ids []uuid.UUID
	for id := range held {
		got, err := s.ledger.AccountTransactionsBetween(
			ctx,
			booksID,
			id,
			from,
			to.AddDate(0, 0, -1),
		)
		if err != nil {
			return nil, err
		}

		ids = append(ids, got...)
	}

	slices.SortFunc(ids, func(a, b uuid.UUID) int { return slices.Compare(a[:], b[:]) })

	txs, err := s.ledger.TransactionFacts(ctx, booksID, slices.Compact(ids))
	if err != nil {
		return nil, err
	}

	sources := make(map[uuid.UUID]bool)
	for _, a := range facts {
		sources[a.ID] = !held[a.ID] && a.Instrument == base &&
			(a.Class == "asset" || a.Class == "liability")
	}

	out := make(map[time.Time]int64)
	for _, tx := range txs {
		for _, p := range tx.Postings {
			if !tx.Voided && sources[p.AccountID] {
				out[domain.MonthOf(tx.Date)] -= p.Amount
			}
		}
	}

	return out, nil
}

// goalAccounts returns two disjoint sets with their sub-accounts: the accounts of the goals that
// do not count as savings, and the accounts held only by goals that do (income buckets A239). An
// account of both kinds of goal is in the first set, so its deposits count once.
func (s *Service) goalAccounts(
	ctx context.Context,
	booksID int64,
	facts []Account,
) (goals, savings map[uuid.UUID]bool, err error) {
	goals, savings = make(map[uuid.UUID]bool), make(map[uuid.UUID]bool)

	r := page.Request[IDKey]{Limit: page.MaxLimit}
	for {
		got, next, err := s.repo.ListGoals(ctx, booksID, r)
		if err != nil {
			return nil, nil, err
		}

		for _, g := range got {
			into := goals
			if g.CountsAsSavings {
				into = savings
			}

			for _, id := range g.AccountIDs {
				into[id] = true
			}
		}

		if next == nil {
			break
		}

		r.After = next
	}

	withSubAccounts(goals, facts)
	withSubAccounts(savings, facts)
	maps.DeleteFunc(savings, func(id uuid.UUID, _ bool) bool { return goals[id] })

	return goals, savings, nil
}

// withSubAccounts adds to held every account under one of its accounts, at any depth; facts come
// in no set order.
func withSubAccounts(held map[uuid.UUID]bool, facts []Account) {
	for grew := true; grew; {
		grew = false
		for _, a := range facts {
			if held[a.ParentID] && !held[a.ID] {
				held[a.ID], grew = true, true
			}
		}
	}
}
