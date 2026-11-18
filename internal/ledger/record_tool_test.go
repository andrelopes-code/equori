package ledger_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync"
	"testing"
	"time"

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

	p, res, err := h.App.Tools.Preview(auth.WithBooksID(t.Context(), h.OwnerID()), name, b)
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
	args := map[string]any{
		"date":            "2026-10-23",
		"description":     "Lunch",
		"amount":          "45.90",
		"from_account_id": f.checking,
		"to_account_id":   f.restaurant,
	}
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
	args := map[string]any{
		"date":            "2026-10-23",
		"description":     "Mix",
		"amount":          "100.00",
		"from_account_id": f.checking,
		"splits": []map[string]any{
			{"to_account_id": f.food, "amount": "60.00"},
			{"to_account_id": f.transport, "amount": "40.00"},
		},
	}
	var out writeOut
	toolOutput(t, f.h, "record_transaction", args, &out)

	if got := postingAmounts(
		t,
		f.h,
		out.TransactionID,
	); !slices.Equal(
		got,
		[]int64{-10000, 6000, 4000},
	) {
		t.Errorf("postings = %v", got)
	}

	args["splits"] = []map[string]any{
		{"to_account_id": f.food, "amount": "50.00"},
		{"to_account_id": f.transport, "amount": "40.00"},
	}
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
	args := map[string]any{
		"date":            "2026-10-20",
		"description":     "TV",
		"amount":          "300.00",
		"from_account_id": f.itauVisa,
		"to_account_id":   f.housing,
		"installments":    3,
	}
	var out writeOut
	toolOutput(t, f.h, "record_transaction", args, &out)
	var got getTransactionOut
	toolOutput(t, f.h, "get_transaction", map[string]any{"transaction_id": out.TransactionID}, &got)

	if got.InstallmentPlan == nil || got.InstallmentPlan.Count != 3 ||
		got.InstallmentPlan.Installments[0].Amount.Amount != "100.00" {
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
	args := map[string]any{
		"date":              "2026-10-22",
		"description":       "Hotel",
		"amount":            "548.30",
		"from_account_id":   f.itauVisa,
		"to_account_id":     travel,
		"original_amount":   "100.00",
		"original_currency": "USD",
		"exchange_rate":     "5.4830",
	}
	var out writeOut
	toolOutput(t, f.h, "record_transaction", args, &out)

	if got := postingAmounts(
		t,
		f.h,
		out.TransactionID,
	); !slices.Equal(
		got,
		[]int64{54830, 1919, -54830, -1919},
	) {
		t.Errorf("postings = %v", got)
	}

	delete(args, "exchange_rate")
	f.h.ExpectToolError(f.h.Tool("record_transaction", args), "invalid_arguments", "exchange_rate")
}

func TestRecordTransactionExchange(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	wise := f.h.Account("Wise USD", "asset", "checking", map[string]any{"currency": "USD"})
	args := map[string]any{
		"date":            "2026-10-14",
		"description":     "USD",
		"amount":          "5483.00",
		"from_account_id": f.checking,
		"to_account_id":   wise,
		"to_amount":       "1000.00",
	}
	var out writeOut
	toolOutput(t, f.h, "record_transaction", args, &out)

	if got := postingAmounts(
		t,
		f.h,
		out.TransactionID,
	); !slices.Equal(
		got,
		[]int64{-548300, 100000},
	) {
		t.Errorf("postings = %v", got)
	}
}

func TestRecordTransactionCurrencyMismatch(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	wise := f.h.Account("Wise USD", "asset", "checking", map[string]any{"currency": "USD"})
	args := map[string]any{
		"date":            "2026-10-14",
		"description":     "USD",
		"amount":          "5483.00",
		"from_account_id": f.checking,
		"to_account_id":   wise,
	}
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
	f.h.Call(f.h.Login("other@example.com"), http.MethodPost, "/api/v1/accounts", map[string]any{"name": "A", "class": "asset", "currency": "BRL", "kind": "checking"}).
		Decode(t, &other)
	args := map[string]any{
		"date":            "2026-10-23",
		"description":     "x",
		"amount":          "1.00",
		"from_account_id": other.ID,
		"to_account_id":   f.restaurant,
	}
	f.h.ExpectToolError(f.h.Tool("record_transaction", args), "not_found", "")
}

