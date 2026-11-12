package app

import (
	"bytes"
	"context"
	"errors"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

const (
	EventTransactionCategorized = "ledger.transaction_categorized.v1"
	EventCategoriesMerged       = "ledger.categories_merged.v1"
	EventPayeesMerged           = "ledger.payees_merged.v1"
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
	// WholeTo, when set, replaces Parts by one part on that category holding the category total (A78).
	WholeTo uuid.UUID
	AddTags []string
	Cause   Cause
}

// Categorize applies each item in one database transaction, locking the transactions in id
// order. errs[i] is the domain error of item i, which leaves the other items applied; err is
// an infrastructure error and applies none.
func (s *Service) Categorize(
	ctx context.Context,
	booksID int64,
	cs []Categorization,
) (errs []error, err error) {
	errs = make([]error, len(cs))

	order := make([]int, len(cs))
	for i := range order {
		order[i] = i
	}

	slices.SortFunc(
		order,
		func(a, b int) int { return bytes.Compare(cs[a].TransactionID[:], cs[b].TransactionID[:]) },
	)

	err = s.repo.InTx(ctx, func(r Repository) error {
		for _, i := range order {
			itemErr, err := s.categorize(ctx, r, booksID, cs[i])
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

func (s *Service) categorize(
	ctx context.Context,
	r Repository,
	booksID int64,
	c Categorization,
) (itemErr, err error) {
	prev, err := r.LockTransaction(ctx, booksID, c.TransactionID)
	if errors.Is(err, ErrNotFound) {
		return err, nil
	}

	if err != nil {
		return nil, err
	}

	if c.PayeeID != nil && *c.PayeeID != uuid.Nil {
		if _, err := r.Payee(ctx, booksID, *c.PayeeID); errors.Is(err, ErrNotFound) {
			return &domain.FieldError{
				Field:   "payee_id",
				Message: "unknown payee",
				Err:     domain.ErrValidation,
			}, nil
		} else if err != nil {
			return nil, err
		}
	}

	accounts, err := s.categorizationAccounts(ctx, r, booksID, prev, c)
	if err != nil {
		return nil, err
	}

	if c.WholeTo != uuid.Nil {
		if c.Parts, err = wholeCategory(prev, accounts, c.WholeTo); err != nil {
			return err, nil
		}
	}

	next, err := prev.Categorize(
		domain.Categorization{
			ExpectedVersion: c.ExpectedVersion,
			Parts:           c.Parts,
			PayeeID:         c.PayeeID,
			AddTags:         c.AddTags,
		},
		accounts,
	)
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

	return nil, r.Publish(
		ctx,
		outbox.Event{
			Type:        EventTransactionCategorized,
			BooksID:     booksID,
			AggregateID: next.ID.String(),
			Payload:     event,
		},
	)
}

// categorizationAccounts loads the accounts of the postings of prev and of the categorization.
func (s *Service) categorizationAccounts(
	ctx context.Context,
	r Repository,
	booksID int64,
	prev domain.Transaction,
	c Categorization,
) (map[uuid.UUID]domain.Account, error) {
	ids := postingAccounts(prev)
	for _, p := range c.Parts {
		ids = append(ids, p.AccountID)
	}

	if c.WholeTo != uuid.Nil {
		ids = append(ids, c.WholeTo)
	}

	return r.Accounts(ctx, booksID, ids)
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

// BulkItem is one transaction of CategorizeMany.
type BulkItem struct {
	ID              uuid.UUID
	ExpectedVersion int
}

// CategorizeMany gives each transaction one posting on category for its category total
// (A78). errs[i] is the domain error of item i.
func (s *Service) CategorizeMany(
	ctx context.Context,
	booksID int64,
	category uuid.UUID,
	items []BulkItem,
) ([]error, error) {
	seen := make(map[uuid.UUID]bool, len(items))
	for _, it := range items {
		if seen[it.ID] {
			return nil, &domain.FieldError{
				Field:   "items",
				Message: "repeats a transaction",
				Err:     domain.ErrValidation,
			}
		}

		seen[it.ID] = true
	}

	a, err := s.repo.Account(ctx, booksID, category)
	if errors.Is(err, ErrNotFound) {
		return nil, &domain.FieldError{
			Field:   "category_id",
			Message: "unknown account",
			Err:     domain.ErrValidation,
		}
	}

	if err != nil {
		return nil, err
	}

	if !a.IsCategory() || a.ClosedOn != nil {
		return nil, &domain.FieldError{
			Field:   "category_id",
			Message: "must be an open income or expense category",
			Err:     domain.ErrValidation,
		}
	}

	cs := make([]Categorization, len(items))
	for i, it := range items {
		cs[i] = Categorization{
			TransactionID:   it.ID,
			ExpectedVersion: it.ExpectedVersion,
			WholeTo:         category,
			Cause:           Cause{Method: MethodManual},
		}
	}

	return s.Categorize(ctx, booksID, cs)
}
