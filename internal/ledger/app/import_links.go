package app

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// ImportTarget is an account that can hold statement lines.
type ImportTarget struct {
	Currency money.Currency
	Kind     string
}

// ImportTarget returns the currency and kind of an account that can hold statement lines: a
// leaf balance account, like a balance assertion's (P3 amendment A9).
func (s *Service) ImportTarget(ctx context.Context, booksID int64, accountID uuid.UUID) (ImportTarget, error) {
	a, err := s.repo.Account(ctx, booksID, accountID)
	if err != nil {
		return ImportTarget{}, err
	}

	if err := checkLeafBalance(ctx, s.repo, a); err != nil {
		return ImportTarget{}, err
	}

	return ImportTarget{Currency: a.Instrument, Kind: string(a.Kind)}, nil
}

// LinkedTransaction returns the transaction carrying the external record and whether the
// import created it (origin import) or matched it; ErrNotFound when none carries it.
func (s *Service) LinkedTransaction(ctx context.Context, booksID int64, recordID uuid.UUID) (uuid.UUID, bool, error) {
	id, err := s.repo.TransactionByExternalRecord(ctx, booksID, recordID)
	if err != nil {
		return uuid.Nil, false, err
	}

	t, err := s.repo.Transaction(ctx, booksID, id)
	if err != nil {
		return uuid.Nil, false, err
	}

	return id, t.Origin == domain.OriginImport, nil
}

// UnlinkedPosting is a posting a statement line may confirm.
type UnlinkedPosting struct {
	TransactionID uuid.UUID
	Date          time.Time
	Amount        int64
	PayeeID       uuid.UUID
	Description   string
	// StatementID is the card statement of the posting, uuid.Nil without one.
	StatementID uuid.UUID
}

// UnconfirmedPostings lists the first posting of each transaction on the account that no
// external record links and no balance reconciled, with Date the date by which the
// institution reports its line, in [from, to] (A133).
func (s *Service) UnconfirmedPostings(ctx context.Context, booksID int64, accountID uuid.UUID, from, to time.Time) ([]UnlinkedPosting, error) {
	return s.repo.UnconfirmedPostings(ctx, booksID, accountID, from, to)
}

// UnlinkedPostings lists the account's postings in [from, to] whose transaction is not
// voided and carries no external record (I07). Ingestion chooses among them (chapter 5,
// 5.7, Matcher).
func (s *Service) UnlinkedPostings(ctx context.Context, booksID int64, accountID uuid.UUID, from, to time.Time) ([]UnlinkedPosting, error) {
	return s.repo.UnlinkedPostings(ctx, booksID, accountID, from, to)
}

// PostingLink is a posting on an account and the external record that confirms it.
type PostingLink struct {
	PostingID, RecordID uuid.UUID
	Voided              bool
}

// ImportedPostingState is the posting an external record confirms.
type ImportedPostingState struct {
	ID, AccountID uuid.UUID
	Status        domain.PostingStatus
	CardRole      string
	StatementID   uuid.UUID
	StatementDue  *time.Time
}

// ImportedUpdate is what an aggregator now reports about a recorded line (P6 amendment A36).
type ImportedUpdate struct {
	Pending bool
	DueDate *time.Time
	// Kind LineKindPayment turns a card credit recorded before its type was known into a
	// payment (A88).
	Kind string
}

// UpdateImportedPosting clears the posting of a line the aggregator reports posted, bills a
// card posting on the statement of its bill and retypes a card credit the source now types
// as a payment; changed is true when the posting or the transaction took a difference. A
// reconciled posting that is not pending, needs no retype and sits on the statement due on
// the line's bill is (false, nil) (P12 A147); another reconciled posting is ErrReconciled and
// stays as it is. A transaction changed since its import is domain.ErrNotRetypable after the
// other changes; a record no posting carries is ErrNotFound.
func (s *Service) UpdateImportedPosting(ctx context.Context, booksID int64, recordID uuid.UUID, u ImportedUpdate) (changed bool, err error) {
	var role string

	err = s.repo.InTx(ctx, func(r Repository) error {
		p, err := r.LockImportedPosting(ctx, booksID, recordID)
		if err != nil {
			return err
		}

		billed := u.DueDate != nil && p.CardRole != "" && p.CardRole != domain.RolePayment && u.Kind != LineKindPayment
		retype := u.Kind == LineKindPayment && p.CardRole == domain.RoleCredit

		if p.Status == domain.StatusReconciled {
			if !u.Pending && !retype && (!billed || (p.StatementDue != nil && p.StatementDue.Equal(*u.DueDate))) {
				return nil
			}

			return domain.ErrReconciled
		}

		status := p.Status
		if !u.Pending {
			status = domain.StatusCleared
		}

		var statementID uuid.UUID
		if billed {
			ref, err := s.statementDue(ctx, r, booksID, p.AccountID, *u.DueDate)
			if err != nil {
				return err
			}

			rules, err := r.BillingRules(ctx, booksID, p.AccountID)
			if err != nil {
				return err
			}

			if statementID, err = s.ensureStatement(ctx, r, booksID, p.AccountID, ref, rules); err != nil {
				return err
			}
		}

		role = p.CardRole
		changed = status != p.Status || (billed && statementID != p.StatementID)

		return r.SettleImportedPosting(ctx, booksID, p.ID, status, statementID)
	})
	if err != nil || u.Kind != LineKindPayment || role != domain.RoleCredit {
		return changed, err
	}

	err = s.repo.InTx(ctx, func(r Repository) error { return s.retypeAsPayment(ctx, r, booksID, recordID) })
	if err != nil {
		return changed, err
	}

	return true, nil
}

