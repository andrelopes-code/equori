package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// investFixture holds the brokerage accounts of fixture 6.1: XP with XP cash (BRL),
// XP MXRF11 and XP PETR4.
type investFixture struct {
	h              *apitest.Harness
	institution    string
	xp, cash       string
	mxrf11, petr4  string
	nubank, travel string
}

func security(code, typ string) map[string]any {
	return map[string]any{"code": code, "type": typ, "scale": 0, "name": code, "quote_currency": "BRL", "exchange": "BVMF"}
}

func newInvestFixture(t *testing.T, opts ...apitest.Option) investFixture {
	h := apitest.New(t, opts...)
	h.MustDo(http.MethodPost, "/api/v1/instruments", security("MXRF11", "reit"), http.StatusCreated, nil)
	h.MustDo(http.MethodPost, "/api/v1/instruments", security("PETR4", "stock"), http.StatusCreated, nil)
	var inst idOnly
	h.MustDo(http.MethodPost, "/api/v1/institutions", map[string]string{"name": "XP"}, http.StatusCreated, &inst)
	f := investFixture{h: h, institution: inst.ID}
	f.xp = h.Account("XP", "asset", "brokerage", map[string]any{"institution_id": inst.ID})
	child := func(name, currency string) string {
		return h.Account(name, "asset", "brokerage", map[string]any{"institution_id": inst.ID, "parent_id": f.xp, "currency": currency})
	}
	f.cash = child("XP cash", "BRL")
	f.mxrf11 = child("XP MXRF11", "MXRF11")
	f.petr4 = child("XP PETR4", "PETR4")
	f.nubank = h.Account("Nubank checking", "asset", "checking", nil)
	f.travel = h.Account("Travel", "expense", "", nil)
	return f
}

func units(amount int64, code string) map[string]any {
	return map[string]any{"amount": amount, "currency": code}
}

func TestSecurityAccounts(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	h := f.h

	var acc struct {
		Currency string `json:"currency"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+f.mxrf11, nil, http.StatusOK, &acc)
	if acc.Currency != "MXRF11" {
		t.Fatalf("currency = %q", acc.Currency)
	}

	id := h.Record("2026-10-05",
		apitest.Posting(f.cash, -151240),
		map[string]any{"account_id": f.mxrf11, "amount": units(150, "MXRF11"), "weight": apitest.BRL(151240)},
	)
	var tx struct {
		Postings []struct {
			AccountID string         `json:"account_id"`
			Amount    map[string]any `json:"amount"`
			Weight    map[string]any `json:"weight"`
		} `json:"postings"`
	}
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+id, nil, http.StatusOK, &tx)
	if p := tx.Postings[1]; p.AccountID != f.mxrf11 || p.Amount["amount"] != float64(150) || p.Amount["currency"] != "MXRF11" || p.Weight["amount"] != float64(151240) {
		t.Fatalf("security posting = %+v", p)
	}

	var bal struct {
		Balance struct {
			Amount   int64  `json:"amount"`
			Currency string `json:"currency"`
		} `json:"balance"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+f.mxrf11+"/balance?date=2026-10-31", nil, http.StatusOK, &bal)
	if bal.Balance.Amount != 150 || bal.Balance.Currency != "MXRF11" {
		t.Fatalf("MXRF11 balance = %+v", bal.Balance)
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+f.cash+"/balance?date=2026-10-31", nil, http.StatusOK, &bal)
	if bal.Balance.Amount != -151240 || bal.Balance.Currency != "BRL" {
		t.Fatalf("XP cash balance = %+v", bal.Balance)
	}

	// Review Focus 5: a parent holding reais and shares has no single balance.
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/accounts/"+f.xp+"/balance?date=2026-10-31", nil), http.StatusUnprocessableEntity, "mixed_instruments", "")
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/reports/balances?account_id="+f.xp+"&from=2026-10-01&to=2026-10-31", nil), http.StatusUnprocessableEntity, "mixed_instruments", "")
}

func TestSecurityAccountRules(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	h := f.h
	account := func(extra map[string]any) apitest.Response {
		body := map[string]any{"name": "Shares", "class": "asset", "kind": "brokerage", "institution_id": f.institution, "currency": "PETR4"}
		for k, v := range extra {
			body[k] = v
		}
		return h.Do(http.MethodPost, "/api/v1/accounts", body)
	}
	usdBroker := h.Account("Avenue", "asset", "brokerage", map[string]any{"institution_id": f.institution, "currency": "USD"})

	h.ExpectProblem(account(nil), http.StatusUnprocessableEntity, "validation_failed", "currency")
	h.ExpectProblem(account(map[string]any{"parent_id": usdBroker}), http.StatusUnprocessableEntity, "validation_failed", "currency")
	h.ExpectProblem(account(map[string]any{"parent_id": f.mxrf11}), http.StatusUnprocessableEntity, "validation_failed", "currency")
	h.ExpectProblem(account(map[string]any{"parent_id": f.xp, "kind": "checking"}), http.StatusUnprocessableEntity, "validation_failed", "currency")
	h.ExpectProblem(account(map[string]any{"parent_id": f.xp, "currency": "VALE3"}), http.StatusUnprocessableEntity, "validation_failed", "currency")
}

// P8 amendment A64.
func TestOriginalAmountRules(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	h := f.h
	record := func(original map[string]any) apitest.Response {
		return h.Do(http.MethodPost, "/api/v1/transactions", map[string]any{"date": "2026-10-22", "description": "hotel", "postings": []map[string]any{
			{"account_id": f.travel, "amount": apitest.BRL(54830), "original": original},
			apitest.Posting(f.nubank, -54830),
		}})
	}
	if r := record(units(10000, "USD")); r.Status != http.StatusCreated {
		t.Fatalf("valid original: %d %s", r.Status, r.Body)
	}
	h.ExpectProblem(record(units(54830, "BRL")), http.StatusUnprocessableEntity, "validation_failed", "postings[0].original")
	h.ExpectProblem(record(units(-10000, "USD")), http.StatusUnprocessableEntity, "validation_failed", "postings[0].original")
	h.ExpectProblem(record(units(10, "MXRF11")), http.StatusUnprocessableEntity, "validation_failed", "postings[0].original")
	h.ExpectProblem(record(units(0, "USD")), http.StatusUnprocessableEntity, "validation_failed", "postings[0].original")
}
