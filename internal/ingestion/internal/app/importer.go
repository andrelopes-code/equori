package app

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
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
	// ErrTransactionVoided: the transaction a record would confirm is voided.
	ErrTransactionVoided = errors.New("the transaction is voided")
	// ErrInstallmentRefused: the ledger cannot place the line in its installment purchase.
	ErrInstallmentRefused = errors.New("the ledger refused the installment line")
)

// Line is a statement line as the ledger receives it.
type Line struct {
	AccountID   uuid.UUID
	Currency    money.Currency
	Date        time.Time
	Amount      int64
	Description string
	Pending     bool                   // the aggregator has not settled it (P6 A36)
	DueDate     *time.Time             // due date of the card bill it belongs to (A39)
	Category    *domain.SourceCategory // the aggregator's category (A41)
	TransferTo  *uuid.UUID             // the reserve the line moves money into or out of (A76)
	Kind        string                 // the card line type the source states (A88)
}

// NewLine is a line to record as a transaction for its external record.
type NewLine struct {
	RecordID uuid.UUID
	Line     Line
}

// Match links an external record to the transaction it confirms; a pending line leaves the
// posting pending.
type Match struct {
	RecordID, TransactionID, AccountID uuid.UUID
	Pending                            bool
}

// RejectedLine is a line of a ledger batch that a ledger rule refused; it matches
// ErrLineRejected.
type RejectedLine struct {
	Index  int
	Reason error
}

func (e *RejectedLine) Error() string        { return e.Reason.Error() }
func (e *RejectedLine) Is(target error) bool { return target == ErrLineRejected }

// Ledger is the part of package ledger an import uses; the module root adapts it. Each call
// is one database transaction of the ledger (ADR 002).
type Ledger interface {
	// ImportTarget returns ErrNotFound for an unknown account and a *domain.FieldError on
	// account_id for an account that cannot hold statement lines.
	ImportTarget(ctx context.Context, userID int64, accountID uuid.UUID) (domain.ImportTarget, error)
	// LinkedTransaction returns ErrNotFound when no transaction carries the record.
	LinkedTransaction(ctx context.Context, userID int64, recordID uuid.UUID) (txID uuid.UUID, imported bool, err error)
	// UnlinkedPostings lists the account's postings in [from, to] that no external record
	// confirms and whose transaction is not voided.
	UnlinkedPostings(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) ([]domain.LedgerPosting, error)
	// LinePayees returns the payee classification decides for each line, uuid.Nil for none,
	// in input order (A99).
	LinePayees(ctx context.Context, userID int64, lines []Line) ([]uuid.UUID, error)
	// RecordImported creates the transactions of the lines, ids in input order; a refused
	// line is a *RejectedLine and creates none.
	RecordImported(ctx context.Context, userID int64, lines []NewLine) ([]uuid.UUID, error)
	// ConfirmLine corrects the transaction to the line's amount and date (A101); a voided
	// transaction is ErrTransactionVoided and a reconciled posting ErrReconciled.
	ConfirmLine(ctx context.Context, userID int64, txID, accountID uuid.UUID, amount int64, date time.Time) error
	// ClearMatched links the matches and returns the indexes of those whose transaction
	// already carries another record.
	ClearMatched(ctx context.Context, userID int64, ms []Match) (conflicts []int, err error)
	AssertBalance(ctx context.Context, userID int64, accountID uuid.UUID, b domain.Balance, c money.Currency) error
	// AssertSyncedBalance records an aggregator balance without yield (P6 A42); a refused
	// assertion wraps ErrBalanceRejected.
	AssertSyncedBalance(ctx context.Context, userID int64, accountID uuid.UUID, b domain.Balance, c money.Currency) error
	// AssertSyncedReserve is AssertSyncedBalance for a reserved balance, which books bounded
	// yield on a positive difference (A75).
	AssertSyncedReserve(ctx context.Context, userID int64, accountID uuid.UUID, b domain.Balance, c money.Currency) error
	// UpdateImportedPosting applies a later report on a recorded line (A36): ErrReconciled
	// leaves the posting as it is; ErrNotFound when no posting carries the record.
	// kind KindPayment retypes a card credit as a payment; ErrNotRetypable when the
	// transaction changed since its import.
	UpdateImportedPosting(ctx context.Context, userID int64, recordID uuid.UUID, pending bool, dueDate *time.Time, kind string) error
	// RecordStatementFacts records a card bill on the ledger statement due on its due date (A85).
	RecordStatementFacts(ctx context.Context, userID int64, accountID uuid.UUID, b domain.Bill, c money.Currency) error
	// RecordCardOpening opens a card that has no opening balance with the total of the bill
	// before its first synced cycle, billed on that bill's statement (A93).
	RecordCardOpening(ctx context.Context, userID int64, accountID uuid.UUID, b domain.Bill, c money.Currency) error
	// SettleReportedStatements moves pending card postings off reported statements and
	// reconciles the reported statements that match (A90, A92).
	SettleReportedStatements(ctx context.Context, userID int64, accountID uuid.UUID) error
	// ReleaseRecord unlinks a withdrawn record from its posting (A38).
	ReleaseRecord(ctx context.Context, userID int64, recordID uuid.UUID) error
	// RecordInstallment creates the installment purchase of the first line seen of it and
	// returns its transaction and plan (A40); a refused line wraps ErrInstallmentRefused.
	RecordInstallment(ctx context.Context, userID int64, l InstallmentLine) (txID, planID uuid.UUID, err error)
	// LinkInstallment links a line to installment number of a plan and returns its
	// transaction; ErrInstallmentRefused when the installment is gone, reversed, of another
	// amount or confirmed by another line.
	LinkInstallment(ctx context.Context, userID int64, recordID, planID uuid.UUID, number int, l Line) (uuid.UUID, error)
}

