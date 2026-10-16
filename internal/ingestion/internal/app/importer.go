package app

import (
	"context"
	"errors"
	"fmt"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/csvfile"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/ofx"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	// MaxFileBytes is the content limit of an imported file (P4 amendment A16).
	MaxFileBytes = 10 << 20
	// matchWindow is the distance in days between a statement line and the transaction it
	// confirms (chapter 3, F4).
	matchWindow = 3
	// maxDescription is the ledger's limit on transaction descriptions.
	maxDescription = 500
)

var (
	ErrAlreadyMatched = errors.New("the transaction is already linked to another external record")
	// ErrLineRejected wraps a ledger rule that refused a statement line.
	ErrLineRejected = errors.New("the ledger rejected the line")
	// ErrBalanceRejected wraps a ledger rule that refused the file balance.
	ErrBalanceRejected = errors.New("the ledger rejected the balance")
)

// Line is a statement line as the ledger receives it.
type Line struct {
	AccountID   uuid.UUID
	Currency    money.Currency
	Date        time.Time
	Amount      int64
	Description string
}

// Ledger is the part of package ledger an import uses; the module root adapts it.
type Ledger interface {
	// ImportCurrency returns ErrNotFound for an unknown account and a *domain.FieldError on
	// account_id for an account that cannot hold statement lines.
	ImportCurrency(ctx context.Context, userID int64, accountID uuid.UUID) (money.Currency, error)
	// LinkedTransaction returns ErrNotFound when no transaction carries the record.
	LinkedTransaction(ctx context.Context, userID int64, recordID uuid.UUID) (txID uuid.UUID, imported bool, err error)
	RecordImported(ctx context.Context, userID int64, recordID uuid.UUID, l Line) (uuid.UUID, error)
	MatchCandidates(ctx context.Context, userID int64, l Line, window int) ([]uuid.UUID, error)
	ClearMatched(ctx context.Context, userID int64, recordID, txID, accountID uuid.UUID) error
	AssertBalance(ctx context.Context, userID int64, accountID uuid.UUID, b domain.Balance, c money.Currency) error
}

type ImportFile struct {
	UserID    int64
	AccountID uuid.UUID
	Source    domain.Source
	FileName  string
	Content   []byte
}

func fileError(message string) error { return &domain.FieldError{Field: "file", Message: message} }

// Import records one file as a batch: every line is deduplicated (I10), then matched to an
// existing transaction or created, and the file balance is asserted (chapter 3, F4). A file
// that cannot be read leaves no batch.
func (s *Service) Import(ctx context.Context, f ImportFile) (domain.Batch, error) {
	switch {
	case f.Source != domain.SourceOFX && f.Source != domain.SourceCSV:
		return domain.Batch{}, &domain.FieldError{Field: "format", Message: "must be ofx or csv"}
	case f.FileName == "" || utf8.RuneCountInString(f.FileName) > 255:
		return domain.Batch{}, fileError("must have a file name of 1 to 255 characters")
	case len(f.Content) == 0:
		return domain.Batch{}, fileError("must not be empty")
	case len(f.Content) > MaxFileBytes:
		return domain.Batch{}, fileError("must be at most 10 MiB")
	}
	currency, err := s.ledger.ImportCurrency(ctx, f.UserID, f.AccountID)
	if err != nil {
		return domain.Batch{}, err
	}
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
		UserID: f.UserID, AccountID: f.AccountID, Source: f.Source, FileName: f.FileName, Currency: string(currency),
		PeriodFrom: st.From, PeriodTo: st.To, Balance: domain.FileBalance{Status: domain.BalanceNone},
	})
	if err != nil {
		return domain.Batch{}, err
	}
	ordinals := domain.Ordinals{}
	for i, r := range st.Records {
		batch.Counts.Received++
		state, err := s.importRecord(ctx, batch, currency, r, ordinals.Next(r))
		if errors.Is(err, ErrLineRejected) {
			return domain.Batch{}, fileError(fmt.Sprintf("record %d (%s, %d): %v", i+1, r.Date.Format(time.DateOnly), r.Amount, err))
		}
		if err != nil {
			return domain.Batch{}, err
		}
		if state == "" {
			batch.Counts.Ignored++
			continue
		}
		batch.Counts.Count(state)
	}
	if st.Balance != nil {
		batch.Balance = domain.FileBalance{Status: domain.BalanceRecorded, Date: &st.Balance.Date, Amount: st.Balance.Amount}
		err := s.ledger.AssertBalance(ctx, f.UserID, f.AccountID, *st.Balance, currency)
		if errors.Is(err, ErrBalanceRejected) {
			batch.Balance.Status, batch.Balance.Reason = domain.BalanceSkipped, err.Error()
		} else if err != nil {
			return domain.Batch{}, err
		}
	}
	return s.repo.CompleteBatch(ctx, batch)
}

