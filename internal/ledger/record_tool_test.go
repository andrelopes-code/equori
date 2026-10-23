package ledger_test

import (
	"encoding/json"
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// previewTool previews a write tool as the owner and fails on a tool error.
func previewTool(t *testing.T, h *apitest.Harness, name string, args any) tool.Preview {
	t.Helper()
	b, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}
	p, res, err := h.App.Tools.Preview(auth.WithUserID(t.Context(), h.OwnerID()), name, b)
	if err != nil || res.IsError {
		t.Fatalf("preview %s: %v %s", name, err, res.Content)
	}
	return p
}

// postingAmounts returns the posting amounts of a transaction in minor units.
func postingAmounts(t *testing.T, h *apitest.Harness, id string) []int64 {
	t.Helper()
	var out struct {
		Postings []struct {
			Amount struct {
				Amount int64 `json:"amount"`
			} `json:"amount"`
		} `json:"postings"`
	}
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+id, nil, http.StatusOK, &out)
	var amounts []int64
	for _, p := range out.Postings {
		amounts = append(amounts, p.Amount.Amount)
	}
	return amounts
}

type writeOut struct {
	TransactionID string `json:"transaction_id"`
	Version       int    `json:"version"`
}

func TestRecordTransactionPreviewAndCall(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	args := map[string]any{"date": "2026-10-23", "description": "Lunch", "amount": "45.90", "from_account_id": f.checking, "to_account_id": f.restaurant}
	p := previewTool(t, f.h, "record_transaction", args)
	want := []tool.Change{
		{Field: "date", After: tool.Value{Date: "2026-10-23"}},
		{Field: "description", After: tool.TextValue("Lunch")},
		{Field: "amount", After: tool.Value{Amount: "45.90", Currency: "BRL"}},
		{Field: "account", After: tool.TextValue("Nubank checking")},
		{Field: "category", After: tool.TextValue("Restaurant")},
	}
	if p.Action != "record_transaction" || !slices.Equal(p.Changes, want) {
		t.Fatalf("preview = %+v", p)
	}
	var list struct {
		Items []struct{} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/transactions?q=Lunch", nil, http.StatusOK, &list)
	if len(list.Items) != 0 {
		t.Fatalf("preview recorded %d transactions", len(list.Items))
	}
	var out writeOut
	toolOutput(t, f.h, "record_transaction", args, &out)
	if got := postingAmounts(t, f.h, out.TransactionID); !slices.Equal(got, []int64{-4590, 4590}) {
		t.Errorf("postings = %v", got)
	}
}

func TestRecordTransactionSplits(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	args := map[string]any{"date": "2026-10-23", "description": "Mix", "amount": "100.00", "from_account_id": f.checking,
		"splits": []map[string]any{{"to_account_id": f.food, "amount": "60.00"}, {"to_account_id": f.transport, "amount": "40.00"}}}
	var out writeOut
	toolOutput(t, f.h, "record_transaction", args, &out)
	if got := postingAmounts(t, f.h, out.TransactionID); !slices.Equal(got, []int64{-10000, 6000, 4000}) {
		t.Errorf("postings = %v", got)
	}
	args["splits"] = []map[string]any{{"to_account_id": f.food, "amount": "50.00"}, {"to_account_id": f.transport, "amount": "40.00"}}
	f.h.ExpectToolError(f.h.Tool("record_transaction", args), "invalid_arguments", "splits")
	args["to_account_id"] = f.food
	f.h.ExpectToolError(f.h.Tool("record_transaction", args), "invalid_arguments", "splits")
	delete(args, "splits")
	delete(args, "to_account_id")
	f.h.ExpectToolError(f.h.Tool("record_transaction", args), "invalid_arguments", "to_account_id")
}

func TestRecordTransactionInstallments(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	args := map[string]any{"date": "2026-10-20", "description": "TV", "amount": "300.00", "from_account_id": f.itauVisa, "to_account_id": f.housing, "installments": 3}
	var out writeOut
	toolOutput(t, f.h, "record_transaction", args, &out)
	var got getTransactionOut
	toolOutput(t, f.h, "get_transaction", map[string]any{"transaction_id": out.TransactionID}, &got)
	if got.InstallmentPlan == nil || got.InstallmentPlan.Count != 3 || got.InstallmentPlan.Installments[0].Amount.Amount != "100.00" {
		t.Errorf("plan = %+v", got.InstallmentPlan)
	}
	args["from_account_id"] = f.checking
	f.h.ExpectToolError(f.h.Tool("record_transaction", args), "invalid_arguments", "installments")
	args["from_account_id"], args["installments"] = f.itauVisa, 49
	f.h.ExpectToolError(f.h.Tool("record_transaction", args), "invalid_arguments", "installments")
}

func TestRecordTransactionForeign(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	travel := f.h.Account("Travel", "expense", "", nil)
	args := map[string]any{"date": "2026-10-22", "description": "Hotel", "amount": "548.30", "from_account_id": f.itauVisa, "to_account_id": travel,
		"original_amount": "100.00", "original_currency": "USD", "exchange_rate": "5.4830"}
	var out writeOut
	toolOutput(t, f.h, "record_transaction", args, &out)
	if got := postingAmounts(t, f.h, out.TransactionID); !slices.Equal(got, []int64{54830, 1919, -54830, -1919}) {
		t.Errorf("postings = %v", got)
	}
	delete(args, "exchange_rate")
	f.h.ExpectToolError(f.h.Tool("record_transaction", args), "invalid_arguments", "exchange_rate")
}

func TestRecordTransactionExchange(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	wise := f.h.Account("Wise USD", "asset", "checking", map[string]any{"currency": "USD"})
	args := map[string]any{"date": "2026-10-14", "description": "USD", "amount": "5483.00", "from_account_id": f.checking, "to_account_id": wise, "to_amount": "1000.00"}
	var out writeOut
	toolOutput(t, f.h, "record_transaction", args, &out)
	if got := postingAmounts(t, f.h, out.TransactionID); !slices.Equal(got, []int64{-548300, 100000}) {
		t.Errorf("postings = %v", got)
	}
}

func TestRecordTransactionCurrencyMismatch(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	wise := f.h.Account("Wise USD", "asset", "checking", map[string]any{"currency": "USD"})
	args := map[string]any{"date": "2026-10-14", "description": "USD", "amount": "5483.00", "from_account_id": f.checking, "to_account_id": wise}
	f.h.ExpectToolError(f.h.Tool("record_transaction", args), "invalid_arguments", "to_amount")
	args["amount"] = "0"
	f.h.ExpectToolError(f.h.Tool("record_transaction", args), "invalid_arguments", "amount")
}

func TestRecordTransactionOtherUser(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	var other struct {
		ID string `json:"id"`
	}
	f.h.Call(f.h.Login("other@example.com"), http.MethodPost, "/api/v1/accounts", map[string]any{"name": "A", "class": "asset", "currency": "BRL", "kind": "checking"}).Decode(t, &other)
	args := map[string]any{"date": "2026-10-23", "description": "x", "amount": "1.00", "from_account_id": other.ID, "to_account_id": f.restaurant}
	f.h.ExpectToolError(f.h.Tool("record_transaction", args), "not_found", "")
}
