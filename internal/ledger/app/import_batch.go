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

	existing, err := r.TransactionsByExternalRecords(ctx, booksID, recordIDs)
	if err != nil {
		return importBatch{}, err
	}

	settings, err := r.Settings(ctx, booksID)
	if err != nil {
		return importBatch{}, err
	}

	expense, err := r.SystemAccount(ctx, booksID, domain.RoleUncategorizedExpense)
	if err != nil {
		return importBatch{}, err
	}

	income, err := r.SystemAccount(ctx, booksID, domain.RoleUncategorizedIncome)
	if err != nil {
		return importBatch{}, err
	}

	transit, err := r.SystemAccount(ctx, booksID, domain.RoleTransfersInTransit)
	if err != nil {
		return importBatch{}, err
	}

	accounts, err := r.Accounts(
		ctx,
		booksID,
		slices.Concat(lineAccounts, categories, []uuid.UUID{expense.ID, income.ID, transit.ID}),
	)
	if err != nil {
		return importBatch{}, err
	}

	leaf := leafBalances(ctx, r, lineAccounts, accounts)

	return importBatch{
		existing: existing,
		settings: settings,
		expense:  expense,
		income:   income,
		transit:  transit,
		accounts: accounts,
		leaf:     leaf,
	}, nil
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
