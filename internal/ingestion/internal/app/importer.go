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

// GroupPart is one line of a group that confirms an entry (A169): its record, amount, date and
// status, and the transaction the import created for it, uuid.Nil for a line without one.
type GroupPart struct {
	RecordID  uuid.UUID
	Amount    int64
	Date      time.Time
	Pending   bool
	CreatedTx uuid.UUID
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
	ImportTarget(ctx context.Context, booksID int64, accountID uuid.UUID) (domain.ImportTarget, error)
	// LinkedTransaction returns ErrNotFound when no transaction carries the record.
	LinkedTransaction(ctx context.Context, booksID int64, recordID uuid.UUID) (txID uuid.UUID, imported bool, err error)
	// UnlinkedPostings lists the account's postings in [from, to] that no external record
	// confirms and whose transaction is not voided.
	UnlinkedPostings(ctx context.Context, booksID int64, accountID uuid.UUID, from, to time.Time) ([]domain.LedgerPosting, error)
	// UnconfirmedPostings lists the account's postings that neither a line nor a balance
	// confirms, dated by when the institution reports them (A133).
	UnconfirmedPostings(ctx context.Context, booksID int64, accountID uuid.UUID, from, to time.Time) ([]domain.LedgerPosting, error)
	// LinePayees returns the payee classification decides for each line, uuid.Nil for none,
	// in input order (A99).
	LinePayees(ctx context.Context, booksID int64, lines []Line) ([]uuid.UUID, error)
	// RecordImported creates the transactions of the lines, ids in input order; a refused
	// line is a *RejectedLine and creates none.
	RecordImported(ctx context.Context, booksID int64, lines []NewLine) ([]uuid.UUID, error)
	// ConfirmLine corrects the transaction to the line's amount and date (A101); a voided
	// transaction is ErrTransactionVoided and a reconciled posting ErrReconciled.
	ConfirmLine(ctx context.Context, booksID int64, txID, accountID uuid.UUID, amount int64, date time.Time) error
	// GroupableTransactions returns the transactions among txIDs that a group may take over (A167).
	GroupableTransactions(ctx context.Context, booksID int64, txIDs []uuid.UUID) ([]uuid.UUID, error)
	// ConfirmGroup confirms the entry by the lines of a group (A169); ErrGroupChanged when the
	// entry cannot take one.
	ConfirmGroup(ctx context.Context, booksID int64, txID, accountID uuid.UUID, parts []GroupPart) error
	// MoveReconciledDate moves a transaction with a reconciled card posting to the line's date
	// when every reconciled posting keeps its statement (A147); else ErrReconciled.
	MoveReconciledDate(ctx context.Context, booksID int64, txID, accountID uuid.UUID, date time.Time) error
	// ClearMatched links the matches and returns the indexes of those whose transaction
	// already carries another record.
	ClearMatched(ctx context.Context, booksID int64, ms []Match) (conflicts []int, err error)
	AssertBalance(ctx context.Context, booksID int64, accountID uuid.UUID, b domain.Balance, c money.Currency) error
	// AssertSyncedBalance records an aggregator balance without yield (P6 A42); a refused
	// assertion wraps ErrBalanceRejected.
	AssertSyncedBalance(ctx context.Context, booksID int64, accountID uuid.UUID, b domain.Balance, c money.Currency) error
	// AssertSyncedReserve is AssertSyncedBalance for a reserved balance, which books bounded
	// yield on a positive difference (A75).
	AssertSyncedReserve(ctx context.Context, booksID int64, accountID uuid.UUID, b domain.Balance, c money.Currency) error
	// UpdateImportedPosting applies a later report on a recorded line (A36) and reports
	// whether the posting changed. A reconciled posting that already holds the reported
	// status and bill is (false, nil) (A147); one that does not is ErrReconciled. kind
	// KindPayment retypes a card credit as a payment; ErrNotRetypable when the transaction
	// changed since its import. ErrNotFound when no posting carries the record.
	UpdateImportedPosting(ctx context.Context, booksID int64, recordID uuid.UUID, pending bool, dueDate *time.Time, kind string) (bool, error)
	// RecordStatementFacts records a card bill on the ledger statement due on its due date (A85).
	RecordStatementFacts(ctx context.Context, booksID int64, accountID uuid.UUID, b domain.Bill, c money.Currency) error
	// RecordCardOpening opens a card that has no opening balance with the total of the bill
	// before its first synced cycle, billed on that bill's statement (A93).
	RecordCardOpening(ctx context.Context, booksID int64, accountID uuid.UUID, b domain.Bill, c money.Currency) error
	// SettleReportedStatements moves pending card postings off reported statements and
	// reconciles the reported statements that match (A90, A92).
	SettleReportedStatements(ctx context.Context, booksID int64, accountID uuid.UUID) error
	// ReleaseRecord unlinks a withdrawn record from its posting (A38).
	ReleaseRecord(ctx context.Context, booksID int64, recordID uuid.UUID) error
	// RecordInstallment creates the installment purchase of the first line seen of it and
	// returns its transaction and plan (A40); a refused line wraps ErrInstallmentRefused.
	RecordInstallment(ctx context.Context, booksID int64, l InstallmentLine) (txID, planID uuid.UUID, err error)
	// LinkInstallment links a line to installment number of a plan and returns its
	// transaction; ErrInstallmentRefused when the installment is gone, reversed, of another
	// amount or confirmed by another line.
	LinkInstallment(ctx context.Context, booksID int64, recordID, planID uuid.UUID, number int, l Line) (uuid.UUID, error)
}

