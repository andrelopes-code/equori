package app

import (
	"context"
	"maps"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
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
) (map[time.Time]flow, error) {
	sets, err := s.accountSets(ctx, booksID, facts)
	if err != nil {
		return nil, err
	}

	return s.setFlows(ctx, booksID, facts, base, sets, SetGoals, from, to)
}

// inflows returns, by first day of month in [from, to), what went into the accounts of held from
// the counterparts of A251: the book's other asset and liability accounts in base, an income
// credited to held and an expense paid from it. A transaction counts through its postings in
// those counterparts, so a move out of held counts against its month.
func (s *Service) inflows(
	ctx context.Context,
	booksID int64,
	facts []Account,
	base money.Currency,
	held map[uuid.UUID]bool,
	from, to time.Time,
) (map[time.Time]flow, error) {
	counted, err := s.countedInflows(ctx, booksID, facts, base, held, from, to)
	if err != nil {
		return nil, err
	}

	out := make(map[time.Time]flow)
	for _, c := range counted {
		month := domain.MonthOf(c.tx.Date)
		out[month] = out[month].add(c.amount)
	}

	return out, nil
}

// flow is what went into a set in a month and what left it, each a sum of whole transactions
// (planning coherence A254).
type flow struct{ deposited, withdrawn int64 }

func (f flow) net() int64 { return f.deposited - f.withdrawn }

// add counts a signed amount as a deposit or as a withdrawal.
func (f flow) add(amount int64) flow {
	if amount > 0 {
		f.deposited += amount
	} else {
		f.withdrawn -= amount
	}

	return f
}

// countedInflow is a transaction and the amount `inflows` counts for it.
type countedInflow struct {
	tx     domain.Transaction
	amount int64
}

// countedInflows returns the amount `inflows` counts for each non-voided transaction with a
// posting in the accounts of held dated in [from, to).
func (s *Service) countedInflows(
	ctx context.Context,
	booksID int64,
	facts []Account,
	base money.Currency,
	held map[uuid.UUID]bool,
	from, to time.Time,
) ([]countedInflow, error) {
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

	sources := movementCounterparts(facts, held, base)

	var out []countedInflow
	for _, tx := range txs {
		if tx.Voided {
			continue
		}

		c := countedInflow{tx: tx}
		for _, p := range tx.Postings {
			if sources[p.AccountID] {
				c.amount -= p.Amount
			}
		}

		out = append(out, c)
	}

	return out, nil
}

// goalAccounts returns two disjoint sets with their sub-accounts: the accounts held whole by the
// goals that do not count as savings, and the accounts held whole only by goals that do (income
// buckets A239). An account of both kinds of goal is in the first set, so its deposits count once.
// An account held by allocations keeps the set of its own kind (planning coherence A255).
func goalAccounts(all []domain.Goal, facts []Account) (goals, savings map[uuid.UUID]bool) {
	goals, savings = make(map[uuid.UUID]bool), make(map[uuid.UUID]bool)

	for _, g := range all {
		into := goals
		if g.CountsAsSavings {
			into = savings
		}

		for _, id := range g.AccountIDs {
			into[id] = true
		}
	}

	withSubAccounts(goals, facts)
	withSubAccounts(savings, facts)
	maps.DeleteFunc(savings, func(id uuid.UUID, _ bool) bool { return goals[id] })

	return goals, savings
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
