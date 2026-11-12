package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// CloseAccount closes the account and its open descendants (A74). Every member needs no
// postings after the closing date; a balance-sheet or equity member also needs a zero balance.
func (s *Service) CloseAccount(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	closedOn time.Time,
) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		root, err := r.Account(ctx, booksID, id)
		if err != nil {
			return err
		}

		all, err := r.AllAccounts(ctx, booksID)
		if err != nil {
			return err
		}

		subtree := subtreeOf(root, all)

		closing, err := closeableAccounts(ctx, r, booksID, root, subtree, closedOn)
		if err != nil {
			return err
		}

		if err := saveClosedAccounts(ctx, r, booksID, closing); err != nil {
			return err
		}

		return nil
	})
}

// closeableAccounts returns the accounts of subtree to close, each with ClosedOn set.
func closeableAccounts(
	ctx context.Context,
	r Repository,
	booksID int64,
	root domain.Account,
	subtree []domain.Account,
	closedOn time.Time,
) ([]domain.Account, error) {
	var closing []domain.Account
	for _, a := range subtree {
		if a.SystemRole != "" {
			return nil, ErrSystemAccount
		}

		if a.ClosedOn != nil && a.ID != root.ID {
			continue
		}

		totals, err := r.AccountTotals(ctx, booksID, a.ID)
		if err != nil {
			return nil, err
		}

		if a.Class != domain.ClassIncome && a.Class != domain.ClassExpense && totals.Total != 0 {
			return nil, ErrNonZeroBalance
		}

		if totals.LastBookedOn.After(closedOn) {
			return nil, ErrPostingsAfterClose
		}

		a.ClosedOn = &closedOn
		if a, err = domain.NewAccount(a); err != nil {
			return nil, err
		}

		closing = append(closing, a)
	}

	return closing, nil
}

// saveClosedAccounts persists each closed account and publishes its event.
func saveClosedAccounts(
	ctx context.Context,
	r Repository,
	booksID int64,
	closing []domain.Account,
) error {
	for _, a := range closing {
		if _, err := r.UpdateAccount(ctx, a); err != nil {
			return err
		}

		event := outbox.Event{
			Type:        EventAccountClosed,
			BooksID:     booksID,
			AggregateID: a.ID.String(),
			Payload:     accountEvent{a.ID},
		}

		if err := r.Publish(ctx, event); err != nil {
			return err
		}
	}

	return nil
}
