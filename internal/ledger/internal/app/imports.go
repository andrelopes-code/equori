package app

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

var ErrAlreadyMatched = errors.New("the transaction is already linked to another external record")

// ImportedPosting is one statement line of a balance account, as Ingestion normalized it.
type ImportedPosting struct {
	AccountID   uuid.UUID
	Date        time.Time
	Amount      money.Money
	Description string
}

// ImportedRecord is a statement line and the external record it comes from.
type ImportedRecord struct {
	RecordID uuid.UUID
	Posting  ImportedPosting
	Decision *ImportDecision // nil: no payee, tags or category
}

// ImportDecision is what Classification decided for a line before it is recorded (P5
// amendment A19). Without parts, the other side is the uncategorized account.
type ImportDecision struct {
	PayeeID uuid.UUID
	AddTags []string
	Parts   []domain.CategoryPart
	Cause   Cause
}

// LineError names the line of a batch that a ledger rule rejected.
type LineError struct {
	Index int
	Err   error
}

func (e *LineError) Error() string { return fmt.Sprintf("line %d: %v", e.Index+1, e.Err) }
func (e *LineError) Unwrap() error { return e.Err }

// RecordImported creates the transaction of one external record; see RecordImportedBatch.
func (s *Service) RecordImported(ctx context.Context, userID int64, recordID uuid.UUID, p ImportedPosting) (uuid.UUID, error) {
	ids, err := s.RecordImportedBatch(ctx, userID, []ImportedRecord{{RecordID: recordID, Posting: p}})
	if le, ok := errors.AsType[*LineError](err); ok {
		return uuid.Nil, le.Err
	}
	if err != nil {
		return uuid.Nil, err
	}
	return ids[0], nil
}

// RecordImportedBatch creates, in one database transaction, the transactions of external
// records against the uncategorized account of each sign (P4 amendment A14). A record that
// a transaction already carries keeps it (A11), so an interrupted import completes without
// duplicates. Ids follow the input order; a rejected line is a *LineError and creates none.
// The accounts, settings and system accounts are read once for the batch, which keeps a
// 1,000-line file within N07.
func (s *Service) RecordImportedBatch(ctx context.Context, userID int64, recs []ImportedRecord) ([]uuid.UUID, error) {
	ids := make([]uuid.UUID, len(recs))
	if len(recs) == 0 {
		return ids, nil
	}
	err := s.repo.InTx(ctx, func(r Repository) error {
		recordIDs := make([]uuid.UUID, len(recs))
		lineAccounts := make([]uuid.UUID, 0, 1)
		var categories []uuid.UUID
		for i, rec := range recs {
			recordIDs[i] = rec.RecordID
			if !slices.Contains(lineAccounts, rec.Posting.AccountID) {
				lineAccounts = append(lineAccounts, rec.Posting.AccountID)
			}
			if rec.Decision != nil {
				for _, p := range rec.Decision.Parts {
					categories = append(categories, p.AccountID)
				}
			}
		}
		existing, err := r.TransactionsByExternalRecords(ctx, userID, recordIDs)
		if err != nil {
			return err
		}
		settings, err := r.Settings(ctx, userID)
		if err != nil {
			return err
		}
		expense, err := r.SystemAccount(ctx, userID, domain.RoleUncategorizedExpense)
		if err != nil {
			return err
		}
		income, err := r.SystemAccount(ctx, userID, domain.RoleUncategorizedIncome)
		if err != nil {
			return err
		}
		accounts, err := r.Accounts(ctx, userID, slices.Concat(lineAccounts, categories, []uuid.UUID{expense.ID, income.ID}))
		if err != nil {
			return err
		}
		leaf := map[uuid.UUID]error{}
		for _, id := range lineAccounts {
			if a, ok := accounts[id]; ok {
				leaf[id] = checkLeafBalance(ctx, r, a)
			}
		}
		for i, rec := range recs {
			if id, ok := existing[rec.RecordID]; ok {
				ids[i] = id
				continue
			}
			if err := leaf[rec.Posting.AccountID]; err != nil {
				return &LineError{Index: i, Err: err}
			}
			t, err := domain.NewTransaction(importedTransaction(userID, settings.BaseCurrency, rec, expense, income), accounts)
			if err != nil {
				return &LineError{Index: i, Err: err}
			}
			if err := s.bill(ctx, r, &t); err != nil {
				if errors.Is(err, domain.ErrValidation) {
					return &LineError{Index: i, Err: err}
				}
				return err
			}
			if err := r.InsertTransactionRows(ctx, t); err != nil {
				return err
			}
			event := newTransactionEvent(t, accounts)
			if rec.Decision != nil && rec.Decision.Cause.Method != "" {
				event.Cause = &rec.Decision.Cause
			}
			if err := r.Publish(ctx, outbox.Event{Type: EventTransactionRecorded, UserID: userID, AggregateID: t.ID.String(), Payload: event}); err != nil {
				return err
			}
			ids[i] = t.ID
		}
		return nil
	})
	return ids, err
}

