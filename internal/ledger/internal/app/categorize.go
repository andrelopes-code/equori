package app

import (
	"bytes"
	"context"
	"errors"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

const (
	EventTransactionCategorized = "ledger.transaction_categorized.v1"
	EventCategoriesMerged       = "ledger.categories_merged.v1"
	// CauseMerge marks the versions a merge creates; Classification keeps their method (A75).
	CauseMerge        = "merge"
	reasonMerged      = "merged"
	reasonCategorized = "categorized"
	MethodManual      = "manual"
)

// Cause says who decided a categorization; the ledger stores nothing of it and only
// carries it to the event, from which Classification records the method (P5 amendment A20).
type Cause struct {
	Method string    `json:"method"`
	RuleID uuid.UUID `json:"rule_id,omitzero"`
}

// Categorization is one item of Categorize (P5 amendment A18).
type Categorization struct {
	TransactionID   uuid.UUID
	ExpectedVersion int
	Parts           []domain.CategoryPart // nil keeps the category postings
	PayeeID         *uuid.UUID            // nil keeps the payee
	AddTags         []string
	Cause           Cause
}

// Categorize applies each item in one database transaction, locking the transactions in id
// order. errs[i] is the domain error of item i, which leaves the other items applied; err is
// an infrastructure error and applies none.
func (s *Service) Categorize(ctx context.Context, userID int64, cs []Categorization) (errs []error, err error) {
	errs = make([]error, len(cs))
	order := make([]int, len(cs))
	for i := range order {
		order[i] = i
	}
	slices.SortFunc(order, func(a, b int) int { return bytes.Compare(cs[a].TransactionID[:], cs[b].TransactionID[:]) })
	err = s.repo.InTx(ctx, func(r Repository) error {
		for _, i := range order {
			itemErr, err := s.categorize(ctx, r, userID, cs[i])
			if err != nil {
				return err
			}
			errs[i] = itemErr
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return errs, nil
}

func (s *Service) categorize(ctx context.Context, r Repository, userID int64, c Categorization) (itemErr, err error) {
	prev, err := r.LockTransaction(ctx, userID, c.TransactionID)
	if errors.Is(err, ErrNotFound) {
		return err, nil
	}
	if err != nil {
		return nil, err
	}
	if c.PayeeID != nil && *c.PayeeID != uuid.Nil {
		if _, err := r.Payee(ctx, userID, *c.PayeeID); errors.Is(err, ErrNotFound) {
			return &domain.FieldError{Field: "payee_id", Message: "unknown payee", Err: domain.ErrValidation}, nil
		} else if err != nil {
			return nil, err
		}
	}
	ids := postingAccounts(prev)
	for _, p := range c.Parts {
		ids = append(ids, p.AccountID)
	}
	accounts, err := r.Accounts(ctx, userID, ids)
	if err != nil {
		return nil, err
	}
	next, err := prev.Categorize(domain.Categorization{ExpectedVersion: c.ExpectedVersion, Parts: c.Parts, PayeeID: c.PayeeID, AddTags: c.AddTags}, accounts)
	if err != nil {
		return err, nil
	}
	if err := r.ReplaceCategoryPostings(ctx, prev, next, reasonCategorized); err != nil {
		return nil, err
	}
	event := newTransactionEvent(next, accounts, prev)
	if c.Cause.Method != "" {
		event.Cause = &c.Cause
	}
	return nil, r.Publish(ctx, outbox.Event{Type: EventTransactionCategorized, UserID: userID, AggregateID: next.ID.String(), Payload: event})
}

func postingAccounts(ts ...domain.Transaction) []uuid.UUID {
	var ids []uuid.UUID
	for _, t := range ts {
		for _, p := range t.Postings {
			ids = append(ids, p.AccountID)
		}
	}
	return ids
}

// CategoriesMerged is the payload of EventCategoriesMerged.
type CategoriesMerged struct {
	From uuid.UUID `json:"from"`
	Into uuid.UUID `json:"into"`
}

// MergeCategories moves the postings and children of from to into, closes from and
// publishes EventCategoriesMerged (A75). It returns into.
func (s *Service) MergeCategories(ctx context.Context, userID int64, from, into uuid.UUID) (domain.Account, error) {
	var dest domain.Account
	err := s.repo.InTx(ctx, func(r Repository) error {
		src, err := r.Account(ctx, userID, from)
		if err != nil {
			return err
		}
		if dest, err = r.Account(ctx, userID, into); errors.Is(err, ErrNotFound) {
			return &domain.FieldError{Field: "into", Message: "unknown account", Err: domain.ErrUnknownAccount}
		} else if err != nil {
			return err
		}
		all, err := r.AllAccounts(ctx, userID)
		if err != nil {
			return err
		}
		if err := checkMerge(src, dest, all); err != nil {
			return err
		}
		ids, err := r.TransactionsWithAccount(ctx, userID, from)
		if err != nil {
			return err
		}
		for _, id := range ids {
			if err := s.reassign(ctx, r, userID, id, src, dest); err != nil {
				return err
			}
		}
		for _, child := range subtreeOf(src, all)[1:] {
			if child.ParentID != src.ID {
				continue
			}
			child.ParentID = dest.ID
			if _, err := r.UpdateAccount(ctx, child); err != nil {
				return err
			}
		}
		today := s.clock.Today()
		src.ClosedOn = &today
		if src, err = domain.NewAccount(src); err != nil {
			return err
		}
		if _, err := r.UpdateAccount(ctx, src); err != nil {
			return err
		}
		return r.Publish(ctx, outbox.Event{Type: EventCategoriesMerged, UserID: userID, AggregateID: src.ID.String(), Payload: CategoriesMerged{From: src.ID, Into: dest.ID}})
	})
	return dest, err
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

func (s *Service) reassign(ctx context.Context, r Repository, userID int64, id uuid.UUID, src, dest domain.Account) error {
	prev, err := r.LockTransaction(ctx, userID, id)
	if err != nil {
		return err
	}
	next, err := prev.ReassignCategory(src.ID, dest)
	if err != nil {
		return err
	}
	accounts, err := r.Accounts(ctx, userID, postingAccounts(prev, next))
	if err != nil {
		return err
	}
	if err := r.ReplaceCategoryPostings(ctx, prev, next, reasonMerged); err != nil {
		return err
	}
	event := newTransactionEvent(next, accounts, prev)
	event.Cause = &Cause{Method: CauseMerge}
	return r.Publish(ctx, outbox.Event{Type: EventTransactionCategorized, UserID: userID, AggregateID: next.ID.String(), Payload: event})
}
