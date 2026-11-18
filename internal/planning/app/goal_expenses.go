package app

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// GoalExpense is a transaction a goal pays with the sum of its expense postings in the base
// currency; Direct is false for a stored link (planning coherence A256).
type GoalExpense struct {
	TransactionID uuid.UUID
	Date          time.Time
	Description   string
	Amount        int64
	Direct        bool
}

// LinkGoalExpense states that the goal pays the transaction, in place of the link the
// transaction had. The transaction is a non-voided one with an expense posting (A256).
func (s *Service) LinkGoalExpense(
	ctx context.Context,
	booksID int64,
	goalID, txID uuid.UUID,
) error {
	if _, err := s.repo.Goal(ctx, booksID, goalID); err != nil {
		return err
	}

	facts, base, err := s.factsAndBase(ctx, booksID)
	if err != nil {
		return err
	}

	txs, err := s.ledger.TransactionFacts(ctx, booksID, []uuid.UUID{txID})
	if err != nil {
		return err
	}

	spending := spendingCategories(facts, base)
	if len(txs) == 0 || txs[0].Voided || !slices.ContainsFunc(
		txs[0].Postings,
		func(p domain.Posting) bool { return spending[p.AccountID] },
	) {
		return &domain.FieldError{
			Field:   "transaction_id",
			Message: "must be a transaction of the book with an expense posting, not voided",
			Err:     domain.ErrValidation,
		}
	}

	return s.repo.InTx(ctx, func(repo Repository) error {
		return repo.LinkGoalExpense(ctx, booksID, goalID, txID)
	})
}

// UnlinkGoalExpense removes the link of the goal and the transaction; ErrNotFound without it.
func (s *Service) UnlinkGoalExpense(
	ctx context.Context,
	booksID int64,
	goalID, txID uuid.UUID,
) error {
	return s.repo.InTx(ctx, func(repo Repository) error {
		found, err := repo.UnlinkGoalExpense(ctx, booksID, goalID, txID)
		if err == nil && !found {
			return ErrNotFound
		}

		return err
	})
}

// GoalExpenses returns the transactions the goal pays, the latest first, and the currency of
// their amounts.
func (s *Service) GoalExpenses(
	ctx context.Context,
	booksID int64,
	goalID uuid.UUID,
) ([]GoalExpense, money.Currency, error) {
	if _, err := s.repo.Goal(ctx, booksID, goalID); err != nil {
		return nil, "", err
	}

	facts, base, err := s.factsAndBase(ctx, booksID)
	if err != nil {
		return nil, "", err
	}

	paid, err := s.goalPaid(ctx, booksID, facts, base, allTime[0], allTime[1])
	if err != nil {
		return nil, "", err
	}

	var out []GoalExpense

	at := make(map[uuid.UUID]int)
	for _, p := range paid {
		if p.goalID != goalID {
			continue
		}

		i, ok := at[p.tx.ID]
		if !ok {
			i = len(out)
			at[p.tx.ID] = i
			out = append(out, GoalExpense{
				TransactionID: p.tx.ID,
				Date:          p.tx.Date,
				Description:   p.tx.Description,
				Direct:        p.direct,
			})
		}

		out[i].Amount += p.amount
	}

	slices.SortFunc(out, func(a, b GoalExpense) int {
		if c := b.Date.Compare(a.Date); c != 0 {
			return c
		}

		return slices.Compare(b.TransactionID[:], a.TransactionID[:])
	})

	return out, base, nil
}

// goalsSpent returns, by goal, the sum of the expense postings of the transactions it pays, and
// the currency of the sums (A256).
func (s *Service) goalsSpent(
	ctx context.Context,
	booksID int64,
) (map[uuid.UUID]int64, money.Currency, error) {
	facts, base, err := s.factsAndBase(ctx, booksID)
	if err != nil {
		return nil, "", err
	}

	paid, err := s.goalPaid(ctx, booksID, facts, base, allTime[0], allTime[1])
	if err != nil {
		return nil, "", err
	}

	out := make(map[uuid.UUID]int64)
	for _, p := range paid {
		out[p.goalID] += p.amount
	}

	return out, base, nil
}

// withSpent sets the spent amount of each view.
func (s *Service) withSpent(ctx context.Context, booksID int64, views ...*GoalView) error {
	spent, base, err := s.goalsSpent(ctx, booksID)
	if err != nil {
		return err
	}

	for _, v := range views {
		if v.Spent, err = money.New(spent[v.ID], base); err != nil {
			return err
		}
	}

	return nil
}

// factsAndBase reads the accounts and the base currency of the book.
func (s *Service) factsAndBase(
	ctx context.Context,
	booksID int64,
) ([]Account, money.Currency, error) {
	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return nil, "", err
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)

	return facts, base, err
}
