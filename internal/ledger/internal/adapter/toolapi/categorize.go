package toolapi

import (
	"context"
	"errors"
	"slices"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type categorizeTransactionsIn struct {
	TransactionIDs []string `json:"transaction_ids" jsonschema:"IDs of the transactions, from search_transactions; at most 50"`
	CategoryID     string   `json:"category_id" jsonschema:"income or expense category from list_accounts"`
	PayeeID        string   `json:"payee_id,omitzero" jsonschema:"payee to set on each transaction, from list_payees_and_tags"`
}

type categorizeResult struct {
	TransactionID string `json:"transaction_id"`
	Status        string `json:"status" jsonschema:"categorized, not_found, version_conflict, transaction_voided or not_categorizable"`
}

type categorizeTransactionsOut struct {
	Results []categorizeResult `json:"results"`
}

type categorizePlan struct {
	category domain.Account
	items    []app.BulkItem
	payeeID  uuid.UUID
}

func categorizeTransactions(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "categorize_transactions",
		Description: "Proposes giving one category to one or more transactions, and optionally a payee. " +
			"Use it when the user asks to categorize, classify or recategorize transactions, including every uncategorized transaction found by search_transactions. " +
			"Do not use it to split a transaction among categories: change_transaction does. " +
			"The user confirms before categories change.",
		Effect: tool.Write,
	}, func(ctx context.Context, userID int64, in categorizeTransactionsIn) (tool.Preview, error) {
		p, err := planCategorize(ctx, svc, userID, in)
		if err != nil {
			return tool.Preview{}, err
		}
		keys := make([]string, len(p.items))
		for i, it := range p.items {
			keys[i] = it.ID.String() + ":" + strconv.Itoa(it.ExpectedVersion)
		}
		slices.Sort(keys)
		pv := tool.Preview{
			Action: "categorize_transactions", Target: strconv.Itoa(len(p.items)) + " transactions", Basis: strings.Join(keys, ","),
			Changes: []tool.Change{{Field: "category", After: tool.TextValue(p.category.Name)}},
		}
		if p.payeeID != uuid.Nil {
			names, err := svc.PayeeNames(ctx, userID, []uuid.UUID{p.payeeID})
			if err != nil {
				return tool.Preview{}, err
			}
			pv.Changes = append(pv.Changes, tool.Change{Field: "payee", After: tool.TextValue(names[p.payeeID])})
		}
		return pv, nil
	}, func(ctx context.Context, userID int64, in categorizeTransactionsIn) (categorizeTransactionsOut, error) {
		p, err := planCategorize(ctx, svc, userID, in)
		if err != nil {
			return categorizeTransactionsOut{}, err
		}
		errs, err := svc.CategorizeMany(ctx, userID, p.category.ID, p.items)
		if err != nil {
			return categorizeTransactionsOut{}, err
		}
		out := categorizeTransactionsOut{Results: make([]categorizeResult, len(p.items))}
		for i, it := range p.items {
			out.Results[i] = categorizeResult{TransactionID: it.ID.String(), Status: bulkStatus(errs[i])}
			if errs[i] != nil || p.payeeID == uuid.Nil {
				continue
			}
			t, err := svc.Transaction(ctx, userID, it.ID)
			if err != nil {
				return out, err
			}
			cerrs, err := svc.Categorize(ctx, userID, []app.Categorization{{
				TransactionID: it.ID, ExpectedVersion: t.Version, PayeeID: &p.payeeID, Cause: app.Cause{Method: app.MethodManual},
			}})
			if err != nil {
				return out, err
			}
			out.Results[i].Status = bulkStatus(cerrs[0])
		}
		return out, nil
	})
}

// bulkStatus names an item error by the same words as the HTTP API (A78).
func bulkStatus(err error) string {
	switch {
	case err == nil:
		return "categorized"
	case errors.Is(err, app.ErrNotFound):
		return "not_found"
	case errors.Is(err, domain.ErrVersionConflict):
		return "version_conflict"
	case errors.Is(err, domain.ErrVoided):
		return "transaction_voided"
	}
	return "not_categorizable"
}

func planCategorize(ctx context.Context, svc *app.Service, userID int64, in categorizeTransactionsIn) (categorizePlan, error) {
	var p categorizePlan
	if n := len(in.TransactionIDs); n < 1 || n > 50 {
		return p, tool.InvalidArgument("transaction_ids", "must have between 1 and 50 items")
	}
	categoryID, err := requiredID(in.CategoryID, "category_id")
	if err != nil {
		return p, err
	}
	if p.payeeID, err = optionalID(in.PayeeID, "payee_id"); err != nil {
		return p, err
	}
	if p.category, err = svc.Account(ctx, userID, categoryID); err != nil {
		return p, err
	}
	if !p.category.IsCategory() {
		return p, tool.InvalidArgument("category_id", "must be an income or expense category")
	}
	for _, s := range in.TransactionIDs {
		id, err := requiredID(s, "transaction_ids")
		if err != nil {
			return p, err
		}
		t, err := svc.Transaction(ctx, userID, id)
		if err != nil {
			return p, err
		}
		p.items = append(p.items, app.BulkItem{ID: id, ExpectedVersion: t.Version})
	}
	return p, nil
}
