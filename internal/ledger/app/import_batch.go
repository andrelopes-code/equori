package app

import (
	"context"
	"errors"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// importBatch holds what a batch import loads once for all its lines.
type importBatch struct {
	existing map[uuid.UUID]uuid.UUID
	settings Settings
	expense  domain.Account
	income   domain.Account
	transit  domain.Account
	yield    domain.Account
	accounts map[uuid.UUID]domain.Account
	leaf     map[uuid.UUID]error
}

// loadImportBatch loads the transactions, settings and accounts that the lines of recs touch.
func (s *Service) loadImportBatch(
	ctx context.Context,
	r Repository,
	booksID int64,
	recs []ImportedRecord,
) (importBatch, error) {
	recordIDs, lineAccounts, categories := importTargets(recs)

	b, err := systemAccounts(ctx, r, booksID)
	if err != nil {
		return importBatch{}, err
	}

	if b.existing, err = r.TransactionsByExternalRecords(ctx, booksID, recordIDs); err != nil {
		return importBatch{}, err
	}

	if b.settings, err = r.Settings(ctx, booksID); err != nil {
		return importBatch{}, err
	}

	b.accounts, err = r.Accounts(
		ctx,
		booksID,
		slices.Concat(
			lineAccounts,
			categories,
			[]uuid.UUID{b.expense.ID, b.income.ID, b.transit.ID, b.yield.ID},
		),
	)
	if err != nil {
		return importBatch{}, err
	}

	b.leaf = leafBalances(ctx, r, lineAccounts, b.accounts)

	return b, nil
}

// systemAccounts returns a batch holding the system accounts an import books against.
func systemAccounts(ctx context.Context, r Repository, booksID int64) (importBatch, error) {
	var b importBatch

	for _, s := range []struct {
		role    domain.SystemRole
		account *domain.Account
	}{
		{domain.RoleUncategorizedExpense, &b.expense},
		{domain.RoleUncategorizedIncome, &b.income},
		{domain.RoleTransfersInTransit, &b.transit},
		{domain.RoleYield, &b.yield},
	} {
		a, err := r.SystemAccount(ctx, booksID, s.role)
		if err != nil {
			return importBatch{}, err
		}

		*s.account = a
	}

	return b, nil
}

// importTargets collects the record ids, the line accounts and the decided categories of recs.
func importTargets(recs []ImportedRecord) ([]uuid.UUID, []uuid.UUID, []uuid.UUID) {
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

	return recordIDs, lineAccounts, categories
}

// insertImported books the line rec of a batch and returns the id of its transaction.
func (s *Service) insertImported(
	ctx context.Context,
	r Repository,
	booksID int64,
	b importBatch,
	i int,
	rec ImportedRecord,
) (uuid.UUID, error) {
	payment := rec.Posting.Kind == LineKindPayment &&
		b.accounts[rec.Posting.AccountID].Kind == domain.KindCreditCard
	if payment && (rec.Decision == nil || rec.Decision.TransferTo == uuid.Nil) {
		rec = cardPayment(rec, b.transit)
	}

	draft := importedTransaction(booksID, b.settings.BaseCurrency, rec, b.expense, b.income)
	if err := retain(&draft, rec.Decision, b.yield); err != nil {
		return uuid.Nil, &LineError{Index: i, Err: err}
	}

	if payment {
		draft.Postings[0].CardRole = domain.RolePayment
	}

	// A payment is billed by its date: a source may list it on the bill it pays (A89).
	if rec.Posting.DueDate != nil &&
		b.accounts[rec.Posting.AccountID].Kind == domain.KindCreditCard &&
		!payment {
		ref, err := s.statementDue(ctx, r, booksID, rec.Posting.AccountID, *rec.Posting.DueDate)
		if err != nil {
			return uuid.Nil, err
		}

		draft.Postings[0].Statement, draft.Postings[0].StatementBasis = &ref, domain.BasisInstitution
	}

	t, err := domain.NewTransaction(draft, b.accounts)
	if err != nil {
		return uuid.Nil, &LineError{Index: i, Err: err}
	}

	if err := s.bill(ctx, r, &t); err != nil {
		if errors.Is(err, domain.ErrValidation) {
			return uuid.Nil, &LineError{Index: i, Err: err}
		}

		return uuid.Nil, err
	}

	if err := r.InsertTransactionRows(ctx, t); err != nil {
		return uuid.Nil, err
	}

	if err := publishImported(ctx, r, booksID, b, rec, t); err != nil {
		return uuid.Nil, err
	}

	return t.ID, nil
}

// withoutTransfer returns rec with its decision stripped of the transfer target.
// retain moves the retained amount of d from the transfer leg of t to the system account Yield
// (A268 RL4): the transfer account gives the line's amount and the retained amount.
func retain(t *domain.Transaction, d *ImportDecision, yield domain.Account) error {
	if d == nil || d.TransferTo == uuid.Nil || d.Retained.IsZero() {
		return nil
	}

	i := slices.IndexFunc(t.Postings, func(p domain.Posting) bool {
		return p.AccountID == d.TransferTo
	})
	if i < 0 {
		return nil
	}

	given, err := t.Postings[i].Amount.Add(d.Retained.Neg())
	if err != nil {
		return err
	}

	t.Postings[i].Amount = given
	t.Postings = append(t.Postings, domain.Posting{AccountID: yield.ID, Amount: d.Retained})

	return nil
}

func withoutTransfer(rec ImportedRecord) ImportedRecord {
	undecided := *rec.Decision
	undecided.TransferTo = uuid.Nil
	rec.Decision = &undecided

	return rec
}

func publishImported(
	ctx context.Context,
	r Repository,
	booksID int64,
	b importBatch,
	rec ImportedRecord,
	t domain.Transaction,
) error {
	event := newTransactionEvent(t, b.accounts)
	if rec.Decision != nil && rec.Decision.Cause.Method != "" {
		event.Cause = &rec.Decision.Cause
	}

	return r.Publish(
		ctx,
		outbox.Event{
			Type:        EventTransactionRecorded,
			BooksID:     booksID,
			AggregateID: t.ID.String(),
			Payload:     event,
		},
	)
}

func leafBalances(
	ctx context.Context,
	r Repository,
	lineAccounts []uuid.UUID,
	accounts map[uuid.UUID]domain.Account,
) map[uuid.UUID]error {
	leaf := map[uuid.UUID]error{}
	for _, id := range lineAccounts {
		if a, ok := accounts[id]; ok {
			leaf[id] = checkLeafBalance(ctx, r, a)
		}
	}

	return leaf
}