// InstallmentLine is an aggregator card line that belongs to an installment purchase.
type InstallmentLine struct {
	RecordID    uuid.UUID
	Line        Line
	Installment domain.Installment
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
	target, err := s.ledger.ImportTarget(ctx, f.UserID, f.AccountID)
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
		UserID: f.UserID, AccountID: f.AccountID, Source: f.Source, FileName: f.FileName, Currency: string(currency),
		PeriodFrom: st.From, PeriodTo: st.To, Balance: domain.FileBalance{Status: domain.BalanceNone},
	})
	if err != nil {
		return domain.Batch{}, err
	}
	if err := s.importRecords(ctx, &batch, currency, st.Records, nil); err != nil {
		return domain.Batch{}, err
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

// importRecords deduplicates, matches and creates the lines of one batch with a constant
// number of ledger commits, so that a 1,000-line file stays within N07. A record that a
// previous import left received is processed again (P4 amendment A12). In a sync, a stored
// line the aggregator changed is updated (P6 A36), a withdrawn line returned again is
// processed again (A38), and a line the ledger refuses waits for review instead of failing
// the batch. transferTo, when set, names the account a new line is a transfer to (A76).
func (s *Service) importRecords(ctx context.Context, batch *domain.Batch, currency money.Currency, lines []domain.NormalizedRecord, transferTo func(domain.NormalizedRecord) *uuid.UUID) error {
	sync := batch.Source == domain.SourceAggregator
	ordinals := domain.Ordinals{}
	claims := make([]domain.ExternalRecord, len(lines))
	for i, r := range lines {
		claims[i] = domain.ExternalRecord{
			UserID: batch.UserID, BatchID: batch.ID, AccountID: batch.AccountID, ExternalID: r.ExternalID,
			DedupKey: domain.DedupKey(batch.AccountID, batch.Source, r, ordinals.Next(r)), Raw: r.Raw,
			Date: r.Date, Amount: r.Amount, Description: r.Description, State: domain.StateReceived,
		}
		if sync {
			withFacts(&claims[i], r)
		}
	}
	claimed, err := s.repo.ClaimRecords(ctx, claims)
	if err != nil {
		return err
	}
	batch.Counts.Received = len(lines)
	for i := range claimed {
		if rec := &claimed[i].Record; claimed[i].Existed && rec.State == domain.StateWithdrawn {
			withFacts(rec, lines[i])
			rec.Date, rec.Amount, rec.State, rec.TransactionID, rec.Candidates = lines[i].Date, lines[i].Amount, domain.StateReceived, uuid.Nil, nil
			rec.ReviewReason, rec.Scores = "", nil
			claimed[i].Existed = false
		}
	}

	postings, err := s.unlinked(ctx, batch, claimed)
	if err != nil {
		return err
	}
	var (
		pending []*domain.ExternalRecord
		updated []domain.ExternalRecord
		creates []NewLine
		created []*domain.ExternalRecord
		matches []Match
		matched []*domain.ExternalRecord
		scoring []scoredLine
		parts   []InstallmentLine
		retried []*domain.ExternalRecord
		again   []InstallmentLine
	)
	for i := range claimed {
		rec := &claimed[i].Record
		if r := lines[i]; sync && claimed[i].Existed && rec.State == domain.StateNeedsReview && r.Installment != nil && r.Amount < 0 && len(rec.Candidates) == 0 {
			// A90: an installment line waiting for review is offered again; what refused it
			// (a reconciled installment, a line of an earlier rule) may have changed.
			withFacts(rec, r)
			line := Line{AccountID: rec.AccountID, Currency: currency, Date: rec.Date, Amount: rec.Amount, Description: truncate(rec.Description), Pending: r.Pending, DueDate: r.DueDate, Category: r.Category, Kind: r.Kind}
			retried, again = append(retried, rec), append(again, InstallmentLine{RecordID: rec.ID, Line: line, Installment: *r.Installment})
			continue
		}
		if claimed[i].Existed && rec.State != domain.StateReceived {
			changed, err := s.update(ctx, sync, rec, lines[i])
			if err != nil {
				return err
			}
			if changed {
				batch.Counts.Updated++
				updated = append(updated, *rec)
			} else {
				batch.Counts.Ignored++
			}
			continue
		}
		rec.BatchID = batch.ID
		pending = append(pending, rec)
		r := lines[i]
		line := Line{AccountID: rec.AccountID, Currency: currency, Date: rec.Date, Amount: rec.Amount, Description: truncate(rec.Description), Pending: r.Pending, DueDate: r.DueDate, Category: r.Category, Kind: r.Kind}
		if transferTo != nil {
			line.TransferTo = transferTo(r)
		}
		if sync && r.Installment != nil && r.Amount < 0 {
			// A40: the line goes to its installment purchase; a resumed one finds its own link.
			parts = append(parts, InstallmentLine{RecordID: rec.ID, Line: line, Installment: *r.Installment})
			continue
		}
		if claimed[i].Existed {
			done, err := s.resume(ctx, rec)
			if err != nil {
				return err
			}
			if done {
				continue
			}
		}
		scoring = append(scoring, scoredLine{rec: rec, line: line})
	}
	assigned, err := s.assign(ctx, batch.UserID, scoring, postings)
	if err != nil {
		return err
	}
	for i, a := range assigned {
		rec, line := scoring[i].rec, scoring[i].line
		switch a.Zone {
		case domain.ZoneNew:
			creates, created = append(creates, NewLine{RecordID: rec.ID, Line: line}), append(created, rec)
		case domain.ZoneLink:
			matches = append(matches, Match{RecordID: rec.ID, TransactionID: a.TransactionID, AccountID: rec.AccountID, Pending: line.Pending})
			matched = append(matched, rec)
		default:
			rec.State, rec.ReviewReason, rec.Scores = domain.StateNeedsReview, string(a.Zone), a.Candidates
			rec.Candidates = make([]uuid.UUID, len(a.Candidates))
			for j, c := range a.Candidates {
				rec.Candidates[j] = c.TransactionID
			}
		}
	}

	conflicts, err := s.ledger.ClearMatched(ctx, batch.UserID, matches)
	if err != nil {
		return err
	}
	for i, rec := range matched {
		rec.State, rec.TransactionID = domain.StateMatched, matches[i].TransactionID
		if slices.Contains(conflicts, i) {
			rec.State, rec.TransactionID, rec.Candidates = domain.StateNeedsReview, uuid.Nil, []uuid.UUID{matches[i].TransactionID}
			continue
		}
		if err := s.billMatched(ctx, rec, matches[i].Pending); err != nil {
			return err
		}
	}
	if err := s.create(ctx, batch.UserID, sync, creates, created); err != nil {
		return err
	}
	if err := s.installments(ctx, batch, parts, pending); err != nil {
		return err
	}
	if err := s.installments(ctx, batch, again, retried); err != nil {
		return err
	}
	for _, rec := range retried {
		if rec.State == domain.StateNeedsReview {
			batch.Counts.Ignored++
			continue
		}
		// The record stays in its batch, which counts it as resolved.
		if err := s.repo.ResolveRecord(ctx, *rec); err != nil {
			return err
		}
		batch.Counts.Updated++
	}

	outcomes := make([]domain.ExternalRecord, len(pending))
	for i, rec := range pending {
		batch.Counts.Count(rec.State)
		outcomes[i] = *rec
	}
	if err := s.repo.UpdateRecordFacts(ctx, updated); err != nil {
		return err
	}
	return s.repo.SaveOutcomes(ctx, outcomes)
}

// create records the transactions of new lines. A line the ledger refuses fails a file
// import; in a sync it waits for review and the other lines are created.
func (s *Service) create(ctx context.Context, userID int64, sync bool, creates []NewLine, created []*domain.ExternalRecord) error {
	for {
		ids, err := s.ledger.RecordImported(ctx, userID, creates)
		rejected, ok := errors.AsType[*RejectedLine](err)
		switch {
		case ok && sync:
			created[rejected.Index].State = domain.StateNeedsReview
			creates, created = slices.Delete(creates, rejected.Index, rejected.Index+1), slices.Delete(created, rejected.Index, rejected.Index+1)
			continue
		case ok:
			rec := created[rejected.Index]
			return fileError(fmt.Sprintf("line dated %s for %d: %v", rec.Date.Format(time.DateOnly), rec.Amount, rejected.Reason))
		case err != nil:
			return err
		}
		for i, rec := range created {
			rec.State, rec.TransactionID = domain.StateCreated, ids[i]
		}
		return nil
	}
}

// withFacts copies what an aggregator reports about a line onto its record.
func withFacts(rec *domain.ExternalRecord, r domain.NormalizedRecord) {
	rec.ExternalStatus, rec.DueDate, rec.Installment, rec.BalanceAfter, rec.Raw = domain.ExternalStatusOf(r), r.DueDate, r.Installment, r.BalanceAfter, r.Raw
	rec.LineKind = r.Kind
	rec.CategoryID = ""
	if r.Category != nil {
		rec.CategoryID = r.Category.ID
	}
}

// update applies an aggregator's change to a stored line that the ledger recorded (P6 A36):
// a posted line clears its posting, a bill moves a card posting to the bill's statement.
// A reconciled posting and an amount change stay out of the ledger and are described on
// the record. It reports whether the aggregator changed the line.
func (s *Service) update(ctx context.Context, sync bool, rec *domain.ExternalRecord, r domain.NormalizedRecord) (bool, error) {
	if !sync || (rec.State != domain.StateMatched && rec.State != domain.StateCreated) {
		return false, nil
	}
	settled := rec.ExternalStatus != domain.ExternalStatusOf(r) || !sameDate(rec.DueDate, r.DueDate)
	retype := r.Kind == domain.KindPayment && rec.LineKind != r.Kind
	moved := rec.Amount != r.Amount || !rec.Date.Equal(r.Date)
	if !settled && !retype && !moved {
		return false, nil
	}
	var notes []string
	applied := rec.LineKind
	if settled || retype {
		err := s.ledger.UpdateImportedPosting(ctx, rec.UserID, rec.ID, r.Pending, r.DueDate, r.Kind)
		switch {
		case errors.Is(err, ErrReconciled):
			notes = append(notes, "the aggregator reports the line "+strings.ToLower(domain.ExternalStatusOf(r))+billNote(r.DueDate)+"; the posting is reconciled and keeps its status and statement")
			retype = false
		case errors.Is(err, ErrNotRetypable):
			notes = append(notes, "the aggregator reports the line as a card payment; the transaction changed since its import and keeps its categories")
			retype = false
		case err != nil && !errors.Is(err, ErrNotFound):
			return false, err
		}
	}
	if moved {
		note, err := s.followLine(ctx, rec, r)
		if err != nil {
			return false, err
		}
		if note != "" {
			notes = append(notes, note)
		}
	}
	withFacts(rec, r)
	if !retype {
		// A type the ledger did not take stays unapplied, so a later sync offers it again (A88).
		rec.LineKind = applied
	}
	rec.UnappliedChange = strings.Join(notes, "; ")
	return true, nil
}

// followLine corrects the transaction of a linked line to the line's new amount and date
// (A102). A reconciled posting keeps them: the record describes the change and is flagged
// with review reason changed. An installment keeps the amount its plan fixes.
func (s *Service) followLine(ctx context.Context, rec *domain.ExternalRecord, r domain.NormalizedRecord) (string, error) {
	kept := fmt.Sprintf("the aggregator reports %d minor units on %s; the ledger keeps %d on %s",
		r.Amount, r.Date.Format(time.DateOnly), rec.Amount, rec.Date.Format(time.DateOnly))
	if rec.Installment != nil || rec.TransactionID == uuid.Nil {
		return kept, nil
	}
	err := s.ledger.ConfirmLine(ctx, rec.UserID, rec.TransactionID, rec.AccountID, r.Amount, r.Date)
	switch {
	case errors.Is(err, ErrReconciled):
		rec.ReviewReason = domain.ReviewChanged
		return kept, nil
	case errors.Is(err, ErrTransactionVoided), errors.Is(err, ErrNotFound):
		return kept, nil
	case err != nil:
		return "", err
	}
	rec.Amount, rec.Date, rec.ReviewReason = r.Amount, r.Date, ""
	return "", nil
}

// billMatched moves a matched card posting to the statement of the line's bill, as update
// does for a line that keeps its id (P6 A36): a pending charge may come back posted under a
// new id with its bill.
func (s *Service) billMatched(ctx context.Context, rec *domain.ExternalRecord, pending bool) error {
	if rec.DueDate == nil {
		return nil
	}
	err := s.ledger.UpdateImportedPosting(ctx, rec.UserID, rec.ID, pending, rec.DueDate, "")
	switch {
	case errors.Is(err, ErrReconciled):
		rec.UnappliedChange = "the aggregator reports the line" + billNote(rec.DueDate) + "; the posting is reconciled and keeps its status and statement"
	case err != nil && !errors.Is(err, ErrNotFound):
		return err
	}
	return nil
}

func billNote(due *time.Time) string {
	if due == nil {
		return ""
	}
	return " on the bill due " + due.Format(time.DateOnly)
}

func sameDate(a, b *time.Time) bool {
	return (a == nil) == (b == nil) && (a == nil || a.Equal(*b))
}

// unlinked reads, in one query, the postings the new lines of the file may confirm.
func (s *Service) unlinked(ctx context.Context, batch *domain.Batch, claimed []Claim) ([]domain.LedgerPosting, error) {
	var from, to time.Time
	for _, c := range claimed {
		if c.Existed {
			continue
		}
		if from.IsZero() || c.Record.Date.Before(from) {
			from = c.Record.Date
		}
		if c.Record.Date.After(to) {
			to = c.Record.Date
		}
	}
	if from.IsZero() {
		return nil, nil
	}
	return s.ledger.UnlinkedPostings(ctx, batch.UserID, batch.AccountID, from.AddDate(0, 0, -domain.MatchHardLimit), to.AddDate(0, 0, domain.MatchHardLimit))
}

// scoredLine is a line that matching decides: link, review or create.
type scoredLine struct {
	rec  *domain.ExternalRecord
	line Line
}

// assign decides the lines by score (A98–A100); the payees of the lines are asked of
// classification only when the account has postings to compare.
func (s *Service) assign(ctx context.Context, userID int64, lines []scoredLine, postings []domain.LedgerPosting) ([]domain.Assignment, error) {
	if len(lines) == 0 {
		return nil, nil
	}
	if len(postings) == 0 {
		out := make([]domain.Assignment, len(lines))
		for i := range out {
			out[i].Zone = domain.ZoneNew
		}
		return out, nil
	}
	plain := make([]Line, len(lines))
	for i, l := range lines {
		plain[i] = l.line
	}
	payees, err := s.ledger.LinePayees(ctx, userID, plain)
	if err != nil {
		return nil, err
	}
	compared := make([]domain.MatchLine, len(lines))
	for i, l := range lines {
		compared[i] = domain.MatchLine{Date: l.rec.Date, Amount: l.rec.Amount, PayeeID: payees[i], Description: l.rec.Description}
	}
	return domain.Assign(compared, postings), nil
}

// resume completes a record whose transaction a previous import committed in the ledger
// before it stopped (P4 amendments A11, A12); it reports whether the record is done.
func (s *Service) resume(ctx context.Context, rec *domain.ExternalRecord) (bool, error) {
	txID, imported, err := s.ledger.LinkedTransaction(ctx, rec.UserID, rec.ID)
	if errors.Is(err, ErrNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	rec.State, rec.TransactionID = domain.StateMatched, txID
	if imported {
		rec.State = domain.StateCreated
	}
	return true, nil
}

func currencyOf(b domain.Batch) money.Currency { return money.Currency(b.Currency) }

func truncate(s string) string {
	if utf8.RuneCountInString(s) <= maxDescription {
		return s
	}
	return string([]rune(s)[:maxDescription])
}