func (s *Service) read(ctx context.Context, f ImportFile, currency money.Currency) (domain.Statement, error) {
	scale := currency.MinorUnits()
	if f.Source == domain.SourceCSV {
		p, err := s.repo.Profile(ctx, f.UserID, f.AccountID)
		if errors.Is(err, ErrNotFound) {
			return domain.Statement{}, &domain.FieldError{Field: "format", Message: "the account has no CSV profile; set it with PUT /accounts/{id}/csv-profile"}
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
		return domain.Statement{}, fileError(fmt.Sprintf("is in %s and the account in %s", st.Currency, currency))
	}
	return st, nil
}

// importRecord returns the record's new state, or "" for a duplicate of a finished record.
// A record a previous import left received is processed again (P4 amendment A12).
func (s *Service) importRecord(ctx context.Context, batch domain.Batch, currency money.Currency, r domain.NormalizedRecord, ordinal int) (domain.RecordState, error) {
	rec, existed, err := s.repo.ClaimRecord(ctx, domain.ExternalRecord{
		UserID: batch.UserID, BatchID: batch.ID, AccountID: batch.AccountID, ExternalID: r.ExternalID,
		DedupKey: domain.DedupKey(batch.AccountID, batch.Source, r, ordinal), Raw: r.Raw,
		Date: r.Date, Amount: r.Amount, Description: r.Description, State: domain.StateReceived,
	})
	if err != nil {
		return "", err
	}
	if existed && rec.State != domain.StateReceived {
		return "", nil
	}
	rec.BatchID = batch.ID
	line := Line{AccountID: rec.AccountID, Currency: currency, Date: rec.Date, Amount: rec.Amount, Description: truncate(rec.Description)}
	if err := s.decide(ctx, &rec, line); err != nil {
		return "", err
	}
	return rec.State, s.repo.SaveOutcome(ctx, rec)
}

// decide matches, creates or queues the record. A transaction already carrying the record
// means a previous import committed it in the ledger and stopped before saving the outcome.
func (s *Service) decide(ctx context.Context, rec *domain.ExternalRecord, line Line) error {
	txID, imported, err := s.ledger.LinkedTransaction(ctx, rec.UserID, rec.ID)
	switch {
	case err == nil && imported:
		rec.State, rec.TransactionID = domain.StateCreated, txID
		return nil
	case err == nil:
		rec.State, rec.TransactionID = domain.StateMatched, txID
		return nil
	case !errors.Is(err, ErrNotFound):
		return err
	}
	candidates, err := s.ledger.MatchCandidates(ctx, rec.UserID, line, matchWindow)
	if err != nil {
		return err
	}
	switch len(candidates) {
	case 0:
		id, err := s.ledger.RecordImported(ctx, rec.UserID, rec.ID, line)
		if err != nil {
			return err
		}
		rec.State, rec.TransactionID = domain.StateCreated, id
	case 1:
		err := s.ledger.ClearMatched(ctx, rec.UserID, rec.ID, candidates[0], rec.AccountID)
		if errors.Is(err, ErrAlreadyMatched) {
			rec.State, rec.Candidates = domain.StateNeedsReview, candidates
			return nil
		}
		if err != nil {
			return err
		}
		rec.State, rec.TransactionID = domain.StateMatched, candidates[0]
	default:
		rec.State, rec.Candidates = domain.StateNeedsReview, candidates
	}
	return nil
}

func currencyOf(b domain.Batch) money.Currency { return money.Currency(b.Currency) }

func truncate(s string) string {
	if utf8.RuneCountInString(s) <= maxDescription {
		return s
	}
	return string([]rune(s)[:maxDescription])
}
