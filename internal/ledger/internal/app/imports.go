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
	// Pending: the institution has not settled the line; the posting stays pending (P6 A36).
	Pending bool
	// DueDate of the card bill the line belongs to: the posting is billed on that bill (A39).
	DueDate *time.Time
	// Kind is the line type the source states on a card line: LineKindPayment or LineKindRefund (A88).
	Kind string
}

// Card line types a source states (A88).
const (
	LineKindPayment = "payment"
	LineKindRefund  = "refund"
)

const reasonRetyped = "retyped"

// ImportedRecord is a statement line and the external record it comes from.
type ImportedRecord struct {
	RecordID uuid.UUID
	Posting  ImportedPosting
	Decision *ImportDecision // nil: no payee, tags or category
}

// ImportDecision is what Classification decided for a line before it is recorded (P5
// amendment A19). Without parts or a transfer, the other side is the uncategorized account.
type ImportDecision struct {
	PayeeID uuid.UUID
	AddTags []string
	Parts   []domain.CategoryPart
	// TransferTo makes the line a transfer to another of the owner's accounts (P5b A30).
	TransferTo uuid.UUID
	Cause      Cause
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
				if rec.Decision.TransferTo != uuid.Nil {
					categories = append(categories, rec.Decision.TransferTo)
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
		transit, err := r.SystemAccount(ctx, userID, domain.RoleTransfersInTransit)
		if err != nil {
			return err
		}
		accounts, err := r.Accounts(ctx, userID, slices.Concat(lineAccounts, categories, []uuid.UUID{expense.ID, income.ID, transit.ID}))
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
			if d := rec.Decision; d != nil && d.TransferTo != uuid.Nil {
				id, transfer, err := s.completePairing(ctx, r, userID, rec)
				if err != nil {
					return err
				}
				if id != uuid.Nil {
					ids[i] = id
					continue
				}
				if !transfer {
					undecided := *d
					undecided.TransferTo = uuid.Nil
					rec.Decision = &undecided
				}
			}
			payment := rec.Posting.Kind == LineKindPayment && accounts[rec.Posting.AccountID].Kind == domain.KindCreditCard
			if payment && (rec.Decision == nil || rec.Decision.TransferTo == uuid.Nil) {
				rec = cardPayment(rec, transit)
			}
			draft := importedTransaction(userID, settings.BaseCurrency, rec, expense, income)
			if payment {
				draft.Postings[0].CardRole = domain.RolePayment
			}
			// A payment is billed by its date: a source may list it on the bill it pays (A89).
			if rec.Posting.DueDate != nil && accounts[rec.Posting.AccountID].Kind == domain.KindCreditCard && !payment {
				ref, err := s.statementDue(ctx, r, userID, rec.Posting.AccountID, *rec.Posting.DueDate)
				if err != nil {
					return err
				}
				draft.Postings[0].Statement = &ref
			}
			t, err := domain.NewTransaction(draft, accounts)
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
	if rec.Posting.Pending {
		t.Postings[0].Status = domain.StatusPending
	}
	if d := rec.Decision; d != nil {
		t.PayeeID, t.Tags = d.PayeeID, d.AddTags
		for _, p := range d.Parts {
			t.Postings = append(t.Postings, domain.Posting{AccountID: p.AccountID, Amount: p.Amount})
		}
		if d.TransferTo != uuid.Nil {
			t.Postings = append(t.Postings, domain.Posting{AccountID: d.TransferTo, Amount: rec.Posting.Amount.Neg()})
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

// cardPayment books a card payment line against the transit account until the paying
// account's line pairs with it; Classification's payee and tags stay, its categories do not
// apply to a payment (A88).
func cardPayment(rec ImportedRecord, transit domain.Account) ImportedRecord {
	d := ImportDecision{TransferTo: transit.ID}
	if rec.Decision != nil {
		d.PayeeID, d.AddTags, d.Cause = rec.Decision.PayeeID, rec.Decision.AddTags, rec.Decision.Cause
	}
	rec.Decision = &d
	return rec
}

// completePairing turns the one pairing candidate of a line decided as a transfer into the
// transfer, with the line's posting confirming its record (P5b amendment A30), and returns
// its id. Otherwise the line is created: as the transfer when no candidate exists
// (transfer true), uncategorized when several exist or the one cannot change.
func (s *Service) completePairing(ctx context.Context, r Repository, userID int64, rec ImportedRecord) (id uuid.UUID, transfer bool, err error) {
	line := rec.Posting
	ids, err := r.PairingCandidates(ctx, PairingQuery{
		UserID: userID, AccountID: rec.Decision.TransferTo, Amount: line.Amount.Neg().Amount(),
		From: line.Date.AddDate(0, 0, -pairingWindowDays), To: line.Date.AddDate(0, 0, pairingWindowDays),
		ExcludedAccounts: []uuid.UUID{line.AccountID},
	})
	if err != nil || len(ids) != 1 {
		return uuid.Nil, len(ids) == 0, err
	}
	c, err := r.LockTransaction(ctx, userID, ids[0])
	if err != nil {
		return uuid.Nil, false, err
	}
	target, accounts, err := s.transferAccounts(ctx, r, userID, line.AccountID, c)
	if err != nil {
		return uuid.Nil, false, err
	}
	next, err := c.Transfer(c.Version, target, rec.RecordID, accounts)
	if errors.Is(err, domain.ErrReconciled) || errors.Is(err, domain.ErrValidation) {
		return uuid.Nil, false, nil
	}
	if err != nil {
		return uuid.Nil, false, err
	}
	return c.ID, false, s.saveTransfer(ctx, r, c, next, accounts, rec.Decision.Cause)
}

// ImportTarget is an account that can hold statement lines.
type ImportTarget struct {
	Currency money.Currency
	Kind     string
}

// ImportTarget returns the currency and kind of an account that can hold statement lines: a
// leaf balance account, like a balance assertion's (P3 amendment A9).
func (s *Service) ImportTarget(ctx context.Context, userID int64, accountID uuid.UUID) (ImportTarget, error) {
	a, err := s.repo.Account(ctx, userID, accountID)
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
	// KeepPending links a line the institution has not settled without clearing the posting.
	KeepPending bool
}

// statementDue is the statement of a card bill: the one due on the bill's due date, else
// the reference month of that date (P6 amendment A39).
func (s *Service) statementDue(ctx context.Context, r Repository, userID int64, card uuid.UUID, due time.Time) (domain.ReferenceMonth, error) {
	ref, err := r.StatementByDueDate(ctx, userID, card, due)
	if errors.Is(err, ErrNotFound) {
		return domain.MonthOf(due), nil
	}
	return ref, err
}

// ImportedPostingState is the posting an external record confirms.
type ImportedPostingState struct {
	ID, AccountID uuid.UUID
	Status        domain.PostingStatus
	CardRole      string
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
// as a payment. A reconciled posting is ErrReconciled and stays as it is; a transaction
// changed since its import is domain.ErrNotRetypable after the other changes; a record no
// posting carries is ErrNotFound.
func (s *Service) UpdateImportedPosting(ctx context.Context, userID int64, recordID uuid.UUID, u ImportedUpdate) error {
	var role string
	err := s.repo.InTx(ctx, func(r Repository) error {
		p, err := r.LockImportedPosting(ctx, userID, recordID)
		if err != nil {
			return err
		}
		if p.Status == domain.StatusReconciled {
			return domain.ErrReconciled
		}
		status := p.Status
		if !u.Pending {
			status = domain.StatusCleared
		}
		var statementID uuid.UUID
		if u.DueDate != nil && p.CardRole != "" && p.CardRole != domain.RolePayment && u.Kind != LineKindPayment {
			ref, err := s.statementDue(ctx, r, userID, p.AccountID, *u.DueDate)
			if err != nil {
				return err
			}
			rules, err := r.BillingRules(ctx, userID, p.AccountID)
			if err != nil {
				return err
			}
			if statementID, err = s.ensureStatement(ctx, r, userID, p.AccountID, ref, rules); err != nil {
				return err
			}
		}
		role = p.CardRole
		return r.SettleImportedPosting(ctx, userID, p.ID, status, statementID)
	})
	if err != nil || u.Kind != LineKindPayment || role != domain.RoleCredit {
		return err
	}
	return s.repo.InTx(ctx, func(r Repository) error { return s.retypeAsPayment(ctx, r, userID, recordID) })
}

// retypeAsPayment rewrites the transaction carrying the record as a card payment against
// the transit account (A88).
func (s *Service) retypeAsPayment(ctx context.Context, r Repository, userID int64, recordID uuid.UUID) error {
	id, err := r.TransactionByExternalRecord(ctx, userID, recordID)
	if err != nil {
		return err
	}
	prev, err := r.LockTransaction(ctx, userID, id)
	if err != nil {
		return err
	}
	transit, err := r.SystemAccount(ctx, userID, domain.RoleTransfersInTransit)
	if err != nil {
		return err
	}
	accounts, err := r.Accounts(ctx, userID, append(postingAccounts(prev), transit.ID))
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
	return r.Publish(ctx, outbox.Event{Type: EventTransactionCorrected, UserID: userID, AggregateID: next.ID.String(), Payload: event})
}

// ReleaseRecord unlinks an external record from its posting; the transaction stays (P6 A38).
func (s *Service) ReleaseRecord(ctx context.Context, userID int64, recordID uuid.UUID) error {
	return s.repo.ReleaseExternalRecord(ctx, userID, recordID)
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
			if m.KeepPending {
				continue
			}
			if err := r.ClearPendingPostings(ctx, userID, m.TransactionID, m.AccountID); err != nil {
				return err
			}
		}
		return nil
	})
	return conflicts, err
}
