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
	Resolution              string `json:"resolution"`
	ResolutionTransactionID string `json:"resolution_transaction_id"`
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
	if res.Resolution != "yield" || res.Difference.Amount != 8341 || res.ResolutionTransactionID == "" {
		t.Fatalf("result = %+v", res)
	}
	yield := r.h.Transaction(res.ResolutionTransactionID)
	if amountsByAccount(yield)[r.reserve] != 8341 || yield.Date != "2026-10-31" || yield.Origin != "system" ||
		yield.Description != "Yield 2026-10-01 to 2026-10-31" {
		t.Fatalf("yield = %+v", yield)
	}

	var next assertionResult
	assertBalance(r.h, r.reserve, "2026-11-04", 1009000).Decode(t, &next)
	if got := r.h.Transaction(next.ResolutionTransactionID).Description; got != "Yield 2026-11-01 to 2026-11-04" {
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
	if res.Resolution != "" || res.Difference.Amount != -1000 || res.ResolutionTransactionID != "" {
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

type reconciliationStatus struct {
	LastReconciledOn string `json:"last_reconciled_on"`
	OpenDifference   *struct {
		AssertionID string `json:"assertion_id"`
		Date        string `json:"date"`
		Difference  struct {
			Amount int64 `json:"amount"`
		} `json:"difference"`
	} `json:"open_difference"`
}

func reconciliationOf(h *apitest.Harness, account string) reconciliationStatus {
	var s reconciliationStatus
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+account+"/reconciliation", nil, http.StatusOK, &s)
	return s
}

func resolve(h *apitest.Harness, assertion, resolution string) apitest.Response {
	return h.Do(http.MethodPost, "/api/v1/balance-assertions/"+assertion+"/resolve", map[string]string{"resolution": resolution})
}

// newDifference leaves the S26 difference open: derived 3,203.27, asserted 3,201.17.
func newDifference(t *testing.T) (*apitest.Harness, string, string) {
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	salary := h.Account("Salary", "income", "", nil)
	h.Record("2026-10-01", apitest.Posting(checking, 320327), apitest.Posting(salary, -320327))
	var res assertionResult
	assertBalance(h, checking, "2026-10-31", 320117).Decode(t, &res)
	return h, checking, res.Assertion.ID
}

func TestAdjustmentResolvesDifference(t *testing.T) {
	h, checking, assertion := newDifference(t)
	s := reconciliationOf(h, checking)
	if s.LastReconciledOn != "" || s.OpenDifference == nil || s.OpenDifference.AssertionID != assertion || s.OpenDifference.Difference.Amount != -210 {
		t.Fatalf("status before = %+v", s)
	}

	var res assertionResult
	resp := resolve(h, assertion, "adjustment")
	if resp.Status != http.StatusOK {
		t.Fatalf("status %d: %s", resp.Status, resp.Body)
	}
	resp.Decode(t, &res)
	r := amountsByAccount(h.Transaction(res.ResolutionTransactionID))
	if res.Resolution != "adjustment" || r[checking] != -210 || len(r) != 2 {
		t.Fatalf("result = %+v, postings = %v", res, r)
	}
	if s := reconciliationOf(h, checking); s.LastReconciledOn != "2026-10-31" || s.OpenDifference != nil {
		t.Fatalf("status after = %+v", s)
	}
	h.ExpectProblem(resolve(h, assertion, "adjustment"), http.StatusConflict, "already_reconciled", "")
}

func TestTransactionsAddedNeedsMatchingBalance(t *testing.T) {
	h, checking, assertion := newDifference(t)
	h.ExpectProblem(resolve(h, assertion, "transactions_added"), http.StatusConflict, "difference_remains", "")

	fees := h.Account("Bank fees", "expense", "", nil)
	h.Record("2026-10-20", apitest.Posting(checking, -210), apitest.Posting(fees, 210))
	var res assertionResult
	h.MustDo(http.MethodPost, "/api/v1/balance-assertions/"+assertion+"/resolve", map[string]string{"resolution": "transactions_added"}, http.StatusOK, &res)
	if res.Resolution != "transactions_added" || res.Difference.Amount != 0 || res.ResolutionTransactionID != "" {
		t.Fatalf("result = %+v", res)
	}
}

func TestUnlockAllowsCorrection(t *testing.T) {
	r := newReserveSetup(t)
	if resp := assertBalance(r.h, r.reserve, "2026-10-31", 1000000); resp.Status != http.StatusCreated {
		t.Fatalf("status %d", resp.Status)
	}
	correction := map[string]any{
		"date": "2026-10-02", "expected_version": 1, "reason": "wrong date",
		"postings": []map[string]any{apitest.Posting(r.checking, -1000000), apitest.Posting(r.reserve, 1000000)},
	}
	r.h.ExpectProblem(r.h.Do(http.MethodPut, "/api/v1/transactions/"+r.transfer, correction), http.StatusConflict, "posting_reconciled", "")
	r.h.ExpectProblem(r.h.Do(http.MethodPost, "/api/v1/transactions/"+r.transfer+"/void", map[string]string{"reason": "duplicate"}), http.StatusConflict, "posting_reconciled", "")

	r.h.MustDo(http.MethodPost, "/api/v1/accounts/"+r.reserve+"/unlock", map[string]string{"from": "2026-10-01"}, http.StatusOK, nil)
	if s := reconciliationOf(r.h, r.reserve); s.LastReconciledOn != "" || s.OpenDifference == nil {
		t.Fatalf("status after unlock = %+v", s)
	}
	r.h.MustDo(http.MethodPut, "/api/v1/transactions/"+r.transfer, correction, http.StatusOK, nil)
}

func TestUnlockKeepsEarlierReconciliations(t *testing.T) {
	r := newReserveSetup(t)
	assertBalance(r.h, r.reserve, "2026-10-15", 1000000)
	assertBalance(r.h, r.reserve, "2026-10-31", 1000000)
	r.h.MustDo(http.MethodPost, "/api/v1/accounts/"+r.reserve+"/unlock", map[string]string{"from": "2026-10-20"}, http.StatusOK, nil)
	if s := reconciliationOf(r.h, r.reserve); s.LastReconciledOn != "2026-10-15" {
		t.Fatalf("status after unlock = %+v", s)
	}
	if p := r.h.Transaction(r.transfer).Postings; p[0].Status != "reconciled" && p[1].Status != "reconciled" {
		t.Fatal("posting settled before the unlock date lost its reconciled status")
	}
}

func reconcileStatement(c cardSetup, reference string, amountDue int64) apitest.Response {
	id := statements(c.h.T(), c.h, c.card)[reference].ID
	return c.h.Do(http.MethodPost, "/api/v1/statements/"+id+"/reconcile", map[string]any{"amount_due": apitest.BRL(amountDue)})
}

func TestStatementReconciliationLocksPurchases(t *testing.T) {
	c := newCardSetup(t, "2026-11-05")
	purchase := c.purchase("2026-10-14", 100000)
	c.purchase("2026-10-20", 50000)
	if statements(t, c.h, c.card)["2026-11"].Reconciled {
		t.Fatal("statement reconciled before confirmation")
	}
	if resp := reconcileStatement(c, "2026-11", 150000); resp.Status != http.StatusOK {
		t.Fatalf("status %d: %s", resp.Status, resp.Body)
	}
	if !statements(t, c.h, c.card)["2026-11"].Reconciled {
		t.Fatal("statement not reported as reconciled")
	}
	for _, p := range c.h.Transaction(purchase).Postings {
		if want := map[bool]string{true: "reconciled", false: "cleared"}[p.AccountID == c.card]; p.Status != want {
			t.Fatalf("posting of %s: status %q, want %q", p.AccountID, p.Status, want)
		}
	}
	if s := reconciliationOf(c.h, c.card); s.LastReconciledOn != "2026-11-03" {
		t.Fatalf("card reconciliation = %+v", s)
	}
	c.h.ExpectProblem(c.h.Do(http.MethodPut, "/api/v1/transactions/"+purchase, map[string]any{
		"date": "2026-10-14", "expected_version": 1, "reason": "wrong amount",
		"postings": []map[string]any{apitest.Posting(c.card, -90000), apitest.Posting(c.food, 90000)},
	}), http.StatusConflict, "posting_reconciled", "")
	c.h.ExpectProblem(reconcileStatement(c, "2026-11", 150000), http.StatusConflict, "already_reconciled", "")
}

func TestStatementReconciliationRejects(t *testing.T) {
	c := newCardSetup(t, "2026-11-05")
	purchase := c.purchase("2026-10-14", 100000)
	c.purchase("2026-11-04", 30000)
	c.h.ExpectProblem(reconcileStatement(c, "2026-11", 99000), http.StatusConflict, "difference_remains", "")
	c.h.ExpectProblem(reconcileStatement(c, "2026-12", 30000), http.StatusConflict, "statement_not_closed", "")
	for _, p := range c.h.Transaction(purchase).Postings {
		if p.Status == "reconciled" {
			t.Fatal("rejected reconciliation marked postings")
		}
	}
}

func TestUnlockReleasesWholeStatement(t *testing.T) {
	c := newCardSetup(t, "2026-11-05")
	purchase := c.purchase("2026-10-14", 100000)
	if resp := reconcileStatement(c, "2026-11", 100000); resp.Status != http.StatusOK {
		t.Fatalf("status %d: %s", resp.Status, resp.Body)
	}
	c.h.MustDo(http.MethodPost, "/api/v1/accounts/"+c.card+"/unlock", map[string]string{"from": "2026-10-20"}, http.StatusOK, nil)
	for _, p := range c.h.Transaction(purchase).Postings {
		if p.Status == "reconciled" {
			t.Fatal("a posting of an unlocked statement stayed reconciled")
		}
	}
}

func TestCreatedAssertionReportsReconciled(t *testing.T) {
	r := newReserveSetup(t)
	for _, c := range []struct {
		name   string
		date   string
		amount int64
		want   bool
	}{
		{"matching balance", "2026-10-15", 1000000, true},
		{"open difference", "2026-10-16", 999000, false},
	} {
		t.Run(c.name, func(t *testing.T) {
			resp := assertBalance(r.h, r.reserve, c.date, c.amount)
			if resp.Status != http.StatusCreated {
				t.Fatalf("status %d: %s", resp.Status, resp.Body)
			}
			var res struct {
				Assertion struct {
					Reconciled bool `json:"reconciled"`
				} `json:"assertion"`
			}
			resp.Decode(t, &res)
			if res.Assertion.Reconciled != c.want {
				t.Fatalf("assertion.reconciled = %v, want %v: %s", res.Assertion.Reconciled, c.want, resp.Body)
			}
		})
	}
}
