package ledger_test

import (
	"net/http"
	"reflect"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type toolPosting struct {
	AccountID    string     `json:"account_id"`
	AccountName  string     `json:"account_name"`
	AccountClass string     `json:"account_class"`
	Amount       tool.Money `json:"amount"`
	Memo         string     `json:"memo"`
}

type toolTransaction struct {
	ID          string        `json:"id"`
	Date        string        `json:"date"`
	Description string        `json:"description"`
	PayeeName   string        `json:"payee_name"`
	Voided      bool          `json:"voided"`
	Tags        []string      `json:"tags"`
	Postings    []toolPosting `json:"postings"`
}

type searchOutput struct {
	Transactions []toolTransaction `json:"transactions"`
	NextCursor   string            `json:"next_cursor"`
}

func TestSearchTransactionsTool(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-10-20"))
	checking := h.Account("Checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	var payee struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": "Padaria Real"}, http.StatusCreated, &payee)
	var market, bakery struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{
		"date": "2026-10-01", "description": "Mercado Central",
		"postings": []map[string]any{apitest.Posting(checking, -1000), apitest.Posting(food, 1000)},
	}, http.StatusCreated, &market)
	h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{
		"date": "2026-10-02", "description": "x", "payee_id": payee.ID, "tags": []string{"trip"},
		"postings": []map[string]any{apitest.Posting(checking, -250), apitest.Posting(food, 250)},
	}, http.StatusCreated, &bakery)

	var got searchOutput
	toolOutput(t, h, "search_transactions", map[string]any{"query": "padaria"}, &got)
	want := searchOutput{Transactions: []toolTransaction{{
		ID: bakery.ID, Date: "2026-10-02", Description: "x", PayeeName: "Padaria Real", Tags: []string{"trip"},
		Postings: []toolPosting{
			{AccountID: checking, AccountName: "Checking", AccountClass: "asset", Amount: tool.Money{Amount: "-2.50", Currency: "BRL"}},
			{AccountID: food, AccountName: "Food", AccountClass: "expense", Amount: tool.Money{Amount: "2.50", Currency: "BRL"}},
		},
	}}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("search padaria = %+v\nwant %+v", got, want)
	}

	var first, second searchOutput
	toolOutput(t, h, "search_transactions", map[string]any{"limit": 1}, &first)
	if len(first.Transactions) != 1 || first.NextCursor == "" {
		t.Fatalf("first page = %+v", first)
	}
	toolOutput(t, h, "search_transactions", map[string]any{"limit": 1, "cursor": first.NextCursor}, &second)
	if len(second.Transactions) != 1 || second.NextCursor != "" {
		t.Fatalf("second page = %+v", second)
	}
	ids := []string{first.Transactions[0].ID, second.Transactions[0].ID}
	slices.Sort(ids)
	wantIDs := []string{market.ID, bakery.ID}
	slices.Sort(wantIDs)
	if !slices.Equal(ids, wantIDs) {
		t.Errorf("pages = %v, want %v", ids, wantIDs)
	}
}

func TestSearchTransactionsToolArguments(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-10-20"))
	tests := []struct {
		args  map[string]any
		field string
	}{
		{map[string]any{"account_id": "x"}, "account_id"},
		{map[string]any{"payee_id": "x"}, "payee_id"},
		{map[string]any{"limit": -1}, "limit"},
		{map[string]any{"limit": 51}, "limit"},
		{map[string]any{"cursor": "bad"}, "cursor"},
	}
	for _, tt := range tests {
		h.ExpectToolError(h.Tool("search_transactions", tt.args), "invalid_arguments", tt.field)
	}
}

func TestSearchTransactionsToolIsolation(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-10-20"))
	other := h.Login("other@example.com")
	var wallet, misc struct {
		ID string `json:"id"`
	}
	for _, a := range []struct {
		out *struct {
			ID string `json:"id"`
		}
		name, class string
	}{{&wallet, "Wallet", "asset"}, {&misc, "Misc", "expense"}} {
		body := map[string]any{"name": a.name, "class": a.class, "currency": "BRL"}
		if a.class == "asset" {
			body["kind"] = "cash"
		}
		r := h.Call(other, http.MethodPost, "/api/v1/accounts", body)
		if r.Status != http.StatusCreated {
			t.Fatalf("create account = %d: %s", r.Status, r.Body)
		}
		r.Decode(t, a.out)
	}
	r := h.Call(other, http.MethodPost, "/api/v1/transactions", map[string]any{
		"date": "2026-10-01", "description": "Secret",
		"postings": []map[string]any{apitest.Posting(wallet.ID, -100), apitest.Posting(misc.ID, 100)},
	})
	if r.Status != http.StatusCreated {
		t.Fatalf("create transaction = %d: %s", r.Status, r.Body)
	}

	// The other user finds the transaction with the same query, so the owner's empty result
	// comes from isolation, not from the query.
	var theirs struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	r = h.Call(other, http.MethodGet, "/api/v1/transactions?q=secret", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("list = %d: %s", r.Status, r.Body)
	}
	r.Decode(t, &theirs)
	if len(theirs.Items) != 1 {
		t.Fatalf("other user's search = %+v", theirs)
	}

	var got searchOutput
	toolOutput(t, h, "search_transactions", map[string]any{"query": "secret"}, &got)
	if got.Transactions == nil || len(got.Transactions) != 0 {
		t.Errorf("owner sees %+v", got)
	}
}