func TestRecordTransactionExchangeFee(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	wise := f.h.Account("Wise USD", "asset", "checking", map[string]any{"currency": "USD"})
	fees := f.h.Account("Exchange fees", "expense", "", nil)
	args := map[string]any{
		"date":            "2026-10-14",
		"description":     "USD",
		"amount":          "5483.00",
		"from_account_id": f.checking,
		"to_account_id":   wise,
		"to_amount":       "1000.00",
		"fee":             "12.00",
		"fee_category_id": fees,
	}

	var out writeOut
	toolOutput(t, f.h, "record_transaction", args, &out)

	got := amountsByAccount(f.h.Transaction(out.TransactionID))
	if got[f.checking] != -549500 || got[wise] != 100000 || got[fees] != 1200 {
		t.Errorf("postings = %v", got)
	}

	plain := map[string]any{
		"date":            "2026-10-14",
		"description":     "x",
		"amount":          "10.00",
		"from_account_id": f.checking,
		"to_account_id":   f.restaurant,
		"fee":             "1.00",
	}
	f.h.ExpectToolError(f.h.Tool("record_transaction", plain), "invalid_arguments", "fee")

	args["fee_category_id"] = "x"
	f.h.ExpectToolError(
		f.h.Tool("record_transaction", args),
		"invalid_arguments",
		"fee_category_id",
	)
}

// An income or an expense on an account in a currency other than the base: to_amount is the
// amount in the currency of to_account_id, and the posting on the account carries its value in
// the base currency as the weight (DM1, issue #53).
func TestRecordTransactionCategoryInAnotherCurrency(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	wise := f.h.Account("Wise USD", "asset", "checking", map[string]any{"currency": "USD"})

	var income writeOut
	toolOutput(t, f.h, "record_transaction", map[string]any{
		"date":            "2026-10-14",
		"description":     "Cashback",
		"amount":          "12.89",
		"from_account_id": f.salary,
		"to_account_id":   wise,
		"to_amount":       "2.35",
	}, &income)

	wantWeights(t, f.h, income.TransactionID, []postingWeight{
		{f.salary, -1289, "BRL", -1289},
		{wise, 235, "USD", 1289},
	})

	var expense writeOut
	toolOutput(t, f.h, "record_transaction", map[string]any{
		"date":            "2026-10-14",
		"description":     "Lunch abroad",
		"amount":          "10.00",
		"from_account_id": wise,
		"to_account_id":   f.food,
		"to_amount":       "54.83",
	}, &expense)

	wantWeights(t, f.h, expense.TransactionID, []postingWeight{
		{wise, -1000, "USD", -5483},
		{f.food, 5483, "BRL", 5483},
	})

	// A fee belongs to an exchange between two accounts, not to an income or an expense.
	f.h.ExpectToolError(f.h.Tool("record_transaction", map[string]any{
		"date":            "2026-10-14",
		"description":     "Lunch abroad",
		"amount":          "10.00",
		"from_account_id": wise,
		"to_account_id":   f.food,
		"to_amount":       "54.83",
		"fee":             "1.00",
	}), "invalid_arguments", "fee")

	previewTool(t, f.h, "record_transaction", map[string]any{
		"date":            "2026-10-14",
		"description":     "Cashback",
		"amount":          "12.89",
		"from_account_id": f.salary,
		"to_account_id":   wise,
		"to_amount":       "2.35",
	})
}

// A transfer between two accounts of one currency other than the base takes its value in the
// base currency from the stored price of the date; without a price it is refused (M6).
func TestRecordTransactionTransferInAnotherCurrency(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	wise := f.h.Account("Wise USD", "asset", "checking", map[string]any{"currency": "USD"})
	vault := f.h.Account("Vault USD", "asset", "savings", map[string]any{"currency": "USD"})
	args := map[string]any{
		"date":            "2026-10-14",
		"description":     "To the vault",
		"amount":          "10.00",
		"from_account_id": wise,
		"to_account_id":   vault,
	}

	f.h.ExpectToolError(f.h.Tool("record_transaction", args), "price_missing", "")

	f.h.MustDo(
		http.MethodPost,
		"/api/v1/prices",
		map[string]any{
			"instrument":       "USD",
			"quote_instrument": "BRL",
			"date":             "2026-10-14",
			"value":            "5.4830",
		},
		http.StatusCreated,
		nil,
	)

	var out writeOut
	toolOutput(t, f.h, "record_transaction", args, &out)

	wantWeights(t, f.h, out.TransactionID, []postingWeight{
		{wise, -1000, "USD", -5483},
		{vault, 1000, "USD", 5483},
	})
}

