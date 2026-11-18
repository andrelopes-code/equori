package toolapi

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// outsideBucket is the bucket argument that names the spending outside the split.
const outsideBucket = "none"

type bucketEntryView struct {
	TransactionID string     `json:"transaction_id"`
	CategoryName  string     `json:"category_name,omitzero"`
	Date          tool.Date  `json:"date"`
	Description   string     `json:"description,omitzero"`
	Payee         string     `json:"payee,omitzero"`
	Kind          string     `json:"kind"                   jsonschema:"expense, savings or goals"`
	Amount        tool.Money `json:"amount"`
}

type bucketEntriesView struct {
	Bucket  string            `json:"bucket"`
	Total   tool.Money        `json:"total"   jsonschema:"sum of the entries: the real amount of the bucket in the month"`
	Entries []bucketEntryView `json:"entries" jsonschema:"latest first"`
}

func bucketEntries(
	ctx context.Context,
	svc *app.Service,
	l Ledger,
	booksID int64,
	month time.Time,
	name string,
) (bucketEntriesView, error) {
	if name == "" {
		return bucketEntriesView{}, tool.InvalidArgument("bucket", "is required for bucket_entries")
	}

	id, err := bucketByName(ctx, svc, booksID, month, name)
	if err != nil {
		return bucketEntriesView{}, err
	}

	got, err := svc.BucketEntries(ctx, booksID, month, id)
	if err != nil {
		return bucketEntriesView{}, err
	}

	accounts, err := l.Accounts(ctx, booksID)
	if err != nil {
		return bucketEntriesView{}, err
	}

	out := bucketEntriesView{Bucket: name, Entries: make([]bucketEntryView, len(got.Entries))}
	if out.Total, err = moneyOf(got.Total, got.Currency); err != nil {
		return bucketEntriesView{}, err
	}

	for i, e := range got.Entries {
		v := bucketEntryView{
			TransactionID: e.TransactionID.String(),
			CategoryName:  accountName(accounts, e.CategoryID),
			Date:          tool.DateOf(e.Date),
			Description:   e.Description,
			Payee:         e.Payee,
			Kind:          e.Kind,
		}
		if v.Amount, err = moneyOf(e.Amount, got.Currency); err != nil {
			return bucketEntriesView{}, err
		}

		out.Entries[i] = v
	}

	return out, nil
}

// bucketByName returns the bucket of the method of month with that name; uuid.Nil for
// outsideBucket.
func bucketByName(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	month time.Time,
	name string,
) (uuid.UUID, error) {
	if name == outsideBucket {
		return uuid.Nil, nil
	}

	method, err := svc.BudgetBuckets(ctx, booksID, &month)
	if err != nil {
		return uuid.Nil, err
	}

	for _, b := range method.Buckets {
		if b.Name == name {
			return b.ID, nil
		}
	}

	return uuid.Nil, tool.InvalidArgument(
		"bucket",
		"is not a bucket of the split of that month; kind split lists them",
	)
}
