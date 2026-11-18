package httpapi

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) getBudgetBucketEntries(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (BudgetBucketEntries, error) {
	params, err := httpserver.Query[GetBudgetBucketEntriesParams](r)
	if err != nil {
		return BudgetBucketEntries{}, err
	}

	month, err := parseMonth("month", params.Month)
	if err != nil {
		return BudgetBucketEntries{}, err
	}

	var bucket uuid.UUID
	if params.Bucket != nil {
		bucket = *params.Bucket
	}

	got, err := s.svc.BucketEntries(ctx, auth.MustBooksID(ctx), month, bucket)
	if err != nil {
		return BudgetBucketEntries{}, err
	}

	return toBucketEntriesAPI(got), nil
}

func toBucketEntriesAPI(e app.BucketEntries) BudgetBucketEntries {
	out := BudgetBucketEntries{
		Currency: string(e.Currency),
		Total:    toMoneyAPI(e.Total, e.Currency),
		Entries:  make([]BudgetBucketEntry, len(e.Entries)),
	}

	for i, entry := range e.Entries {
		item := BudgetBucketEntry{
			TransactionId: apiOptUUID(entry.TransactionID),
			Date:          apiDate(entry.Date),
			Description:   entry.Description,
			Kind:          BudgetBucketEntryKind(entry.Kind),
			Amount:        toMoneyAPI(entry.Amount, e.Currency),
		}
		if entry.CategoryID != uuid.Nil {
			item.CategoryId = &entry.CategoryID
		}

		if entry.Payee != "" {
			item.Payee = &entry.Payee
		}

		out.Entries[i] = item
	}

	return out
}
