package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

var ErrAlreadyMatched = errors.New("the transaction is already linked to another external record")

// ImportedPosting is one statement line of a balance account, as Ingestion normalized it.
type ImportedPosting struct {
	AccountID   uuid.UUID
	Date        time.Time
	Amount      money.Money
	Description string
}

// RecordImported creates the transaction of an external record against the uncategorized
// account of its sign (P4 amendment A14). A second call for the same record returns the
// first transaction (A11), so an interrupted import completes without a duplicate.
func (s *Service) RecordImported(ctx context.Context, userID int64, recordID uuid.UUID, p ImportedPosting) (uuid.UUID, error) {
	var id uuid.UUID
	err := s.repo.InTx(ctx, func(r Repository) error {
		existing, err := r.TransactionByExternalRecord(ctx, userID, recordID)
		if err == nil {
			id = existing
			return nil
		}
		if !errors.Is(err, ErrNotFound) {
			return err
		}
		role := domain.RoleUncategorizedIncome
		if p.Amount.IsNegative() {
			role = domain.RoleUncategorizedExpense
		}
		other, err := r.SystemAccount(ctx, userID, role)
		if err != nil {
			return err
		}
		t, err := s.insert(ctx, r, domain.Transaction{
			UserID: userID, Date: p.Date, Description: p.Description, Origin: domain.OriginImport, ExternalRecordID: recordID,
			Postings: []domain.Posting{{AccountID: p.AccountID, Amount: p.Amount}, {AccountID: other.ID, Amount: p.Amount.Neg()}},
		})
		id = t.ID
		return err
	})
	return id, err
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

// MatchCandidates lists the transactions an external record may confirm: a non-voided
// posting on the account for the same amount within window days, not linked to another
// record (chapter 3, F4; I07).
func (s *Service) MatchCandidates(ctx context.Context, userID int64, p ImportedPosting, window int) ([]uuid.UUID, error) {
	return s.repo.MatchCandidates(ctx, userID, p.AccountID, p.Amount.Amount(), p.Date.AddDate(0, 0, -window), p.Date.AddDate(0, 0, window))
}

// ClearMatched links the record to the transaction and clears its pending postings on the
// account. Repeating it for the same record is a no-op.
func (s *Service) ClearMatched(ctx context.Context, userID int64, recordID, txID, accountID uuid.UUID) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		t, err := r.LockTransaction(ctx, userID, txID)
		if err != nil {
			return err
		}
		switch {
		case t.ExternalRecordID == recordID:
			return nil
		case t.ExternalRecordID != uuid.Nil:
			return ErrAlreadyMatched
		case t.VoidedAt != nil:
			return domain.ErrVoided
		}
		if err := r.LinkExternalRecord(ctx, userID, txID, recordID); err != nil {
			return err
		}
		return r.ClearPendingPostings(ctx, userID, txID, accountID)
	})
}