// TestS561AFactOfTodayUsesTheClose: a conversion that records a fact keeps the stored price
// while a read of the same instant takes the current quote (A248 CQ20, S561).
func TestS561AFactOfTodayUsesTheClose(t *testing.T) {
	t.Parallel()
	feed := newQuoteFeed(t)
	f := newFixture(
		t,
		apitest.Clock(func() time.Time { return time.Date(2026, 11, 3, 15, 13, 0, 0, time.UTC) }),
		apitest.PriceFeeds([]string{"yahoo_chart"}, map[string]string{"yahoo_chart": feed.url}),
	)
	wise := f.h.Account("Wise USD", "asset", "checking", map[string]any{"currency": "USD"})
	vault := f.h.Account("Vault USD", "asset", "savings", map[string]any{"currency": "USD"})
	cash := f.h.Account("Cash", "asset", "checking", nil)
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/prices",
		map[string]any{
			"instrument":       "USD",
			"quote_instrument": "BRL",
			"date":             "2026-10-14",
			"value":            "5.4830",
		},
		http.StatusCreated,
		nil,
	)
	f.h.Record(
		"2026-10-30",
		f.h.Posting(cash, -10966),
		map[string]any{
			"account_id": wise,
			"amount":     map[string]any{"amount": 2000, "currency": "USD"},
			"weight":     apitest.BRL(10966),
		},
	)
	args := map[string]any{
		"date":            "2026-11-03",
		"description":     "To the vault",
		"amount":          "10.00",
		"from_account_id": wise,
		"to_account_id":   vault,
	}

	balance := "/api/v1/accounts/" + wise + "/balance?date=2026-11-03&value_in=BRL"
	f.h.MustDo(http.MethodGet, balance, nil, http.StatusOK, nil)

	if !slices.Contains(feed.paths(), "/yahoo/BRLUSD=X") {
		t.Fatalf("feed paths after the first read = %v, want /yahoo/BRLUSD=X", feed.paths())
	}

	var out writeOut
	toolOutput(t, f.h, "record_transaction", args, &out)

	wantWeights(t, f.h, out.TransactionID, []postingWeight{
		{wise, -1000, "USD", -5483},
		{vault, 1000, "USD", 5483},
	})

	var after struct {
		Prices []struct {
			Instrument      string  `json:"instrument"`
			QuoteInstrument string  `json:"quote_instrument"`
			At              *string `json:"at"`
		} `json:"prices"`
	}
	f.h.MustDo(http.MethodGet, balance, nil, http.StatusOK, &after)

	if len(after.Prices) != 1 || after.Prices[0].Instrument != "BRL" ||
		after.Prices[0].QuoteInstrument != "USD" || after.Prices[0].At == nil {
		t.Errorf("prices of the read after the fact = %+v, want BRL/USD with at", after.Prices)
	}
}

type postingWeight struct {
	account  string
	amount   int64
	currency string
	weight   int64
}

// wantWeights compares the postings of a transaction, in order, with their weights.
func wantWeights(t *testing.T, h *apitest.Harness, id string, want []postingWeight) {
	t.Helper()
	var out struct {
		Postings []struct {
			AccountID string `json:"account_id"`
			Amount    struct {
				Amount   int64  `json:"amount"`
				Currency string `json:"currency"`
			} `json:"amount"`
			Weight struct {
				Amount int64 `json:"amount"`
			} `json:"weight"`
		} `json:"postings"`
	}
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+id, nil, http.StatusOK, &out)

	var got []postingWeight
	for _, p := range out.Postings {
		got = append(
			got,
			postingWeight{p.AccountID, p.Amount.Amount, p.Amount.Currency, p.Weight.Amount},
		)
	}

	if !slices.Equal(got, want) {
		t.Errorf("postings = %v, want %v", got, want)
	}
}

// quoteFeed answers /yahoo/BRLUSD=X with a current quote of USD per BRL and 404 for any other
// path, and records the paths it was asked.
type quoteFeed struct {
	url string

	mu   sync.Mutex
	seen []string
}

func newQuoteFeed(t *testing.T) *quoteFeed {
	t.Helper()

	q := &quoteFeed{}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q.mu.Lock()
		q.seen = append(q.seen, r.URL.Path)
		q.mu.Unlock()

		if r.URL.Path != "/yahoo/BRLUSD=X" {
			http.NotFound(w, r)

			return
		}

		_, _ = w.Write([]byte(
			`{"chart":{"result":[{"meta":{"currency":"USD",` +
				`"exchangeTimezoneName":"Europe/London","regularMarketPrice":0.1729,` +
				`"regularMarketTime":1793717880,` +
				`"currentTradingPeriod":{"regular":{"start":1793664000,"end":1793750340}}},` +
				`"timestamp":[],"indicators":{"quote":[{}]}}]}}`,
		))
	}))
	t.Cleanup(srv.Close)
	q.url = srv.URL + "/yahoo"

	return q
}

func (q *quoteFeed) paths() []string {
	q.mu.Lock()
	defer q.mu.Unlock()

	return slices.Clone(q.seen)
}
