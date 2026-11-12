package app

import (
	"bytes"
	"context"
	"errors"
	"maps"
	"slices"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// TransactionEvent is the payload of the transaction events (ADR 006, chapter 4).
type TransactionEvent struct {
	TransactionID uuid.UUID   `json:"transaction_id"`
	Date          string      `json:"date"`
	PreviousDate  string      `json:"previous_date,omitempty"`
	AccountIDs    []uuid.UUID `json:"account_ids"`
	Version       int         `json:"version"`
	Origin        string      `json:"origin"`
	CategoryState string      `json:"category_state"`
	// CategoriesChanged is set on corrections that change the category postings.
	CategoriesChanged bool   `json:"categories_changed,omitempty"`
	Cause             *Cause `json:"cause,omitempty"`
}

// Reference is an inbound link: Source is the transaction that links to another one.
// Reference is an inbound link: Source links to another transaction. Amount, when not zero, is what a
// reimbursement_of link repays, in Currency.
type Reference struct {
	Type     domain.LinkType
	Source   uuid.UUID
	Amount   int64
	Currency string
}

func (s *Service) RecordTransaction(
	ctx context.Context,
	booksID int64,
	t domain.Transaction,
) (domain.Transaction, error) {
	t.BooksID = booksID
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		var err error
		created, err = s.insert(ctx, r, t)

		return err
	})

	return created, err
}

func (s *Service) CorrectTransaction(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	expectedVersion int,
	next domain.Transaction,
	reason string,
) (domain.Transaction, error) {
	var corrected domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		var err error
		corrected, err = s.correctIn(ctx, r, booksID, id, expectedVersion, next, reason)

		return err
	})

	return corrected, err
}

func (s *Service) VoidTransaction(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	reason string,
) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		return s.voidIn(ctx, r, booksID, id, reason)
	})
}

// VoidMany voids each transaction with reason, each in its own database transaction, in
// request order (A202). errs[i] is the error of item i; the error return refuses the request
// before any item runs.
func (s *Service) VoidMany(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
	reason string,
) ([]error, error) {
	seen := make(map[uuid.UUID]bool, len(ids))
	for _, id := range ids {
		if seen[id] {
			return nil, &domain.FieldError{
				Field:   "items",
				Message: "repeats a transaction",
				Err:     domain.ErrValidation,
			}
		}

		seen[id] = true
	}

	errs := make([]error, len(ids))
	for i, id := range ids {
		errs[i] = s.VoidTransaction(ctx, booksID, id, reason)
	}

	return errs, nil
}

