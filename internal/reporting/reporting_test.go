package reporting_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type seriesItem struct {
	Date    string `json:"date"`
	Balance struct {
		Amount int64 `json:"amount"`
	} `json:"balance"`
}

func series(t *testing.T, h *apitest.Harness, account, from, to, basis string) map[string]int64 {
	t.Helper()
	var out struct {
		Items []seriesItem `json:"items"`
	}
	h.MustDo(http.MethodGet, fmt.Sprintf("/api/v1/reports/balances?account_id=%s&from=%s&to=%s&basis=%s", account, from, to, basis), nil, http.StatusOK, &out)
	m := make(map[string]int64, len(out.Items))
	for _, it := range out.Items {
		m[it.Date] = it.Balance.Amount
	}
	return m
}

func balanceAt(t *testing.T, h *apitest.Harness, account, date, basis string) int64 {
	t.Helper()
	var out struct {
		Balance struct {
			Amount int64 `json:"amount"`
		} `json:"balance"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+account+"/balance?date="+date+"&basis="+basis, nil, http.StatusOK, &out)
	return out.Balance.Amount
}

func TestSeriesFollowsRecordedTransactions(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-03", apitest.Posting(checking, 100000), apitest.Posting(food, -100000))
	h.Record("2026-10-05", apitest.Posting(checking, -2500), apitest.Posting(food, 2500))
	h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{"date": "2026-10-07", "postings": []map[string]any{
		{"account_id": checking, "amount": apitest.BRL(-800), "settled_on": "2026-10-09"},
		apitest.Posting(food, 800),
	}}, http.StatusCreated, nil)
	h.Dispatch()

	for _, basis := range []string{"booked", "settled"} {
		got := series(t, h, checking, "2026-10-01", "2026-10-10", basis)
		if len(got) != 10 {
			t.Fatalf("%s series has %d days, want 10", basis, len(got))
		}
		for day := 1; day <= 10; day++ {
			d := fmt.Sprintf("2026-10-%02d", day)
			if want := balanceAt(t, h, checking, d, basis); got[d] != want {
				t.Errorf("%s %s: series %d, balance %d", basis, d, got[d], want)
			}
		}
	}
}

func TestSeriesRebuildsFromEarliestChangedDate(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	id := h.Record("2026-10-20", apitest.Posting(checking, -1000), apitest.Posting(food, 1000))
	h.Dispatch()

	h.MustDo(http.MethodPut, "/api/v1/transactions/"+id, map[string]any{
		"date": "2026-10-10", "expected_version": 1, "reason": "wrong date",
		"postings": []map[string]any{apitest.Posting(checking, -1000), apitest.Posting(food, 1000)},
	}, http.StatusOK, nil)
	h.Dispatch()

	got := series(t, h, checking, "2026-10-09", "2026-10-21", "booked")
	if got["2026-10-09"] != 0 || got["2026-10-10"] != -1000 || got["2026-10-19"] != -1000 || got["2026-10-21"] != -1000 {
		t.Fatalf("series after moving the date = %v", got)
	}
}

func TestSeriesDropsVoided(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-01", apitest.Posting(checking, -100), apitest.Posting(food, 100))
	id := h.Record("2026-10-02", apitest.Posting(checking, -50), apitest.Posting(food, 50))
	h.Dispatch()

	h.MustDo(http.MethodPost, "/api/v1/transactions/"+id+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)
	h.Dispatch()

	if got := series(t, h, checking, "2026-10-01", "2026-10-03", "booked"); got["2026-10-03"] != -100 {
		t.Fatalf("series after void = %v, want -100 on 2026-10-03", got)
	}
}

func TestRebuildIsIdempotent(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-01", apitest.Posting(checking, -100), apitest.Posting(food, 100))
	h.Dispatch()
	before := series(t, h, checking, "2026-09-30", "2026-10-02", "booked")

	for range 2 {
		if err := h.App.Reporting.RebuildAll(t.Context()); err != nil {
			t.Fatal(err)
		}
	}

	after := series(t, h, checking, "2026-09-30", "2026-10-02", "booked")
	if fmt.Sprint(before) != fmt.Sprint(after) {
		t.Fatalf("rebuild changed the series: %v → %v", before, after)
	}
}

func TestSeriesRangeLimit(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/reports/balances?account_id="+checking+"&from=2016-01-01&to=2026-01-08", nil),
		http.StatusBadRequest, "invalid_request", "")
}

func TestSeriesOfAnotherUsersAccountIs404(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	other := h.Login("other@example.com")
	var acc struct {
		ID string `json:"id"`
	}
	h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Cash", "class": "asset", "kind": "cash", "currency": "BRL"}).Decode(t, &acc)

	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/reports/balances?account_id="+acc.ID+"&from=2026-10-01&to=2026-10-02", nil),
		http.StatusNotFound, "not_found", "")
}
