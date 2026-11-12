package app

import (
	"context"
	"errors"
	"fmt"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/csvfile"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/ingestion/ofx"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	// MaxFileBytes is the content limit of an imported file (P4 amendment A16).
	MaxFileBytes = 10 << 20
	// maxDescription is the ledger's limit on transaction descriptions.
	maxDescription = 500
)

var (
	ErrAlreadyMatched = errors.New("the transaction is already linked to another external record")
	// ErrLineRejected wraps a ledger rule that refused a statement line.
	ErrLineRejected = errors.New("the ledger rejected the line")
	// ErrBalanceRejected wraps a ledger rule that refused the file balance.
	ErrBalanceRejected = errors.New("the ledger rejected the balance")
	// ErrReconciled: the posting is reconciled and keeps its state.
	ErrReconciled = errors.New("the posting is reconciled")
	// ErrNotRetypable: the transaction of a line changed since its import and keeps it (A88).
	ErrNotRetypable = errors.New("the transaction changed since its import")
	// ErrNotPairable: the ledger refuses to make the transaction the transfer of the line (A218).
	ErrNotPairable = errors.New("the transaction cannot become the transfer of the line")
	// ErrNotUnpairable: the paired transaction changed since the pairing (A220 rule 3).
	ErrNotUnpairable = errors.New("the paired transaction changed since the pairing")
	// ErrTransactionVoided: the transaction a record would confirm is voided.
	ErrTransactionVoided = errors.New("the transaction is voided")
	// ErrInstallmentRefused: the ledger cannot place the line in its installment purchase.
	ErrInstallmentRefused = errors.New("the ledger refused the installment line")
)

type ImportFile struct {
	BooksID   int64
	AccountID uuid.UUID
	Source    domain.Source
	FileName  string
	Content   []byte
}

// Import records one file as a batch: every line is deduplicated (I10), then matched to an
// existing transaction or created, and the file balance is asserted (chapter 3, F4). A file
// that cannot be read leaves no batch.
func (s *Service) Import(ctx context.Context, f ImportFile) (domain.Batch, error) {
	if err := validateFile(f); err != nil {
		return domain.Batch{}, err
	}

	target, err := s.ledger.ImportTarget(ctx, f.BooksID, f.AccountID)
	if err != nil {
		return domain.Batch{}, err
	}

	currency := target.Currency

	st, err := s.read(ctx, f, currency)
	if err != nil {
		return domain.Batch{}, err
	}

	unlock, err := s.repo.LockAccountImports(ctx, f.AccountID)
	if err != nil {
		return domain.Batch{}, err
	}
	defer unlock()

	batch, err := s.repo.InsertBatch(ctx, domain.Batch{
		BooksID:    f.BooksID,
		AccountID:  f.AccountID,
		Source:     f.Source,
		FileName:   f.FileName,
		Currency:   string(currency),
		PeriodFrom: st.From,
		PeriodTo:   st.To,
		Balance:    domain.FileBalance{Status: domain.BalanceNone},
	})
	if err != nil {
		return domain.Batch{}, err
	}

	if err := s.importRecords(ctx, &batch, currency, st.Records, nil); err != nil {
		return domain.Batch{}, err
	}

	if st.Balance != nil {
		if err := s.recordFileBalance(ctx, f, &batch, st, currency); err != nil {
			return domain.Batch{}, err
		}
	}

	return s.repo.CompleteBatch(ctx, batch)
}

func (s *Service) recordFileBalance(
	ctx context.Context,
	f ImportFile,
	batch *domain.Batch,
	st domain.Statement,
	currency money.Currency,
) error {
	batch.Balance = domain.FileBalance{
		Status: domain.BalanceRecorded,
		Date:   &st.Balance.Date,
		Amount: st.Balance.Amount,
	}

	err := s.ledger.AssertBalance(ctx, f.BooksID, f.AccountID, *st.Balance, currency)
	if errors.Is(err, ErrBalanceRejected) {
		batch.Balance.Status, batch.Balance.Reason = domain.BalanceSkipped, err.Error()
	} else if err != nil {
		return err
	}

	return nil
}

func validateFile(f ImportFile) error {
	switch {
	case f.Source != domain.SourceOFX && f.Source != domain.SourceCSV:
		return &domain.FieldError{Field: "format", Message: "must be ofx or csv"}
	case f.FileName == "" || utf8.RuneCountInString(f.FileName) > 255:
		return fileError("must have a file name of 1 to 255 characters")
	case len(f.Content) == 0:
		return fileError("must not be empty")
	case len(f.Content) > MaxFileBytes:
		return fileError("must be at most 10 MiB")
	}

	return nil
}

func (s *Service) read(
	ctx context.Context,
	f ImportFile,
	currency money.Currency,
) (domain.Statement, error) {
	scale := currency.MinorUnits()
	if f.Source == domain.SourceCSV {
		p, err := s.repo.Profile(ctx, f.BooksID, f.AccountID)
		if errors.Is(err, ErrNotFound) {
			return domain.Statement{}, &domain.FieldError{
				Field:   "format",
				Message: "the account has no CSV profile; set it with PUT /accounts/{id}/csv-profile",
			}
		}

		if err != nil {
			return domain.Statement{}, err
		}

		st, err := csvfile.Parse(f.Content, p, scale)
		if err != nil {
			return domain.Statement{}, fileError(err.Error())
		}

		return st, nil
	}

	st, err := ofx.Parse(f.Content, scale)
	if err != nil {
		return domain.Statement{}, fileError(err.Error())
	}

	if st.Currency != "" && st.Currency != string(currency) {
		return domain.Statement{}, fileError(
			fmt.Sprintf("is in %s and the account in %s", st.Currency, currency),
		)
	}

	return st, nil
}

func fileError(message string) error { return &domain.FieldError{Field: "file", Message: message} }

func truncate(s string) string {
	if utf8.RuneCountInString(s) <= maxDescription {
		return s
	}

	return string([]rune(s)[:maxDescription])
}

func currencyOf(b domain.Batch) money.Currency { return money.Currency(b.Currency) }
