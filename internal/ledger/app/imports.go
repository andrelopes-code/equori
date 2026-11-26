package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
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
	// Retained is what the TransferTo account gives beyond the line, booked against the system
	// account Yield; zero for none (A268 RL4).
	Retained money.Money
	Cause    Cause
}

// LineError names the line of a batch that a ledger rule rejected.
type LineError struct {
	Index int
	Err   error
}

func (e *LineError) Error() string { return fmt.Sprintf("line %d: %v", e.Index+1, e.Err) }

func (e *LineError) Unwrap() error { return e.Err }

// RecordImported creates the transaction of one external record; see RecordImportedBatch.
func (s *Service) RecordImported(
	ctx context.Context,
	booksID int64,
	recordID uuid.UUID,
	p ImportedPosting,
) (uuid.UUID, error) {
	ids, err := s.RecordImportedBatch(
		ctx,
		booksID,
		[]ImportedRecord{{RecordID: recordID, Posting: p}},
	)
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
func (s *Service) RecordImportedBatch(
	ctx context.Context,
	booksID int64,
	recs []ImportedRecord,
) ([]uuid.UUID, error) {
	ids := make([]uuid.UUID, len(recs))
	if len(recs) == 0 {
		return ids, nil
	}

	err := s.repo.InTx(ctx, func(r Repository) error {
		b, err := s.loadImportBatch(ctx, r, booksID, recs)
		if err != nil {
			return err
		}

		for i, rec := range recs {
			if id, ok := b.existing[rec.RecordID]; ok {
				ids[i] = id
				continue
			}

			if err := b.leaf[rec.Posting.AccountID]; err != nil {
				return &LineError{Index: i, Err: err}
			}

			// A retained amount leaves no counterpart of the line's amount to pair with (A268).
			if d := rec.Decision; d != nil && d.TransferTo != uuid.Nil && d.Retained.IsZero() {
				id, transfer, err := s.completePairing(ctx, r, booksID, rec)
				if err != nil {
					return err
				}

				if id != uuid.Nil {
					ids[i] = id
					continue
				}

				if !transfer {
					rec = withoutTransfer(rec)
				}
			}

			id, err := s.insertImported(ctx, r, booksID, b, i, rec)
			if err != nil {
				return err
			}

			ids[i] = id
		}

		return nil
	})

	return ids, err
}

// importedTransaction books rec against the decided category parts, or against the
// uncategorized account of its sign (P4 amendment A14).
func importedTransaction(
	booksID int64,
	base money.Currency,
	rec ImportedRecord,
	expense, income domain.Account,
) domain.Transaction {
	t := domain.Transaction{
		ID: uuid.Must(
			uuid.NewV7(),
		),
		BooksID:           booksID,
		Date:              rec.Posting.Date,
		Description:       rec.Posting.Description,
		BalancingCurrency: base,
		Origin:            domain.OriginImport,
		Postings: []domain.Posting{
			{
				AccountID:        rec.Posting.AccountID,
				Amount:           rec.Posting.Amount,
				ExternalRecordID: rec.RecordID,
			},
		},
	}
	if rec.Posting.Pending {
		t.Postings[0].Status = domain.StatusPending
	}

	if d := rec.Decision; d != nil {
		addDecision(&t, d, rec.Posting.Amount)
	}

	if len(t.Postings) == 1 {
		addUncategorized(&t, rec.Posting.Amount, expense, income)
	}

	return t
}

// addDecision appends the category parts and the transfer leg of d to t.
func addDecision(t *domain.Transaction, d *ImportDecision, amount money.Money) {
	t.PayeeID, t.Tags = d.PayeeID, d.AddTags
	for _, p := range d.Parts {
		t.Postings = append(
			t.Postings,
			domain.Posting{AccountID: p.AccountID, Amount: p.Amount},
		)
	}

	if d.TransferTo != uuid.Nil {
		t.Postings = append(
			t.Postings,
			domain.Posting{AccountID: d.TransferTo, Amount: amount.Neg()},
		)
	}
}

// addUncategorized appends the leg against the uncategorized account of the sign of amount.
func addUncategorized(t *domain.Transaction, amount money.Money, expense, income domain.Account) {
	other := income
	if amount.IsNegative() {
		other = expense
	}

	t.Postings = append(
		t.Postings,
		domain.Posting{AccountID: other.ID, Amount: amount.Neg()},
	)
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
func (s *Service) completePairing(
	ctx context.Context,
	r Repository,
	booksID int64,
	rec ImportedRecord,
) (id uuid.UUID, transfer bool, err error) {
	line := rec.Posting

	ids, err := r.PairingCandidates(ctx, PairingQuery{
		BooksID:   booksID,
		AccountID: rec.Decision.TransferTo,
		Amount:    line.Amount.Neg().Amount(),
		From: line.Date.AddDate(
			0,
			0,
			-pairingWindowDays,
		),
		To:               line.Date.AddDate(0, 0, pairingWindowDays),
		ExcludedAccounts: []uuid.UUID{line.AccountID},
	})
	if err != nil || len(ids) != 1 {
		return uuid.Nil, len(ids) == 0, err
	}

	c, err := r.LockTransaction(ctx, booksID, ids[0])
	if err != nil {
		return uuid.Nil, false, err
	}

	target, accounts, err := s.transferAccounts(ctx, r, booksID, line.AccountID, c)
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

// statementDue is the statement of a card bill: the one due on the bill's due date, else
// the reference month of that date (P6 amendment A39).
func (s *Service) statementDue(
	ctx context.Context,
	r Repository,
	booksID int64,
	card uuid.UUID,
	due time.Time,
) (domain.ReferenceMonth, error) {
	ref, err := r.StatementByDueDate(ctx, booksID, card, due)
	if errors.Is(err, ErrNotFound) {
		return domain.MonthOf(due), nil
	}

	return ref, err
}