// retypeAsPayment rewrites the transaction carrying the record as a card payment against
// the transit account (A88).
func (s *Service) retypeAsPayment(ctx context.Context, r Repository, booksID int64, recordID uuid.UUID) error {
	id, err := r.TransactionByExternalRecord(ctx, booksID, recordID)
	if err != nil {
		return err
	}

	prev, err := r.LockTransaction(ctx, booksID, id)
	if err != nil {
		return err
	}

	transit, err := r.SystemAccount(ctx, booksID, domain.RoleTransfersInTransit)
	if err != nil {
		return err
	}

	accounts, err := r.Accounts(ctx, booksID, append(postingAccounts(prev), transit.ID))
	if err != nil {
		return err
	}

	next, err := prev.AsCardPayment(transit, accounts)
	if err != nil {
		return err
	}

	if err := s.bill(ctx, r, &next); err != nil {
		return err
	}

	if err := r.ReplaceCategoryPostings(ctx, prev, next, reasonRetyped); err != nil {
		return err
	}

	event := newTransactionEvent(next, accounts, prev)
	event.PreviousDate = prev.Date.Format(time.DateOnly)
	event.CategoriesChanged = true

	return r.Publish(ctx, outbox.Event{Type: EventTransactionCorrected, BooksID: booksID, AggregateID: next.ID.String(), Payload: event})
}

// ReleaseRecord unlinks an external record from its posting; the transaction stays (P6 A38).
func (s *Service) ReleaseRecord(ctx context.Context, booksID int64, recordID uuid.UUID) error {
	return s.repo.ReleaseExternalRecord(ctx, booksID, recordID)
}

// Match links an external record to the transaction it confirms.
type Match struct {
	RecordID, TransactionID, AccountID uuid.UUID
	// KeepPending links a line the institution has not settled without clearing the posting.
	KeepPending bool
}

// ClearMatched links one record; a transaction carrying another record is ErrAlreadyMatched.
func (s *Service) ClearMatched(ctx context.Context, booksID int64, recordID, txID, accountID uuid.UUID) error {
	conflicts, err := s.ClearMatchedBatch(ctx, booksID, []Match{{RecordID: recordID, TransactionID: txID, AccountID: accountID}})
	if err == nil && len(conflicts) > 0 {
		return ErrAlreadyMatched
	}

	return err
}

// ClearMatchedBatch links records to transactions and clears their pending postings on the
// account, in one database transaction. It returns the indexes of the matches whose
// transaction meanwhile carries another record or was voided; those are left unlinked.
// Repeating a match of the same record is a no-op.
func (s *Service) ClearMatchedBatch(ctx context.Context, booksID int64, ms []Match) ([]int, error) {
	var conflicts []int

	if len(ms) == 0 {
		return nil, nil
	}

	err := s.repo.InTx(ctx, func(r Repository) error {
		for i, m := range ms {
			links, err := r.LockAccountPostingLinks(ctx, booksID, m.TransactionID, m.AccountID)
			if err != nil {
				return err
			}

			if slices.ContainsFunc(links, func(l PostingLink) bool { return l.RecordID == m.RecordID }) {
				continue
			}

			free := slices.IndexFunc(links, func(l PostingLink) bool { return l.RecordID == uuid.Nil })
			if free < 0 || links[free].Voided {
				conflicts = append(conflicts, i)
				continue
			}

			if err := r.LinkExternalRecord(ctx, booksID, links[free].PostingID, m.RecordID); err != nil {
				return err
			}

			if m.KeepPending {
				continue
			}

			if err := r.ClearPendingPostings(ctx, booksID, m.TransactionID, m.AccountID); err != nil {
				return err
			}
		}

		return nil
	})

	return conflicts, err
}
