package app

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// BucketEntry is one entry that counts in the real amount of a bucket. CategoryID is nil unless
// Kind is "expense". Kind is "expense", "savings" or "goals".
type BucketEntry struct {
	TransactionID, CategoryID uuid.UUID
	Date                      time.Time
	Description, Payee, Kind  string
	Amount                    int64
}

// BucketEntries are the entries of a bucket in a month and their sum.
type BucketEntries struct {
	Currency money.Currency
	Total    int64
	Entries  []BucketEntry
}

// BucketEntries returns the entries that sum to the real amount of bucket in month, or to the
// spending outside the split when bucket is nil (income split versions A243). A bucket that is
// not in the method of the month is ErrNotFound.
func (s *Service) BucketEntries(
	ctx context.Context,
	booksID int64,
	month time.Time,
	bucket uuid.UUID,
) (BucketEntries, error) {
	month = domain.MonthOf(month)
	if err := s.checkBucketMonth(ctx, month); err != nil {
		return BucketEntries{}, err
	}

	versions, err := s.repo.BucketMethods(ctx, booksID)
	if err != nil {
		return BucketEntries{}, err
	}

	method, _ := domain.MethodAt(versions, month)

	chosen, found := bucketByID(method.Buckets, bucket)
	if bucket != uuid.Nil && !found {
		return BucketEntries{}, ErrNotFound
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return BucketEntries{}, err
	}

	out := BucketEntries{Currency: base}

	entries, err := s.expenseEntries(ctx, booksID, month, method.Buckets, bucket)
	if err != nil {
		return out, err
	}

	if found {
		more, err := s.inflowEntries(ctx, booksID, base, month, chosen)
		if err != nil {
			return out, err
		}

		entries = append(entries, more...)
	}

	slices.SortStableFunc(entries, compareEntries)

	for _, e := range entries {
		out.Total += e.Amount
	}

	out.Entries = entries

	return out, nil
}

// checkBucketMonth rejects a month after the horizon, as BucketHistory does.
func (s *Service) checkBucketMonth(ctx context.Context, month time.Time) error {
	if month.After(s.horizon(ctx)) {
		return &domain.FieldError{
			Field:   "month",
			Message: "must be at most today + 12 months",
			Err:     domain.ErrValidation,
		}
	}

	return nil
}

// expenseEntries returns the own expense postings of month whose category resolves to bucket, or
// to no bucket when bucket is nil.
func (s *Service) expenseEntries(
	ctx context.Context,
	booksID int64,
	month time.Time,
	method []domain.Bucket,
	bucket uuid.UUID,
) ([]BucketEntry, error) {
	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return nil, err
	}

	postings, err := s.ledger.OwnCategoryPostings(
		ctx,
		booksID,
		"expense",
		month,
		month.AddDate(0, 1, 0),
	)
	if err != nil {
		return nil, err
	}

	resolve := domain.BucketResolver(method, expenseParents(facts))

	var out []BucketEntry

	for _, p := range postings {
		i, ok := resolve(p.CategoryID)
		if (ok && method[i].ID != bucket) || (!ok && bucket != uuid.Nil) {
			continue
		}

		out = append(out, BucketEntry{
			TransactionID: p.TransactionID,
			CategoryID:    p.CategoryID,
			Date:          p.BookedOn,
			Description:   p.Description,
			Payee:         p.Payee,
			Kind:          "expense",
			Amount:        p.Amount,
		})
	}

	return out, nil
}

// inflowEntries returns the transactions of month that the bucket draws from the savings or the
// goals (A233, A234), one entry per transaction with a non-zero amount.
func (s *Service) inflowEntries(
	ctx context.Context,
	booksID int64,
	base money.Currency,
	month time.Time,
	bucket domain.Bucket,
) ([]BucketEntry, error) {
	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return nil, err
	}

	var out []BucketEntry

	if bucket.TakesSavings {
		held, err := s.savingsAccounts(ctx, booksID, facts)
		if err != nil {
			return nil, err
		}

		out, err = s.kindEntries(ctx, booksID, facts, base, month, held, "savings", out)
		if err != nil {
			return nil, err
		}
	}

	if bucket.TakesGoals {
		held, _, err := s.goalAccounts(ctx, booksID, facts)
		if err != nil {
			return nil, err
		}

		out, err = s.kindEntries(ctx, booksID, facts, base, month, held, "goals", out)
		if err != nil {
			return nil, err
		}
	}

	return out, nil
}

// kindEntries appends to out one entry of kind per counted inflow of month into held.
func (s *Service) kindEntries(
	ctx context.Context,
	booksID int64,
	facts []Account,
	base money.Currency,
	month time.Time,
	held map[uuid.UUID]bool,
	kind string,
	out []BucketEntry,
) ([]BucketEntry, error) {
	counted, err := s.countedInflows(
		ctx,
		booksID,
		facts,
		base,
		held,
		month,
		month.AddDate(0, 1, 0),
	)
	if err != nil {
		return nil, err
	}

	for _, c := range counted {
		if c.amount == 0 {
			continue
		}

		out = append(out, BucketEntry{
			TransactionID: c.tx.ID,
			Date:          c.tx.Date,
			Description:   c.tx.Description,
			Kind:          kind,
			Amount:        c.amount,
		})
	}

	return out, nil
}

// bucketByID returns the bucket of method with the stable id.
func bucketByID(method []domain.Bucket, id uuid.UUID) (domain.Bucket, bool) {
	i := slices.IndexFunc(method, func(b domain.Bucket) bool { return b.ID == id })
	if i < 0 {
		return domain.Bucket{}, false
	}

	return method[i], true
}

// compareEntries orders entries by date descending, then by transaction id descending.
func compareEntries(a, b BucketEntry) int {
	if c := b.Date.Compare(a.Date); c != 0 {
		return c
	}

	return slices.Compare(b.TransactionID[:], a.TransactionID[:])
}