func (s *Service) Transaction(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (domain.Transaction, error) {
	return s.repo.Transaction(ctx, booksID, id)
}

func (s *Service) Versions(ctx context.Context, booksID int64, id uuid.UUID) ([]Version, error) {
	if _, err := s.repo.Transaction(ctx, booksID, id); err != nil {
		return nil, err
	}

	return s.repo.Versions(ctx, booksID, id)
}

// ReferencedBy returns the non-voided transactions that link to the transaction.
func (s *Service) ReferencedBy(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) ([]Reference, error) {
	if _, err := s.repo.Transaction(ctx, booksID, id); err != nil {
		return nil, err
	}

	return s.repo.LinksTo(ctx, booksID, id)
}

// ListTransactions returns a page and the cursor of the next page, nil on the last page.
func (s *Service) ListTransactions(
	ctx context.Context,
	q TransactionQuery,
) ([]domain.Transaction, *TransactionCursor, error) {
	limit := q.Limit
	q.Limit = limit + 1

	rows, err := s.repo.ListTransactions(ctx, q)
	if err != nil {
		return nil, nil, err
	}

	if len(rows) <= limit {
		return rows, nil, nil
	}

	rows = rows[:limit]
	last := rows[len(rows)-1]

	return rows, &TransactionCursor{Date: last.Date, ID: last.ID}, nil
}

// insert validates, bills, stores and publishes t inside the caller's database transaction.
func (s *Service) insert(
	ctx context.Context,
	r Repository,
	t domain.Transaction,
) (domain.Transaction, error) {
	t.ID = uuid.Must(uuid.NewV7())
	t.Version = 0

	valid, accounts, err := s.validate(ctx, r, t)
	if err != nil {
		return domain.Transaction{}, err
	}

	if err := checkLaterSales(ctx, r, t.BooksID, valid.Date, valid.Postings, valid.ID); err != nil {
		return domain.Transaction{}, err
	}

	if err := s.bill(ctx, r, &valid); err != nil {
		return domain.Transaction{}, err
	}

	created, err := r.InsertTransaction(ctx, valid)
	if err != nil {
		return domain.Transaction{}, err
	}

	return created, r.Publish(ctx, outbox.Event{
		Type: EventTransactionRecorded, BooksID: t.BooksID, AggregateID: created.ID.String(),
		Payload: newTransactionEvent(created, accounts),
	})
}

// validate applies settings defaults and checks references before the domain rules.
func (s *Service) validate(
	ctx context.Context,
	r Repository,
	t domain.Transaction,
) (domain.Transaction, map[uuid.UUID]domain.Account, error) {
	if t.BalancingCurrency == "" {
		settings, err := r.Settings(ctx, t.BooksID)
		if err != nil {
			return domain.Transaction{}, nil, err
		}

		t.BalancingCurrency = settings.BaseCurrency
	}

	accounts, err := s.references(ctx, r, t)
	if err != nil {
		return domain.Transaction{}, nil, err
	}

	valid, err := domain.NewTransaction(t, accounts)

	return valid, accounts, err
}

// addAccounts loads into accounts the accounts of ts it does not hold yet.
func (s *Service) addAccounts(
	ctx context.Context,
	r Repository,
	booksID int64,
	accounts map[uuid.UUID]domain.Account,
	ts ...domain.Transaction,
) error {
	var missing []uuid.UUID
	for _, id := range postingAccounts(ts...) {
		if _, ok := accounts[id]; !ok {
			missing = append(missing, id)
		}
	}

	if len(missing) == 0 {
		return nil
	}

	more, err := r.Accounts(ctx, booksID, missing)
	if err != nil {
		return err
	}

	maps.Copy(accounts, more)

	return nil
}

// references loads the accounts of t and checks its payee and link targets.
func (s *Service) references(
	ctx context.Context,
	r Repository,
	t domain.Transaction,
) (map[uuid.UUID]domain.Account, error) {
	ids := make([]uuid.UUID, 0, len(t.Postings))
	for _, p := range t.Postings {
		ids = append(ids, p.AccountID)
	}

	accounts, err := r.Accounts(ctx, t.BooksID, ids)
	if err != nil {
		return nil, err
	}

	for i, p := range t.Postings {
		a, ok := accounts[p.AccountID]
		if !ok || !a.IsBalance() {
			continue
		}

		parent, err := r.AccountHasChildren(ctx, t.BooksID, a.ID)
		if err != nil {
			return nil, err
		}

		if parent {
			return nil, &domain.FieldError{
				Field:   "postings[" + strconv.Itoa(i) + "].account_id",
				Message: "postings go to the sub-accounts of a parent account",
				Err:     domain.ErrValidation,
			}
		}
	}

	if t.PayeeID != uuid.Nil {
		if _, err := r.Payee(ctx, t.BooksID, t.PayeeID); errors.Is(err, ErrNotFound) {
			return nil, &domain.FieldError{
				Field:   "payee_id",
				Message: "unknown payee",
				Err:     domain.ErrValidation,
			}
		} else if err != nil {
			return nil, err
		}
	}

	for i, l := range t.Links {
		if _, err := r.Transaction(ctx, t.BooksID, l.Target); errors.Is(err, ErrNotFound) {
			return nil, &domain.FieldError{
				Field:   "links[" + strconv.Itoa(i) + "].target",
				Message: "unknown transaction",
				Err:     domain.ErrValidation,
			}
		} else if err != nil {
			return nil, err
		}
	}

	return accounts, nil
}

// newTransactionEvent describes t; accounts holds every account of t, and AccountIDs also
// covers the accounts of the earlier versions given.
func newTransactionEvent(
	t domain.Transaction,
	accounts map[uuid.UUID]domain.Account,
	earlier ...domain.Transaction,
) TransactionEvent {
	return TransactionEvent{
		TransactionID: t.ID,
		Date:          t.Date.Format(time.DateOnly),
		AccountIDs:    accountIDs(append(earlier, t)...),
		Version:       t.Version,
		Origin:        string(t.Origin),
		CategoryState: string(t.CategoryState(accounts)),
	}
}

func accountIDs(ts ...domain.Transaction) []uuid.UUID {
	var ids []uuid.UUID
	for _, t := range ts {
		for _, p := range t.Postings {
			ids = append(ids, p.AccountID)
		}
	}

	slices.SortFunc(ids, func(a, b uuid.UUID) int { return bytes.Compare(a[:], b[:]) })

	return slices.Compact(ids)
}
