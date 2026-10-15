package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type assertionResult struct {
	Assertion struct {
		ID string `json:"id"`
	} `json:"assertion"`
	Difference struct {
		Amount int64 `json:"amount"`
	} `json:"difference"`
	Resolution         string `json:"resolution"`
	YieldTransactionID string `json:"yield_transaction_id"`
}

func assertBalance(h *apitest.Harness, account, date string, amount int64) apitest.Response {
	return h.Do(http.MethodPost, "/api/v1/accounts/"+account+"/balance-assertions", map[string]any{"date": date, "amount": apitest.BRL(amount)})
}

type reserveSetup struct {
	h                 *apitest.Harness
	checking, reserve string
	transfer          string
}

func newReserveSetup(t *testing.T) reserveSetup {
	h := apitest.New(t, apitest.Today("2026-11-05"))
	inst := struct {
		ID string `json:"id"`
	}{}
	h.MustDo(http.MethodPost, "/api/v1/institutions", map[string]string{"name": "Nubank"}, http.StatusCreated, &inst)
	parent := h.Account("Nubank", "asset", "checking", map[string]any{"institution_id": inst.ID})
	r := reserveSetup{h: h}
	r.checking = h.Account("Nubank checking", "asset", "checking", map[string]any{"institution_id": inst.ID, "parent_id": parent})
	r.reserve = h.Account("Emergency fund", "asset", "reserve", map[string]any{"institution_id": inst.ID, "parent_id": parent})
	r.transfer = h.Record("2026-10-01", apitest.Posting(r.checking, -1000000), apitest.Posting(r.reserve, 1000000))
	return r
}

func TestAssertionRecordsYield(t *testing.T) {
	r := newReserveSetup(t)
	var res assertionResult
	resp := assertBalance(r.h, r.reserve, "2026-10-31", 1008341)
	if resp.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", resp.Status, resp.Body)
	}
	resp.Decode(t, &res)
	if res.Resolution != "yield" || res.Difference.Amount != 8341 || res.YieldTransactionID == "" {
		t.Fatalf("result = %+v", res)
	}
	yield := r.h.Transaction(res.YieldTransactionID)
	if amountsByAccount(yield)[r.reserve] != 8341 || yield.Date != "2026-10-31" || yield.Origin != "system" ||
		yield.Description != "Yield 2026-10-01 to 2026-10-31" {
		t.Fatalf("yield = %+v", yield)
	}

	var next assertionResult
	assertBalance(r.h, r.reserve, "2026-11-04", 1009000).Decode(t, &next)
	if got := r.h.Transaction(next.YieldTransactionID).Description; got != "Yield 2026-11-01 to 2026-11-04" {
		t.Fatalf("second yield description = %q", got)
	}
	for _, p := range r.h.Transaction(r.transfer).Postings {
		if want := map[bool]string{true: "reconciled", false: "cleared"}[p.AccountID == r.reserve]; p.Status != want {
			t.Fatalf("posting of %s: status %q, want %q", p.AccountID, p.Status, want)
		}
	}
}

func TestNegativeDifferenceStaysOpen(t *testing.T) {
	r := newReserveSetup(t)
	var res assertionResult
	assertBalance(r.h, r.reserve, "2026-10-31", 999000).Decode(t, &res)
	if res.Resolution != "" || res.Difference.Amount != -1000 || res.YieldTransactionID != "" {
		t.Fatalf("result = %+v", res)
	}
	for _, p := range r.h.Transaction(r.transfer).Postings {
		if p.Status == "reconciled" {
			t.Fatal("postings reconciled with an open difference")
		}
	}
}

func TestPositiveDifferenceWithoutYieldStaysOpen(t *testing.T) {
	r := newReserveSetup(t)
	var res assertionResult
	assertBalance(r.h, r.checking, "2026-10-31", -990000).Decode(t, &res)
	if res.Resolution != "" || res.Difference.Amount != 10000 {
		t.Fatalf("result = %+v", res)
	}
}

func TestAssertionOnParentIs422(t *testing.T) {
	r := newReserveSetup(t)
	var accounts struct {
		Items []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"items"`
	}
	r.h.MustDo(http.MethodGet, "/api/v1/accounts", nil, http.StatusOK, &accounts)
	for _, a := range accounts.Items {
		if a.Name == "Nubank" {
			r.h.ExpectProblem(assertBalance(r.h, a.ID, "2026-10-31", 0), http.StatusUnprocessableEntity, "validation_failed", "account_id")
			return
		}
	}
	t.Fatal("parent account not found")
}

func TestAssertionBeforeReconciliationIs409(t *testing.T) {
	r := newReserveSetup(t)
	if resp := assertBalance(r.h, r.reserve, "2026-10-31", 1000000); resp.Status != http.StatusCreated {
		t.Fatalf("status %d", resp.Status)
	}
	r.h.ExpectProblem(assertBalance(r.h, r.reserve, "2026-10-15", 1000000), http.StatusConflict, "already_reconciled", "")
}

func TestAssertionWithoutHistoryStaysOpen(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-11-05"))
	reserve := h.Account("Emergency fund", "asset", "reserve", nil)
	var res assertionResult
	assertBalance(h, reserve, "2026-10-31", 5000).Decode(t, &res)
	if res.Resolution != "" || res.Difference.Amount != 5000 {
		t.Fatalf("result = %+v", res)
	}
}

func TestFutureAssertionIs422(t *testing.T) {
	r := newReserveSetup(t)
	r.h.ExpectProblem(assertBalance(r.h, r.reserve, "2026-11-06", 1000000), http.StatusUnprocessableEntity, "validation_failed", "date")
}

func TestYieldModeCanChange(t *testing.T) {
	r := newReserveSetup(t)
	r.h.MustDo(http.MethodPatch, "/api/v1/accounts/"+r.reserve, map[string]any{"yield_mode": "none"}, http.StatusOK, nil)
	var res assertionResult
	resp := assertBalance(r.h, r.reserve, "2026-10-31", 1008341)
	if resp.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", resp.Status, resp.Body)
	}
	resp.Decode(t, &res)
	if res.Resolution != "" {
		t.Fatalf("resolution with yield mode none = %q", res.Resolution)
	}
}
