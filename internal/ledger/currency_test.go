package ledger_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type postingOut struct {
	AccountID string         `json:"account_id"`
	Amount    map[string]any `json:"amount"`
	Weight    map[string]any `json:"weight"`
	Original  map[string]any `json:"original"`
	Statement string         `json:"statement"`
}

type transactionOut struct {
	ID       string       `json:"id"`
	Postings []postingOut `json:"postings"`
}

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

func amountOf(p postingOut) (int64, string) {
	return int64(p.Amount["amount"].(float64)), p.Amount["currency"].(string)
}

func TestS16ForeignPurchase(t *testing.T) {
	f := newFixture(t)
	h := f.h
	travel := h.Account("Travel", "expense", "", nil)
	iof := h.Account("IOF", "expense", "", map[string]any{"parent_id": f.taxes})

	var tx transactionOut
	r := h.Do(http.MethodPost, "/api/v1/foreign-purchases", map[string]any{
		"account_id": f.itauVisa, "category_id": travel, "date": "2026-10-22", "description": "Hotel",
		"original": units(10000, "USD"), "rate": "5.4830", "iof_rate_bp": 350, "iof_category_id": iof,
	})
	if r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
	r.Decode(t, &tx)
	if r.Header.Get("Location") != "/api/v1/transactions/"+tx.ID || len(tx.Postings) != 4 {
		t.Fatalf("Location %q, postings %+v", r.Header.Get("Location"), tx.Postings)
	}
	want := []struct {
		account   string
		amount    int64
		original  bool
		statement string
	}{
		{travel, 54830, true, ""},
		{iof, 1919, false, ""},
		{f.itauVisa, -54830, true, "2026-11"},
		{f.itauVisa, -1919, false, "2026-11"},
	}
	for i, w := range want {
		p := tx.Postings[i]
		amount, _ := amountOf(p)
		hasOriginal := p.Original != nil && p.Original["amount"] == float64(10000)*sign(w.amount) && p.Original["currency"] == "USD"
		if p.AccountID != w.account || amount != w.amount || hasOriginal != w.original || p.Statement != w.statement {
			t.Fatalf("posting %d = %+v", i, p)
		}
	}

	r = h.Do(http.MethodPost, "/api/v1/foreign-purchases", map[string]any{
		"account_id": f.itauVisa, "category_id": travel, "date": "2026-10-22", "original": units(10000, "USD"), "rate": "5.4830", "iof_rate_bp": 0,
	})
	r.Decode(t, &tx)
	if r.Status != http.StatusCreated || len(tx.Postings) != 2 {
		t.Fatalf("without IOF: %d %+v", r.Status, tx.Postings)
	}

	wise := h.Account("Wise USD", "asset", "checking", map[string]any{"currency": "USD"})
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/foreign-purchases", map[string]any{
		"account_id": wise, "category_id": travel, "date": "2026-10-22", "original": units(10000, "EUR"), "rate": "1.1",
	}), http.StatusUnprocessableEntity, "currency_unsupported", "account_id")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/foreign-purchases", map[string]any{
		"account_id": f.itauVisa, "category_id": travel, "date": "2026-10-22", "original": units(10000, "BRL"), "rate": "1",
	}), http.StatusUnprocessableEntity, "validation_failed", "original")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/foreign-purchases", map[string]any{
		"account_id": f.itauVisa, "category_id": f.checking, "date": "2026-10-22", "original": units(10000, "USD"), "rate": "5.4830",
	}), http.StatusUnprocessableEntity, "validation_failed", "category_id")
}

func sign(n int64) float64 {
	if n < 0 {
		return -1
	}
	return 1
}

