package app

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// CategoriesMerged is the payload of EventCategoriesMerged.
type CategoriesMerged struct {
	From uuid.UUID `json:"from"`
	Into uuid.UUID `json:"into"`
}

// MergeCategories moves the postings and children of from to into, closes from and
// publishes EventCategoriesMerged (A75). It returns into.
func (s *Service) MergeCategories(
	ctx context.Context,
	booksID int64,
	from, into uuid.UUID,
) (domain.Account, error) {
	var dest domain.Account
	err := s.repo.InTx(ctx, func(r Repository) error {
		src, all, err := s.loadMerge(ctx, r, booksID, from, into, &dest)
		if err != nil {
			return err
		}

		ids, err := r.TransactionsWithAccount(ctx, booksID, from)
		if err != nil {
			return err
		}

		for _, id := range ids {
			if err := s.reassign(ctx, r, booksID, id, src, dest); err != nil {
				return err
			}
		}

		if err := reparentChildren(ctx, r, src, dest, all); err != nil {
			return err
		}

		today := s.clock.Today(ctx)

		src.ClosedOn = &today
		if src, err = domain.NewAccount(src); err != nil {
			return err
		}

		if _, err := r.UpdateAccount(ctx, src); err != nil {
			return err
		}

		return r.Publish(
			ctx,
			outbox.Event{
				Type:        EventCategoriesMerged,
				BooksID:     booksID,
				AggregateID: src.ID.String(),
				Payload:     CategoriesMerged{From: src.ID, Into: dest.ID},
			},
		)
	})

	return dest, err
}

// loadMerge loads the source into src and the destination into dest, then checks the merge.
func (s *Service) loadMerge(
	ctx context.Context,
	r Repository,
	booksID int64,
	from, into uuid.UUID,
	dest *domain.Account,
) (domain.Account, []domain.Account, error) {
	src, err := r.Account(ctx, booksID, from)
	if err != nil {
		return domain.Account{}, nil, err
	}

	if *dest, err = r.Account(ctx, booksID, into); errors.Is(err, ErrNotFound) {
		return domain.Account{}, nil, &domain.FieldError{
			Field:   "into",
			Message: "unknown account",
			Err:     domain.ErrUnknownAccount,
		}
	} else if err != nil {
		return domain.Account{}, nil, err
	}

	all, err := r.AllAccounts(ctx, booksID)
	if err != nil {
		return domain.Account{}, nil, err
	}

	if err := checkMerge(src, *dest, all); err != nil {
		return domain.Account{}, nil, err
	}

	return src, all, nil
}

// reparentChildren moves the direct children of src under dest.
func reparentChildren(
	ctx context.Context,
	r Repository,
	src, dest domain.Account,
	all []domain.Account,
) error {
	for _, child := range subtreeOf(src, all)[1:] {
		if child.ParentID != src.ID {
			continue
		}

		child.ParentID = dest.ID
		if _, err := r.UpdateAccount(ctx, child); err != nil {
			return err
		}
	}

	return nil
}

func checkMerge(src, dest domain.Account, all []domain.Account) error {
	invalid := func(message string) error {
		return &domain.FieldError{Field: "into", Message: message, Err: domain.ErrValidation}
	}
	switch {
	case src.SystemRole != "" || dest.SystemRole != "":
		return ErrSystemAccount
	case src.ID == dest.ID:
		return invalid("must differ from the account")
	case !src.IsCategory() || !dest.IsCategory():
		return invalid("both accounts must be income or expense categories")
	case src.Class != dest.Class || src.Instrument != dest.Instrument:
		return invalid("must have the class and the currency of the account")
	case src.ClosedOn != nil || dest.ClosedOn != nil:
		return invalid("both accounts must be open")
	}

	for _, a := range subtreeOf(src, all) {
		if a.ID == dest.ID {
			return invalid("must not be a descendant of the account")
		}
	}

	return nil
}

func (s *Service) reassign(
	ctx context.Context,
	r Repository,
	booksID int64,
	id uuid.UUID,
	src, dest domain.Account,
) error {
	prev, err := r.LockTransaction(ctx, booksID, id)
	if err != nil {
		return err
	}

	next, err := prev.ReassignCategory(src.ID, dest)
	if err != nil {
		return err
	}

	accounts, err := r.Accounts(ctx, booksID, postingAccounts(prev, next))
	if err != nil {
		return err
	}

	if err := r.ReplaceCategoryPostings(ctx, prev, next, reasonMerged); err != nil {
		return err
	}

	event := newTransactionEvent(next, accounts, prev)
	event.Cause = &Cause{Method: CauseMerge}

	return r.Publish(
		ctx,
		outbox.Event{
			Type:        EventTransactionCategorized,
			BooksID:     booksID,
			AggregateID: next.ID.String(),
			Payload:     event,
		},
	)
}

// wholeCategory is the single part that moves every category posting of t to category.
func wholeCategory(
	t domain.Transaction,
	accounts map[uuid.UUID]domain.Account,
	category uuid.UUID,
) ([]domain.CategoryPart, error) {
	var total money.Money

	found := false
	for _, p := range t.Postings {
		if !accounts[p.AccountID].IsCategory() {
			continue
		}

		if !found {
			total, found = p.Amount, true
			continue
		}

		sum, err := total.Add(p.Amount)
		if err != nil {
			return nil, domain.ErrNotCategorizable
		}

		total = sum
	}

	if !found {
		return nil, domain.ErrNotCategorizable
	}

	return []domain.CategoryPart{{AccountID: category, Amount: total}}, nil
}
