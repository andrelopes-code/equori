package app

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// GoalWithdrawal is the part of the latest withdrawal from a goal that linked expenses do not
// cover, and the date of that withdrawal (planning coherence A256).
type GoalWithdrawal struct {
	Amount money.Money
	Since  time.Time
}

// withdrawalMonths bounds how far back a withdrawal is still asked about.
const withdrawalMonths = 12

// unexplainedWithdrawal returns the latest withdrawal of the last 12 months from the accounts
// the goal holds whole into another balance account, less the expenses linked to the goal dated
// on or after it; nil when they cover it or the goal had none. An expense paid from the goal's
// account is a direct payment, not a withdrawal to explain.
func (s *Service) unexplainedWithdrawal(
	ctx context.Context,
	booksID int64,
	facts []Account,
	base money.Currency,
	g domain.Goal,
	paid []paidExpense,
) (*GoalWithdrawal, error) {
	held := make(map[uuid.UUID]bool, len(g.AccountIDs))
	for _, id := range g.AccountIDs {
		held[id] = true
	}

	withSubAccounts(held, facts)

	today := s.clk.Today(ctx)

	counted, err := s.countedInflows(
		ctx,
		booksID,
		facts,
		base,
		held,
		today.AddDate(0, -withdrawalMonths, 0),
		today.AddDate(0, 0, 1),
	)
	if err != nil {
		return nil, err
	}

	spending := spendingCategories(facts, base)

	var latest *countedInflow
	for i, c := range counted {
		direct := slices.ContainsFunc(c.tx.Postings, func(p domain.Posting) bool {
			return spending[p.AccountID]
		})
		if c.amount < 0 && !direct && (latest == nil || c.tx.Date.After(latest.tx.Date)) {
			latest = &counted[i]
		}
	}

	if latest == nil {
		return nil, nil
	}

	rest := -latest.amount
	for _, p := range paid {
		if p.goalID == g.ID && !p.direct && !p.tx.Date.Before(latest.tx.Date) {
			rest -= p.amount
		}
	}

	if rest <= 0 {
		return nil, nil
	}

	amount, err := money.New(rest, base)

	return &GoalWithdrawal{Amount: amount, Since: latest.tx.Date}, err
}