// importedTransaction books rec against the decided category parts, or against the
// uncategorized account of its sign (P4 amendment A14).
func importedTransaction(userID int64, base money.Currency, rec ImportedRecord, expense, income domain.Account) domain.Transaction {
	t := domain.Transaction{
		ID: uuid.Must(uuid.NewV7()), UserID: userID, Date: rec.Posting.Date, Description: rec.Posting.Description,
		BalancingCurrency: base, Origin: domain.OriginImport,
		Postings: []domain.Posting{{AccountID: rec.Posting.AccountID, Amount: rec.Posting.Amount, ExternalRecordID: rec.RecordID}},
	}
	if d := rec.Decision; d != nil {
		t.PayeeID, t.Tags = d.PayeeID, d.AddTags
		for _, p := range d.Parts {
			t.Postings = append(t.Postings, domain.Posting{AccountID: p.AccountID, Amount: p.Amount})
		}
	}
	if len(t.Postings) == 1 {
		other := income
		if rec.Posting.Amount.IsNegative() {
			other = expense
		}
		t.Postings = append(t.Postings, domain.Posting{AccountID: other.ID, Amount: rec.Posting.Amount.Neg()})
	}
	return t
}

// ImportCurrency returns the currency of an account that can hold statement lines: a leaf
// balance account, like a balance assertion's (P3 amendment A9).
func (s *Service) ImportCurrency(ctx context.Context, userID int64, accountID uuid.UUID) (money.Currency, error) {
	a, err := s.repo.Account(ctx, userID, accountID)
	if err != nil {
		return "", err
	}
	if err := checkLeafBalance(ctx, s.repo, a); err != nil {
		return "", err
	}
	return a.Instrument, nil
}

// LinkedTransaction returns the transaction carrying the external record and whether the
// import created it (origin import) or matched it; ErrNotFound when none carries it.
func (s *Service) LinkedTransaction(ctx context.Context, userID int64, recordID uuid.UUID) (uuid.UUID, bool, error) {
	id, err := s.repo.TransactionByExternalRecord(ctx, userID, recordID)
	if err != nil {
		return uuid.Nil, false, err
	}
	t, err := s.repo.Transaction(ctx, userID, id)
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
}

// UnlinkedPostings lists the account's postings in [from, to] whose transaction is not
// voided and carries no external record (I07). Ingestion chooses among them (chapter 5,
// 5.7, Matcher).
func (s *Service) UnlinkedPostings(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) ([]UnlinkedPosting, error) {
	return s.repo.UnlinkedPostings(ctx, userID, accountID, from, to)
}

// PostingLink is a posting on an account and the external record that confirms it.
type PostingLink struct {
	PostingID, RecordID uuid.UUID
	Voided              bool
}

// Match links an external record to the transaction it confirms.
type Match struct {
	RecordID, TransactionID, AccountID uuid.UUID
}

// ClearMatched links one record; a transaction carrying another record is ErrAlreadyMatched.
func (s *Service) ClearMatched(ctx context.Context, userID int64, recordID, txID, accountID uuid.UUID) error {
	conflicts, err := s.ClearMatchedBatch(ctx, userID, []Match{{RecordID: recordID, TransactionID: txID, AccountID: accountID}})
	if err == nil && len(conflicts) > 0 {
		return ErrAlreadyMatched
	}
	return err
}

// ClearMatchedBatch links records to transactions and clears their pending postings on the
// account, in one database transaction. It returns the indexes of the matches whose
// transaction meanwhile carries another record or was voided; those are left unlinked.
// Repeating a match of the same record is a no-op.
func (s *Service) ClearMatchedBatch(ctx context.Context, userID int64, ms []Match) ([]int, error) {
	var conflicts []int
	if len(ms) == 0 {
		return nil, nil
	}
	err := s.repo.InTx(ctx, func(r Repository) error {
		for i, m := range ms {
			links, err := r.LockAccountPostingLinks(ctx, userID, m.TransactionID, m.AccountID)
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
			if err := r.LinkExternalRecord(ctx, userID, links[free].PostingID, m.RecordID); err != nil {
				return err
			}
			if err := r.ClearPendingPostings(ctx, userID, m.TransactionID, m.AccountID); err != nil {
				return err
			}
		}
		return nil
	})
	return conflicts, err
}
