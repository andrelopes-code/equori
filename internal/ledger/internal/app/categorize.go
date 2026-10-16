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
	reasonCategorized           = "categorized"
	MethodManual                = "manual"
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
	event.Cause = &c.Cause
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
