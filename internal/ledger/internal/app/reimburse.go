package app

import (
	"bytes"
	"context"
	"fmt"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// AllocationRequest repays Amount of the expense OriginalID. CategoryID, when set, moves the
// expense and its reimbursement to that expense category (A117).
type AllocationRequest struct {
	OriginalID, CategoryID uuid.UUID
	Amount                 money.Money
}

// ReimbursementRequest replaces the reimbursements of TransactionID with Allocations (A117).
type ReimbursementRequest struct {
	TransactionID   uuid.UUID
	ExpectedVersion int
	Allocations     []AllocationRequest
	Cause           Cause
}

// Reimburse returns the reimbursement after the change.
func (s *Service) Reimburse(ctx context.Context, userID int64, req ReimbursementRequest) (domain.Transaction, error) {
	var out domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		var err error
		out, err = s.reimburse(ctx, r, userID, req)
		return err
	})
	return out, err
}

func (s *Service) reimburse(ctx context.Context, r Repository, userID int64, req ReimbursementRequest) (domain.Transaction, error) {
	ids := []uuid.UUID{req.TransactionID}
	for _, a := range req.Allocations {
		if !slices.Contains(ids, a.OriginalID) {
			ids = append(ids, a.OriginalID)
		}
	}
	slices.SortFunc(ids, func(a, b uuid.UUID) int { return bytes.Compare(a[:], b[:]) })
	locked := make(map[uuid.UUID]domain.Transaction, len(ids))
	var all []domain.Transaction
	for _, id := range ids {
		t, err := r.LockTransaction(ctx, userID, id)
		if err != nil {
			return domain.Transaction{}, err
		}
		locked[id] = t
		all = append(all, t)
	}
	uncategorized, err := r.SystemAccount(ctx, userID, domain.RoleUncategorizedIncome)
	if err != nil {
		return domain.Transaction{}, err
	}
	accountIDs := append(postingAccounts(all...), uncategorized.ID)
	for _, a := range req.Allocations {
		accountIDs = append(accountIDs, a.CategoryID)
	}
	accounts, err := r.Accounts(ctx, userID, accountIDs)
	if err != nil {
		return domain.Transaction{}, err
	}
	prev := locked[req.TransactionID]
	allocations := make([]domain.Allocation, len(req.Allocations))
	for i, a := range req.Allocations {
		if err := checkAllocationCurrency(prev, accounts, i, a); err != nil {
			return domain.Transaction{}, err
		}
		original := locked[a.OriginalID]
		if a.CategoryID != uuid.Nil && a.OriginalID != req.TransactionID {
			if original, err = s.recategorizeOriginal(ctx, r, original, accounts, a.CategoryID, req.Cause); err != nil {
				return domain.Transaction{}, err
			}
		}
		held, err := r.ReimbursedTotal(ctx, userID, a.OriginalID, req.TransactionID)
		if err != nil {
			return domain.Transaction{}, err
		}
		allocations[i] = domain.Allocation{Original: original, Amount: a.Amount.Amount(), HeldByOthers: held}
	}
	next, err := prev.Reimburse(req.ExpectedVersion, allocations, uncategorized, accounts)
	if err != nil {
		return domain.Transaction{}, err
	}
	if err := r.ReplaceCategoryPostings(ctx, prev, next, reasonCategorized); err != nil {
		return domain.Transaction{}, err
	}
	links := slices.DeleteFunc(slices.Clone(next.Links), func(l domain.Link) bool { return l.Type != domain.LinkReimbursementOf })
	if err := r.SetReimbursementLinks(ctx, userID, next.ID, links); err != nil {
		return domain.Transaction{}, err
	}
	return next, s.publishCategorized(ctx, r, next, prev, accounts, req.Cause)
}

// checkAllocationCurrency requires the amount in the currency of the category side of t.
func checkAllocationCurrency(t domain.Transaction, accounts map[uuid.UUID]domain.Account, i int, a AllocationRequest) error {
	for _, p := range t.Postings {
		if accounts[p.AccountID].IsCategory() && p.Amount.Currency() != a.Amount.Currency() {
			return validationError(fmt.Sprintf("allocations[%d].amount", i), "must be in the currency "+string(p.Amount.Currency()))
		}
	}
	return nil
}

// recategorizeOriginal moves the category postings of the expense to the expense category.
func (s *Service) recategorizeOriginal(ctx context.Context, r Repository, original domain.Transaction, accounts map[uuid.UUID]domain.Account, category uuid.UUID, cause Cause) (domain.Transaction, error) {
	if c := accounts[category]; c.ID == uuid.Nil || c.Class != domain.ClassExpense {
		return domain.Transaction{}, validationError("category_id", "must be an expense account")
	}
	parts, err := wholeCategory(original, accounts, category)
	if err != nil {
		return domain.Transaction{}, err
	}
	next, err := original.Categorize(domain.Categorization{ExpectedVersion: original.Version, Parts: parts}, accounts)
	if err != nil {
		return domain.Transaction{}, err
	}
	if err := r.ReplaceCategoryPostings(ctx, original, next, reasonCategorized); err != nil {
		return domain.Transaction{}, err
	}
	return next, s.publishCategorized(ctx, r, next, original, accounts, cause)
}

func (s *Service) publishCategorized(ctx context.Context, r Repository, next, prev domain.Transaction, accounts map[uuid.UUID]domain.Account, cause Cause) error {
	event := newTransactionEvent(next, accounts, prev)
	if cause.Method != "" {
		event.Cause = &cause
	}
	return r.Publish(ctx, outbox.Event{Type: EventTransactionCategorized, UserID: next.UserID, AggregateID: next.ID.String(), Payload: event})
}
