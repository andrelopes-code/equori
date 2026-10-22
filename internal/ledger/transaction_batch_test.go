package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type batchBooks struct {
	h                               *apitest.Harness
	checking, card, food, transport string
}

func newBatchBooks(t *testing.T) batchBooks {
	h := apitest.New(t, apitest.Today("2026-10-21"))
	return batchBooks{
		h:         h,
		checking:  h.Account("Nubank checking", "asset", "checking", nil),
		card:      h.Card("Itaú Visa", 3, 10, "next"),
		food:      h.Account("Supermarket", "expense", "", nil),
		transport: h.Account("Transport", "expense", "", nil),
	}
}

func (b batchBooks) expense(date, description, account, category string, amount int64) map[string]any {
	return map[string]any{"transaction": map[string]any{
		"date": date, "description": description,
		"postings": []map[string]any{apitest.Posting(account, -amount), apitest.Posting(category, amount)},
	}}
}

func (b batchBooks) count(t *testing.T) int {
	t.Helper()
	var page struct {
		Items []apitest.TransactionView `json:"items"`
	}
	b.h.MustDo(http.MethodGet, "/api/v1/transactions", nil, http.StatusOK, &page)
	return len(page.Items)
}

// S111: one request records every entry, installment purchases included, in input order.
func TestTransactionBatchRecordsEveryEntry(t *testing.T) {
	t.Parallel()
	b := newBatchBooks(t)
	var out struct {
		Items []apitest.TransactionView `json:"items"`
	}
	b.h.MustDo(http.MethodPost, "/api/v1/transaction-batches", map[string]any{"entries": []map[string]any{
		b.expense("2026-10-20", "Mercado", b.checking, b.food, 23000),
		b.expense("2026-10-21", "Uber", b.card, b.transport, 3250),
		{"installment_purchase": map[string]any{
			"card_account_id": b.card, "date": "2026-10-21", "description": "Ifood",
			"splits": []map[string]any{{"account_id": b.food, "amount": apitest.BRL(5800)}}, "installment_count": 3,
		}},
	}}, http.StatusCreated, &out)

	if len(out.Items) != 3 {
		t.Fatalf("items = %d, want 3", len(out.Items))
	}
	for i, want := range []string{"Mercado", "Uber", "Ifood"} {
		if out.Items[i].Description != want || out.Items[i].Origin != "manual" {
			t.Errorf("item %d = %q origin %q, want %q manual", i, out.Items[i].Description, out.Items[i].Origin, want)
		}
	}
	charges := cardPostings(out.Items[2], b.card)
	if len(charges) != 3 || charges[0].Installment == nil || charges[0].Installment.Count != 3 {
		t.Fatalf("installment postings = %+v", charges)
	}
	if got := b.count(t); got != 3 {
		t.Fatalf("recorded = %d, want 3", got)
	}
}

// S112: a rejected entry names its index and leaves nothing recorded.
func TestTransactionBatchIsAtomic(t *testing.T) {
	t.Parallel()
	b := newBatchBooks(t)
	closed := b.h.Account("Old wallet", "asset", "cash", nil)
	b.h.MustDo(http.MethodPost, "/api/v1/accounts/"+closed+"/close", map[string]string{"closed_on": "2026-10-15"}, http.StatusOK, nil)

	r := b.h.Do(http.MethodPost, "/api/v1/transaction-batches", map[string]any{"entries": []map[string]any{
		b.expense("2026-10-20", "Mercado", b.checking, b.food, 23000),
		b.expense("2026-10-20", "Taxi", closed, b.transport, 3000),
	}})
	b.h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "entries[1].transaction.postings[0].account_id")
	if got := b.count(t); got != 0 {
		t.Fatalf("recorded = %d, want 0", got)
	}
}

func TestTransactionBatchRejections(t *testing.T) {
	t.Parallel()
	b := newBatchBooks(t)
	purchase := map[string]any{
		"card_account_id": b.checking, "date": "2026-10-21",
		"splits": []map[string]any{{"account_id": b.food, "amount": apitest.BRL(5800)}}, "installment_count": 3,
	}
	unknown := "0192b7a0-0000-7000-8000-000000000000"
	for _, c := range []struct {
		name, code, field string
		entry             map[string]any
	}{
		{"both members", "validation_failed", "entries[0]", map[string]any{
			"transaction": b.expense("2026-10-20", "x", b.checking, b.food, 100)["transaction"], "installment_purchase": purchase,
		}},
		{"no member", "validation_failed", "entries[0]", map[string]any{}},
		{"installments on a checking account", "validation_failed", "entries[0].installment_purchase.card_account_id", map[string]any{"installment_purchase": purchase}},
		{"unknown card", "invalid_account", "entries[0].installment_purchase.card_account_id", map[string]any{"installment_purchase": map[string]any{
			"card_account_id": unknown, "date": "2026-10-21",
			"splits": []map[string]any{{"account_id": b.food, "amount": apitest.BRL(5800)}}, "installment_count": 3,
		}}},
	} {
		t.Run(c.name, func(t *testing.T) {
			r := b.h.Do(http.MethodPost, "/api/v1/transaction-batches", map[string]any{"entries": []map[string]any{c.entry}})
			b.h.ExpectProblem(r, http.StatusUnprocessableEntity, c.code, c.field)
		})
	}
	b.h.ExpectProblem(b.h.Do(http.MethodPost, "/api/v1/transaction-batches", map[string]any{"entries": []map[string]any{}}),
		http.StatusBadRequest, "invalid_request", "entries")
	if got := b.count(t); got != 0 {
		t.Fatalf("recorded = %d, want 0", got)
	}
}