func TestS17CurrencyExchange(t *testing.T) {
	f := newFixture(t)
	h := f.h
	wise := h.Account("Wise USD", "asset", "checking", map[string]any{"currency": "USD"})
	fees := systemAccount(t, h, "fees")

	var tx transactionOut
	r := h.Do(http.MethodPost, "/api/v1/exchanges", map[string]any{
		"from_account_id": f.checking, "to_account_id": wise, "date": "2026-10-14",
		"from_amount": apitest.BRL(548300), "to_amount": units(100000, "USD"), "fee": apitest.BRL(3000),
	})
	if r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
	r.Decode(t, &tx)
	want := []struct {
		account        string
		amount, weight int64
		currency       string
	}{
		{f.checking, -551300, -551300, "BRL"},
		{fees, 3000, 3000, "BRL"},
		{wise, 100000, 548300, "USD"},
	}
	for i, w := range want {
		p := tx.Postings[i]
		amount, currency := amountOf(p)
		if p.AccountID != w.account || amount != w.amount || currency != w.currency || p.Weight["amount"] != float64(w.weight) {
			t.Fatalf("posting %d = %+v", i, p)
		}
	}

	md := h.App.Marketdata
	rate := func(s string) money.Rate {
		r, err := money.ParseRate(s)
		if err != nil {
			t.Fatal(err)
		}
		return r
	}
	if err := md.RecordPrices(t.Context(), []marketdata.Price{{Instrument: "USD", Quote: "BRL", Date: day("2026-10-30"), Value: rate("5.4950"), Source: "bcb_ptax"}}); err != nil {
		t.Fatal(err)
	}
	h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "USD", "quote_instrument": "BRL", "date": "2026-10-30", "value": "5.5000"}, http.StatusCreated, nil)

	var bal struct {
		Balance map[string]any `json:"balance"`
		Value   map[string]any `json:"value"`
		Prices  []struct {
			Instrument string `json:"instrument"`
			Date       string `json:"date"`
			Value      string `json:"value"`
			Source     string `json:"source"`
		} `json:"prices"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+wise+"/balance?date=2026-11-01&value_in=BRL", nil, http.StatusOK, &bal)
	if bal.Balance["amount"] != float64(100000) || bal.Value["amount"] != float64(550000) || bal.Value["currency"] != "BRL" ||
		len(bal.Prices) != 1 || bal.Prices[0].Value != "5.5" || bal.Prices[0].Source != "manual" || bal.Prices[0].Date != "2026-10-30" {
		t.Fatalf("valued balance = %+v", bal)
	}
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/accounts/"+wise+"/balance?date=2026-10-29&value_in=BRL", nil), http.StatusUnprocessableEntity, "price_missing", "value_in")

	// Selling dollars: the fee reduces the credit of the base-currency side.
	r = h.Do(http.MethodPost, "/api/v1/exchanges", map[string]any{
		"from_account_id": wise, "to_account_id": f.checking, "date": "2026-10-20",
		"from_amount": units(100000, "USD"), "to_amount": apitest.BRL(540000), "fee": apitest.BRL(3000),
	})
	if r.Status != http.StatusCreated {
		t.Fatalf("sell status %d: %s", r.Status, r.Body)
	}
	r.Decode(t, &tx)
	want = []struct {
		account        string
		amount, weight int64
		currency       string
	}{
		{wise, -100000, -540000, "USD"},
		{fees, 3000, 3000, "BRL"},
		{f.checking, 537000, 537000, "BRL"},
	}
	for i, w := range want {
		p := tx.Postings[i]
		amount, currency := amountOf(p)
		if p.AccountID != w.account || amount != w.amount || currency != w.currency || p.Weight["amount"] != float64(w.weight) {
			t.Fatalf("sell posting %d = %+v", i, p)
		}
	}

	eur := h.Account("Wise EUR", "asset", "checking", map[string]any{"currency": "EUR"})
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/exchanges", map[string]any{
		"from_account_id": wise, "to_account_id": eur, "date": "2026-10-20", "from_amount": units(10000, "USD"), "to_amount": units(9000, "EUR"),
	}), http.StatusUnprocessableEntity, "currency_unsupported", "to_account_id")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/exchanges", map[string]any{
		"from_account_id": f.checking, "to_account_id": f.wallet, "date": "2026-10-20", "from_amount": apitest.BRL(100), "to_amount": apitest.BRL(100),
	}), http.StatusUnprocessableEntity, "validation_failed", "to_account_id")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/exchanges", map[string]any{
		"from_account_id": f.checking, "to_account_id": wise, "date": "2026-10-20", "from_amount": apitest.BRL(100), "to_amount": units(100, "EUR"),
	}), http.StatusUnprocessableEntity, "validation_failed", "to_amount")
}

func TestValuedBalanceOfMixedParent(t *testing.T) {
	f := newInvestFixture(t)
	h := f.h
	h.Record("2026-10-05",
		apitest.Posting(f.cash, -151240),
		map[string]any{"account_id": f.mxrf11, "amount": units(150, "MXRF11"), "weight": apitest.BRL(151240)},
	)
	h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "MXRF11", "quote_instrument": "BRL", "date": "2026-10-29", "value": "9.36"}, http.StatusCreated, nil)

	var bal struct {
		Balance map[string]any `json:"balance"`
		Value   map[string]any `json:"value"`
		Prices  []struct {
			Instrument string `json:"instrument"`
		} `json:"prices"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+f.xp+"/balance?date=2026-11-01&value_in=BRL", nil, http.StatusOK, &bal)
	if bal.Value["amount"] != float64(-10840) || bal.Balance["amount"] != float64(-10840) || bal.Balance["currency"] != "BRL" || len(bal.Prices) != 1 || bal.Prices[0].Instrument != "MXRF11" {
		t.Fatalf("valued XP = %+v", bal)
	}
}