// InstallmentLine is an aggregator card line that belongs to an installment purchase.
type InstallmentLine struct {
	RecordID    uuid.UUID
	Line        Line
	Installment domain.Installment
}

type ImportFile struct {
	BooksID   int64
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
		BooksID: f.BooksID, AccountID: f.AccountID, Source: f.Source, FileName: f.FileName, Currency: string(currency),
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

		err := s.ledger.AssertBalance(ctx, f.BooksID, f.AccountID, *st.Balance, currency)
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
		p, err := s.repo.Profile(ctx, f.BooksID, f.AccountID)
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

// importPlan is the state of one importRecords call: the lines, their claimed records and the
// groups the lines fall into.
type importPlan struct {
	batch      *domain.Batch
	currency   money.Currency
	sync       bool
	lines      []domain.NormalizedRecord
	transferTo func(domain.NormalizedRecord) *uuid.UUID
	claimed    []Claim

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
}

// importRecords deduplicates, matches and creates the lines of one batch with a constant
// number of ledger commits, so that a 1,000-line file stays within N07. A record that a
// previous import left received is processed again (P4 amendment A12). In a sync, a stored
// line the aggregator changed is updated (P6 A36), a withdrawn line returned again is
// processed again (A38), and a line the ledger refuses waits for review instead of failing
// the batch. transferTo, when set, names the account a new line is a transfer to (A76).
func (s *Service) importRecords(
	ctx context.Context,
	batch *domain.Batch,
	currency money.Currency,
	lines []domain.NormalizedRecord,
	transferTo func(domain.NormalizedRecord) *uuid.UUID,
) error {
	p := &importPlan{
		batch:      batch,
		currency:   currency,
		sync:       batch.Source == domain.SourceAggregator,
		lines:      lines,
		transferTo: transferTo,
	}

	if err := s.claimLines(ctx, p); err != nil {
		return err
	}

	postings, err := s.unlinked(ctx, batch, p.claimed)
	if err != nil {
		return err
	}

	if err := s.classifyLines(ctx, p); err != nil {
		return err
	}

	assigned, err := s.assign(ctx, batch.BooksID, p.scoring, postings)
	if err != nil {
		return err
	}

	repeated, err := s.repeatedLines(ctx, p, assigned)
	if err != nil {
		return err
	}

	grouped, err := s.groupedLines(ctx, p, assigned, repeated, postings)
	if err != nil {
		return err
	}

	p.route(assigned, repeated, grouped)

	if err := s.linkMatches(ctx, p); err != nil {
		return err
	}

	if err := s.create(ctx, batch.BooksID, p.sync, p.creates, p.created); err != nil {
		return err
	}

	if err := s.placeInstallments(ctx, p); err != nil {
		return err
	}

	return s.saveOutcomes(ctx, p)
}

func (s *Service) claimLines(ctx context.Context, p *importPlan) error {
	ordinals := domain.Ordinals{}

	claims := make([]domain.ExternalRecord, len(p.lines))
	for i, r := range p.lines {
		claims[i] = domain.ExternalRecord{
			BooksID:     p.batch.BooksID,
			BatchID:     p.batch.ID,
			AccountID:   p.batch.AccountID,
			ExternalID:  r.ExternalID,
			DedupKey:    domain.DedupKey(p.batch.AccountID, p.batch.Source, r, ordinals.Next(r)),
			Raw:         r.Raw,
			Date:        r.Date,
			Amount:      r.Amount,
			Description: r.Description,
			State:       domain.StateReceived,

			InstitutionID:  r.InstitutionID,
			ReportedAmount: r.Amount,
			ReportedOn:     r.Date,
		}
		if p.sync {
			withFacts(&claims[i], r)
		}
	}

	claimed, err := s.repo.ClaimRecords(ctx, claims)
	if err != nil {
		return err
	}

	p.batch.Counts.Received = len(p.lines)
	reopenWithdrawn(claimed, p.lines)

	p.claimed = claimed

	return nil
}

func (s *Service) classifyLines(ctx context.Context, p *importPlan) error {
	for i := range p.claimed {
		if err := s.classifyLine(ctx, p, i); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) classifyLine(ctx context.Context, p *importPlan, i int) error {
	rec, r := &p.claimed[i].Record, p.lines[i]
	existed := p.claimed[i].Existed

	if p.sync && existed && rec.State == domain.StateNeedsReview &&
		r.Installment != nil && r.Amount < 0 && len(rec.Candidates) == 0 {
		p.offerAgain(rec, r)

		return nil
	}

	if existed && rec.State != domain.StateReceived {
		return s.applyStoredChange(ctx, p, rec, r)
	}

	rec.BatchID = p.batch.ID
	p.pending = append(p.pending, rec)

	line := p.lineOf(rec, r)
	if p.transferTo != nil {
		line.TransferTo = p.transferTo(r)
	}

	if p.sync && r.Installment != nil && r.Amount < 0 {
		// A40: the line goes to its installment purchase; a resumed one finds its own link.
		p.parts = append(p.parts, InstallmentLine{RecordID: rec.ID, Line: line, Installment: *r.Installment})

		return nil
	}

	if existed {
		done, err := s.resume(ctx, rec)
		if err != nil {
			return err
		}

		if done {
			return nil
		}
	}

	p.scoring = append(p.scoring, scoredLine{rec: rec, line: line})

	return nil
}

func (s *Service) applyStoredChange(
	ctx context.Context,
	p *importPlan,
	rec *domain.ExternalRecord,
	r domain.NormalizedRecord,
) error {
	reported, changed, err := s.update(ctx, p.sync, p.batch.ID, rec, r)
	if err != nil {
		return err
	}

	if reported {
		p.updated = append(p.updated, *rec)
	}

	if changed {
		p.batch.Counts.Updated++
	} else {
		p.batch.Counts.Ignored++
	}

	return nil
}

func (s *Service) repeatedLines(
	ctx context.Context,
	p *importPlan,
	assigned []domain.Assignment,
) (map[int]bool, error) {
	if !p.sync {
		return nil, nil
	}

	return s.repeats(ctx, p.batch, p.scoring, assigned)
}

func (s *Service) linkMatches(ctx context.Context, p *importPlan) error {
	conflicts, err := s.ledger.ClearMatched(ctx, p.batch.BooksID, p.matches)
	if err != nil {
		return err
	}

	for i, rec := range p.matched {
		rec.State, rec.TransactionID = domain.StateMatched, p.matches[i].TransactionID
		if slices.Contains(conflicts, i) {
			rec.State, rec.TransactionID, rec.Candidates = domain.StateNeedsReview, uuid.Nil, []uuid.UUID{p.matches[i].TransactionID}
			continue
		}

		if err := s.billMatched(ctx, rec, p.matches[i].Pending); err != nil {
			return err
		}

		if rec.ReviewReason != domain.ReviewChanged {
			rec.Decision, rec.Undo = domain.DecisionLinked, domain.Undo{}
		}
	}

	return nil
}

func (s *Service) placeInstallments(ctx context.Context, p *importPlan) error {
	if err := s.installments(ctx, p.batch, p.parts, p.pending); err != nil {
		return err
	}

	if err := s.installments(ctx, p.batch, p.again, p.retried); err != nil {
		return err
	}

	for _, rec := range p.retried {
		if rec.State == domain.StateNeedsReview {
			p.batch.Counts.Ignored++
			continue
		}

		// The record stays in its batch, which counts it as resolved.
		if err := s.repo.ResolveRecord(ctx, *rec); err != nil {
			return err
		}

		p.batch.Counts.Updated++
	}

	return nil
}

func (s *Service) saveOutcomes(ctx context.Context, p *importPlan) error {
	outcomes := make([]domain.ExternalRecord, len(p.pending))
	for i, rec := range p.pending {
		p.batch.Counts.Count(rec.State)

		if p.sync && rec.State != domain.StateReceived {
			rec.SummaryBatchID = p.batch.ID
		}

		outcomes[i] = *rec
	}

	if err := s.repo.UpdateRecordFacts(ctx, p.updated); err != nil {
		return err
	}

	return s.repo.SaveOutcomes(ctx, outcomes)
}

func (p *importPlan) offerAgain(rec *domain.ExternalRecord, r domain.NormalizedRecord) {
	// A90: an installment line waiting for review is offered again; what refused it
	// (a reconciled installment, a line of an earlier rule) may have changed.
	withFacts(rec, r)

	line := p.lineOf(rec, r)
	p.retried, p.again = append(p.retried, rec), append(p.again, InstallmentLine{RecordID: rec.ID, Line: line, Installment: *r.Installment})
}

func (p *importPlan) route(assigned []domain.Assignment, repeated map[int]bool, grouped map[int]uuid.UUID) {
	for i, a := range assigned {
		rec, line := p.scoring[i].rec, p.scoring[i].line
		if repeated[i] {
			// A142: the source reports a recorded payment under a second id.
			rec.State, rec.ReviewReason = domain.StateNeedsReview, domain.ReviewRepeated
			continue
		}

		if entry, ok := grouped[i]; ok {
			// A168: the lines of a group wait for the owner with the entry as their candidate.
			rec.State, rec.ReviewReason, rec.Candidates = domain.StateNeedsReview, domain.ReviewGroup, []uuid.UUID{entry}

			continue
		}

		switch a.Zone {
		case domain.ZoneNew:
			p.creates, p.created = append(p.creates, NewLine{RecordID: rec.ID, Line: line}), append(p.created, rec)
		case domain.ZoneLink:
			p.matches = append(p.matches, Match{RecordID: rec.ID, TransactionID: a.TransactionID, AccountID: rec.AccountID, Pending: line.Pending})
			p.matched = append(p.matched, rec)
		default:
			rec.State, rec.ReviewReason, rec.Scores = domain.StateNeedsReview, string(a.Zone), a.Candidates

			rec.Candidates = make([]uuid.UUID, len(a.Candidates))
			for j, c := range a.Candidates {
				rec.Candidates[j] = c.TransactionID
			}
		}
	}
}

func (p *importPlan) lineOf(rec *domain.ExternalRecord, r domain.NormalizedRecord) Line {
	return Line{
		AccountID:   rec.AccountID,
		Currency:    p.currency,
		Date:        rec.Date,
		Amount:      rec.Amount,
		Description: truncate(rec.Description),
		Pending:     r.Pending,
		DueDate:     r.DueDate,
		Category:    r.Category,
		Kind:        r.Kind,
	}
}

// reopenWithdrawn turns a withdrawn record that the aggregator returned into a received one.
func reopenWithdrawn(claimed []Claim, lines []domain.NormalizedRecord) {
	for i := range claimed {
		if rec := &claimed[i].Record; claimed[i].Existed && rec.State == domain.StateWithdrawn {
			withFacts(rec, lines[i])
			rec.Date, rec.Amount, rec.State, rec.TransactionID, rec.Candidates = lines[i].Date, lines[i].Amount, domain.StateReceived, uuid.Nil, nil
			rec.ReviewReason, rec.Scores = "", nil
			rec.Decision, rec.Undo = "", domain.Undo{}
			claimed[i].Existed = false
		}
	}
}

// create records the transactions of new lines. A line the ledger refuses fails a file
// import; in a sync it waits for review and the other lines are created.
func (s *Service) create(ctx context.Context, booksID int64, sync bool, creates []NewLine, created []*domain.ExternalRecord) error {
	for {
		ids, err := s.ledger.RecordImported(ctx, booksID, creates)

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
	rec.ReportedAmount, rec.ReportedOn = r.Amount, r.Date

	if rec.InstitutionID == "" {
		rec.InstitutionID = r.InstitutionID
	}

	rec.CategoryID = ""
	if r.Category != nil {
		rec.CategoryID = r.Category.ID
	}
}

// update applies an aggregator's change to a stored line that the ledger recorded (P6 A36):
// a posted line clears its posting, a bill moves a card posting to the bill's statement.
// A reconciled posting and an amount change stay out of the ledger and are described on
// the record. reported is true when the line differs from the stored facts, changed when the
// ledger took the difference or the record's unapplied change text is new (P12 A147).
func (s *Service) update(ctx context.Context, sync bool, batchID uuid.UUID, rec *domain.ExternalRecord, r domain.NormalizedRecord) (reported, changed bool, err error) {
	if !sync || (rec.State != domain.StateMatched && rec.State != domain.StateCreated) {
		return false, false, nil
	}

	identified := rec.InstitutionID == "" && r.InstitutionID != ""

	settled := rec.ExternalStatus != domain.ExternalStatusOf(r) || !sameDate(rec.DueDate, r.DueDate)
	retype := r.Kind == domain.KindPayment && rec.LineKind != r.Kind

	moved := rec.ReportedAmount != r.Amount || !rec.ReportedOn.Equal(r.Date)
	if !settled && !retype && !moved && !identified {
		return false, false, nil
	}

	var notes []string

	applied := rec.LineKind
	if settled || retype {
		posted, err := s.ledger.UpdateImportedPosting(ctx, rec.BooksID, rec.ID, r.Pending, r.DueDate, r.Kind)
		changed = posted

		switch {
		case errors.Is(err, ErrReconciled):
			notes = append(notes, "the aggregator reports the line "+strings.ToLower(domain.ExternalStatusOf(r))+billNote(r.DueDate)+"; the posting is reconciled and keeps its status and statement")
			rec.ReviewReason = domain.ReviewChanged
			retype = false
		case errors.Is(err, ErrNotRetypable):
			notes = append(notes, "the aggregator reports the line as a card payment; the transaction changed since its import and keeps its categories")
			rec.ReviewReason = domain.ReviewChanged
			retype = false
		case err != nil && !errors.Is(err, ErrNotFound):
			return false, false, err
		}
	}

	if moved {
		note, followed, err := s.followLine(ctx, batchID, rec, r)
		if err != nil {
			return false, false, err
		}

		changed = changed || followed

		if note != "" {
			notes = append(notes, note)
		}
	}

	previous := rec.UnappliedChange

	withFacts(rec, r)

	if !retype {
		// A type the ledger did not take stays unapplied, so a later sync offers it again (A88).
		rec.LineKind = applied
	}

	rec.UnappliedChange = strings.Join(notes, "; ")

	if rec.UnappliedChange == "" && rec.ReviewReason == domain.ReviewChanged {
		rec.ReviewReason = ""
	}

	changed = changed || (rec.UnappliedChange != "" && rec.UnappliedChange != previous)
	if changed && rec.ReviewReason == domain.ReviewChanged {
		rec.Decision, rec.Undo, rec.SummaryBatchID = "", domain.Undo{}, batchID
	}

	return true, changed, nil
}

// followLine corrects the transaction of a linked line to the line's new amount and date
// (A102) and reports whether the ledger took them. A line equal to the ledger's values needs
// nothing. A reconciled posting keeps them: the record describes the change and is flagged
// with review reason changed. An installment keeps the amount its plan fixes.
func (s *Service) followLine(ctx context.Context, batchID uuid.UUID, rec *domain.ExternalRecord, r domain.NormalizedRecord) (string, bool, error) {
	if rec.Amount == r.Amount && rec.Date.Equal(r.Date) {
		return "", false, nil
	}

	kept := keptNote(r.Amount, r.Date, rec.Amount, rec.Date)
	if rec.Installment != nil || rec.TransactionID == uuid.Nil {
		return kept, false, nil
	}

	err := s.ledger.ConfirmLine(ctx, rec.BooksID, rec.TransactionID, rec.AccountID, r.Amount, r.Date)
	if errors.Is(err, ErrReconciled) && r.Amount == rec.Amount {
		// Only the date changed: a card posting keeps its statement (A147 rule 3).
		if err = s.ledger.MoveReconciledDate(ctx, rec.BooksID, rec.TransactionID, rec.AccountID, r.Date); err == nil {
			rec.Decision, rec.Undo, rec.SummaryBatchID = domain.DecisionFollowed, domain.Undo{Amount: rec.Amount, On: rec.Date}, batchID
			rec.Date, rec.ReviewReason = r.Date, ""

			return "", true, nil
		}
	}

	switch {
	case errors.Is(err, ErrReconciled):
		rec.ReviewReason = domain.ReviewChanged
		return kept, false, nil
	case errors.Is(err, ErrTransactionVoided), errors.Is(err, ErrNotFound):
		return kept, false, nil
	case err != nil:
		return "", false, err
	}

	rec.Decision, rec.Undo, rec.SummaryBatchID = domain.DecisionFollowed, domain.Undo{Amount: rec.Amount, On: rec.Date}, batchID
	rec.Amount, rec.Date, rec.ReviewReason = r.Amount, r.Date, ""

	return "", true, nil
}

// keptNote describes a line the ledger keeps at other values (A102).
func keptNote(reported int64, reportedOn time.Time, amount int64, on time.Time) string {
	return fmt.Sprintf("the aggregator reports %d minor units on %s; the ledger keeps %d on %s",
		reported, reportedOn.Format(time.DateOnly), amount, on.Format(time.DateOnly))
}

// billMatched moves a matched card posting to the statement of the line's bill, as update
// does for a line that keeps its id (P6 A36): a pending charge may come back posted under a
// new id with its bill.
func (s *Service) billMatched(ctx context.Context, rec *domain.ExternalRecord, pending bool) error {
	if rec.DueDate == nil {
		return nil
	}

	_, err := s.ledger.UpdateImportedPosting(ctx, rec.BooksID, rec.ID, pending, rec.DueDate, "")
	switch {
	case errors.Is(err, ErrReconciled):
		rec.ReviewReason = domain.ReviewChanged
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

	return s.ledger.UnlinkedPostings(ctx, batch.BooksID, batch.AccountID, from.AddDate(0, 0, -domain.MatchHardLimit), to.AddDate(0, 0, domain.MatchHardLimit))
}

// repeats returns the lines matching would create that repeat a payment the account records
// (A142). The recorded lines are the account's aggregator records that hold a transaction and
// the lines this import links. Only card lines carry the payment kind, so a bank account
// repeats nothing.
func (s *Service) repeats(
	ctx context.Context,
	batch *domain.Batch,
	lines []scoredLine,
	assigned []domain.Assignment,
) (map[int]bool, error) {
	var (
		fresh, recorded []domain.RepeatLine
		at              []int
		from, to        time.Time
	)
	for i, a := range assigned {
		l := domain.RepeatLine{
			ExternalID: lines[i].rec.ExternalID,
			Date:       lines[i].line.Date,
			Amount:     lines[i].line.Amount,
			Kind:       lines[i].line.Kind,
		}
		switch {
		case a.Zone == domain.ZoneLink:
			recorded = append(recorded, l)
		case a.Zone == domain.ZoneNew && l.Amount > 0:
			fresh, at = append(fresh, l), append(at, i)
			if from.IsZero() || l.Date.Before(from) {
				from = l.Date
			}

			if l.Date.After(to) {
				to = l.Date
			}
		}
	}

	if len(fresh) == 0 {
		return nil, nil
	}

	stored, err := s.repo.SyncedRecords(
		ctx,
		batch.BooksID,
		batch.AccountID,
		from.AddDate(0, 0, -domain.RepeatDays),
		to.AddDate(0, 0, domain.RepeatDays),
	)
	if err != nil {
		return nil, err
	}

	for _, rec := range stored {
		if rec.TransactionID != uuid.Nil {
			recorded = append(recorded, domain.RepeatLine{
				ExternalID: rec.ExternalID,
				Date:       rec.Date,
				Amount:     rec.Amount,
				Kind:       rec.LineKind,
			})
		}
	}

	out := map[int]bool{}
	for k := range domain.Repeats(fresh, recorded) {
		out[at[k]] = true
	}

	return out, nil
}

// scoredLine is a line that matching decides: link, review or create.
type scoredLine struct {
	rec  *domain.ExternalRecord
	line Line
}

// assign decides the lines by score (A98–A100); the payees of the lines are asked of
// classification only when the account has postings to compare.
func (s *Service) assign(ctx context.Context, booksID int64, lines []scoredLine, postings []domain.LedgerPosting) ([]domain.Assignment, error) {
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

	payees, err := s.ledger.LinePayees(ctx, booksID, plain)
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
	txID, imported, err := s.ledger.LinkedTransaction(ctx, rec.BooksID, rec.ID)
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
