package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// Acceptance scenarios of docs/domain/06-scenarios.md that phase P1 covers.

type fixture struct {
	h                                                   *apitest.Harness
	nubank, checking, emergency, wallet, vr, itauVisa   string
	receivableAna, receivableBruno, loanToAna, personal string
	food, restaurant, housing, transport, health        string
	taxes, inss, incomeTax, interest                    string
	salary, interestIncome, openingBalances             string
	yield, adjustments                                  string
}

func newFixture(t *testing.T, opts ...apitest.Option) fixture {
	h := apitest.New(t, opts...)
	f := fixture{h: h}
	inst := func(name string) string {
		var out idOnly
		h.MustDo(http.MethodPost, "/api/v1/institutions", map[string]string{"name": name}, http.StatusCreated, &out)
		return out.ID
	}
	nubankInst := inst("Nubank")
	f.nubank = h.Account("Nubank", "asset", "checking", map[string]any{"institution_id": nubankInst})
	f.checking = h.Account("Nubank checking", "asset", "checking", map[string]any{"institution_id": nubankInst, "parent_id": f.nubank})
	f.emergency = h.Account("Emergency fund", "asset", "reserve", map[string]any{"institution_id": nubankInst, "parent_id": f.nubank})
	f.wallet = h.Account("Wallet", "asset", "cash", nil)
	f.vr = h.Account("VR", "asset", "benefit", nil)
	f.itauVisa = h.Card("Itaú Visa", 3, 10, "next")
	f.receivableAna = h.Account("Receivable Ana", "asset", "receivable", nil)
	f.receivableBruno = h.Account("Receivable Bruno", "asset", "receivable", nil)
	f.loanToAna = h.Account("Loan to Ana", "asset", "loan", nil)
	f.personal = h.Account("Personal loan", "liability", "loan", nil)
	f.food = h.Account("Food", "expense", "", nil)
	f.restaurant = h.Account("Restaurant", "expense", "", map[string]any{"parent_id": f.food})
	f.housing = h.Account("Housing", "expense", "", nil)
	f.transport = h.Account("Transport", "expense", "", nil)
	f.health = h.Account("Health", "expense", "", nil)
	f.salary = h.Account("Salary", "income", "", nil)
	f.interestIncome = h.Account("Interest income", "income", "", nil)

	var accounts struct {
		Items []struct {
			ID         string `json:"id"`
			SystemRole string `json:"system_role"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts", nil, http.StatusOK, &accounts)
	for _, a := range accounts.Items {
		switch a.SystemRole {
		case "taxes":
			f.taxes = a.ID
		case "interest":
			f.interest = a.ID
		case "opening_balances":
			f.openingBalances = a.ID
		case "yield":
			f.yield = a.ID
		case "adjustments":
			f.adjustments = a.ID
		}
	}
	f.inss = h.Account("INSS", "expense", "", map[string]any{"parent_id": f.taxes})
	f.incomeTax = h.Account("Income tax", "expense", "", map[string]any{"parent_id": f.taxes})
	return f
}

func (f fixture) balance(t *testing.T, account, date, basis string) int64 {
	t.Helper()
	var out struct {
		Balance struct {
			Amount int64 `json:"amount"`
		} `json:"balance"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+account+"/balance?date="+date+"&basis="+basis, nil, http.StatusOK, &out)
	return out.Balance.Amount
}

func (f fixture) expectBalances(t *testing.T, date string, want map[string]int64) {
	t.Helper()
	for account, amount := range want {
		if got := f.balance(t, account, date, "booked"); got != amount {
			t.Errorf("balance of %s on %s = %d, want %d", account, date, got, amount)
		}
	}
}

func TestScenarios(t *testing.T) {
	p := apitest.Posting

	t.Run("S01", func(t *testing.T) {
		f := newFixture(t)
		f.h.Record("2026-10-05", p(f.checking, 500000), p(f.salary, -500000))
		f.expectBalances(t, "2026-10-05", map[string]int64{f.checking: 500000, f.salary: -500000})
	})

	t.Run("S02", func(t *testing.T) {
		f := newFixture(t)
		f.h.Record("2026-10-05",
			p(f.salary, -700000), p(f.inss, 70000), p(f.incomeTax, 90000), p(f.health, 20000), p(f.checking, 520000))
		f.expectBalances(t, "2026-10-05", map[string]int64{
			f.salary: -700000, f.taxes: 160000, f.health: 20000, f.checking: 520000,
		})
	})

	t.Run("S03", func(t *testing.T) {
		f := newFixture(t)
		f.h.Record("2026-10-10", p(f.checking, -12000), p(f.restaurant, 12000))
		f.h.Record("2026-10-10", p(f.checking, -38900), p(f.housing, 38900))
		f.h.Record("2026-10-10", p(f.vr, -4590), p(f.restaurant, 4590))
		f.h.Record("2026-10-10", p(f.wallet, -1800), p(f.transport, 1800))
		f.h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{"date": "2026-10-17", "postings": []map[string]any{
			{"account_id": f.checking, "amount": apitest.BRL(-8000), "settled_on": "2026-10-19"},
			p(f.food, 8000),
		}}, http.StatusCreated, nil)

		f.expectBalances(t, "2026-10-17", map[string]int64{
			f.checking: -58900, f.vr: -4590, f.wallet: -1800, f.food: 24590, f.housing: 38900, f.transport: 1800,
		})
		if got := f.balance(t, f.checking, "2026-10-18", "settled"); got != -50900 {
			t.Errorf("checking settled balance on 2026-10-18 = %d, want -50900", got)
		}
		if got := f.balance(t, f.checking, "2026-10-19", "settled"); got != -58900 {
			t.Errorf("checking settled balance on 2026-10-19 = %d, want -58900", got)
		}
	})

	t.Run("S04", func(t *testing.T) {
		f := newFixture(t)
		f.h.Record("2026-10-01", p(f.checking, 500000), p(f.salary, -500000))
		f.h.Record("2026-10-02", p(f.checking, -100000), p(f.emergency, 100000))
		f.expectBalances(t, "2026-10-02", map[string]int64{f.nubank: 500000, f.checking: 400000, f.emergency: 100000})
		f.h.Record("2026-10-03", p(f.checking, -30000), p(f.wallet, 30000))
		f.expectBalances(t, "2026-10-03", map[string]int64{f.nubank: 470000, f.wallet: 30000, f.salary: -500000})
	})

	t.Run("S19", func(t *testing.T) {
		f := newFixture(t)
		dinner := f.h.Record("2026-10-12",
			p(f.itauVisa, -30000), p(f.restaurant, 10000), p(f.receivableAna, 10000), p(f.receivableBruno, 10000))
		if card := f.h.Transaction(dinner).Postings[0]; card.Statement != "2026-11" || card.CardRole != "charge" {
			t.Errorf("dinner card posting billed on %q as %q, want 2026-11 charge", card.Statement, card.CardRole)
		}
		f.h.Record("2026-10-13", p(f.checking, 10000), p(f.receivableAna, -10000))
		f.expectBalances(t, "2026-10-13", map[string]int64{
			f.itauVisa: -30000, f.restaurant: 10000, f.receivableAna: 0, f.receivableBruno: 10000, f.checking: 10000,
		})
	})

	t.Run("S20", func(t *testing.T) {
		f := newFixture(t)
		f.h.Record("2026-10-01", p(f.checking, -100000), p(f.loanToAna, 100000))
		f.h.Record("2026-11-01", p(f.checking, 105000), p(f.loanToAna, -100000), p(f.interestIncome, -5000))
		f.h.Record("2026-10-01", p(f.checking, 1000000), p(f.personal, -1000000))
		f.h.Record("2026-11-05", p(f.checking, -125000), p(f.personal, 90000), p(f.interest, 35000))
		f.expectBalances(t, "2026-11-30", map[string]int64{
			f.loanToAna: 0, f.interestIncome: -5000, f.personal: -910000, f.interest: 35000, f.checking: 880000,
		})
	})

	t.Run("S23", func(t *testing.T) {
		f := newFixture(t)
		f.h.Record("2026-01-01", p(f.checking, 124055), p(f.openingBalances, -124055))
		f.expectBalances(t, "2026-01-01", map[string]int64{f.checking: 124055, f.openingBalances: -124055})
		f.expectBalances(t, "2025-12-31", map[string]int64{f.checking: 0})
	})
}
