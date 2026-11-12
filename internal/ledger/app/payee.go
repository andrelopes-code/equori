package app

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (s *Service) CreatePayee(ctx context.Context, booksID int64, name string) (Payee, error) {
	if name == "" || len([]rune(name)) > 120 {
		return Payee{}, &domain.FieldError{Field: "name", Message: "must have 1 to 120 characters", Err: domain.ErrValidation}
	}

	return s.repo.InsertPayee(ctx, Payee{BooksID: booksID, Name: name})
}

func (s *Service) ListPayees(ctx context.Context, booksID int64, p page.Request[PayeeKey]) ([]Payee, *PayeeKey, error) {
	return s.repo.ListPayees(ctx, booksID, p)
}

func (s *Service) PayeeNames(ctx context.Context, booksID int64, ids []uuid.UUID) (map[uuid.UUID]string, error) {
	return s.repo.PayeeNames(ctx, booksID, ids)
}

// PayeesMerged is the payload of EventPayeesMerged.
type PayeesMerged struct {
	From uuid.UUID `json:"from"`
	Into uuid.UUID `json:"into"`
}

// RenamePayee changes the name of a payee (A82).
func (s *Service) RenamePayee(ctx context.Context, booksID int64, id uuid.UUID, name string) (Payee, error) {
	name = strings.TrimSpace(name)
	if n := utf8.RuneCountInString(name); n == 0 || n > 120 {
		return Payee{}, &domain.FieldError{Field: "name", Message: "must have 1 to 120 characters", Err: domain.ErrValidation}
	}

	return s.repo.RenamePayee(ctx, booksID, id, name)
}

// MergePayees moves every transaction of from to into, a new version for each non-voided
// one, keeps from as merged and publishes EventPayeesMerged (A82). It returns into.
func (s *Service) MergePayees(ctx context.Context, booksID int64, from, into uuid.UUID) (Payee, error) {
	var dest Payee
	err := s.repo.InTx(ctx, func(r Repository) error {
		var err error
		if dest, err = s.mergeDestination(ctx, r, booksID, from, into); err != nil {
			return err
		}

		ids, err := r.TransactionsWithPayee(ctx, booksID, from)
		if err != nil {
			return err
		}

		for _, id := range ids {
			if err := s.movePayeeTransaction(ctx, r, booksID, id, into); err != nil {
				return err
			}
		}

		if err := r.RetirePayee(ctx, booksID, from, into); err != nil {
			return err
		}

		return r.Publish(ctx, outbox.Event{Type: EventPayeesMerged, BooksID: booksID, AggregateID: from.String(), Payload: PayeesMerged{From: from, Into: into}})
	})

	return dest, err
}

// mergeDestination loads and checks the payees of a merge and returns the destination.
func (s *Service) mergeDestination(
	ctx context.Context,
	r Repository,
	booksID int64,
	from, into uuid.UUID,
) (Payee, error) {
	src, err := r.Payee(ctx, booksID, from)
	if err != nil {
		return Payee{}, err
	}

	invalid := func(message string) error {
		return &domain.FieldError{Field: "into", Message: message, Err: domain.ErrValidation}
	}
	var dest Payee

	if dest, err = r.Payee(ctx, booksID, into); errors.Is(err, ErrNotFound) {
		return Payee{}, invalid("unknown payee")
	} else if err != nil {
		return Payee{}, err
	}

	switch {
	case src.ID == dest.ID:
		return Payee{}, invalid("must differ from the payee")
	case src.MergedInto != uuid.Nil || dest.MergedInto != uuid.Nil:
		return Payee{}, invalid("both payees must not be merged already")
	}

	return dest, nil
}

// movePayeeTransaction writes a new version of the transaction id with the payee into.
func (s *Service) movePayeeTransaction(
	ctx context.Context,
	r Repository,
	booksID int64,
	id, into uuid.UUID,
) error {
	prev, err := r.LockTransaction(ctx, booksID, id)
	if err != nil {
		return err
	}

	next := prev
	next.PayeeID = into
	next.Version++

	accounts, err := r.Accounts(ctx, booksID, postingAccounts(prev))
	if err != nil {
		return err
	}

	if err := r.ReplaceCategoryPostings(ctx, prev, next, reasonMerged); err != nil {
		return err
	}

	event := newTransactionEvent(next, accounts, prev)

	event.Cause = &Cause{Method: CauseMerge}
	if err := r.Publish(ctx, outbox.Event{Type: EventTransactionCategorized, BooksID: booksID, AggregateID: next.ID.String(), Payload: event}); err != nil {
		return err
	}

	return nil
}
