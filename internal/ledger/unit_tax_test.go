package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// A236 FC25 (amended 2026-11-18): S530 to S533.
func TestS530UnitTaxKeepsTheCostAndCreditsPrepaidTax(t *testing.T) {
	t.Parallel()
	f := newFundFixture(t)
	f.buyFund(t, "2026-05-04")

	var tx actionTx
	f.h.MustDo(
		http.MethodPost,
		corporateActionsPath,
		f.unitTaxBody("2026-05-29", map[string]any{
			"quantity": units(12500000, "FUNDX"),
			"amount":   apitest.BRL(15000),
		}),
		http.StatusCreated,
		&tx,
	)

	expectPostings(
		t,
		tx.Postings,
		[3]any{f.fund, int64(-1000000000), int64(-1000000)},
		[3]any{f.fund, int64(987500000), int64(1000000)},
		[3]any{systemAccount(t, f.h, "prepaid_tax"), int64(15000), int64(15000)},
		[3]any{systemAccount(t, f.h, "adjustments"), int64(-15000), int64(-15000)},
	)

	var read actionTx
	f.h.MustDo(http.MethodGet, "/api/v1/transactions/"+tx.ID, nil, http.StatusOK, &read)

	a := read.CorporateAction
	if a == nil || a.Kind != "unit_tax" || a.RatioFrom != 1 || a.RatioTo != 1 ||
		a.Held["amount"] != float64(1000000000) || a.Received["amount"] != float64(987500000) ||
		a.Value["amount"] != float64(15000) {
		t.Fatalf("detail = %+v", a)
	}

	var balance struct {
		Balance map[string]any `json:"balance"`
	}

	f.h.MustDo(
		http.MethodGet,
		"/api/v1/accounts/"+systemAccount(t, f.h, "prepaid_tax")+"/balance?date=2026-05-29",
		nil,
		http.StatusOK,
		&balance,
	)

	if balance.Balance["amount"] != float64(15000) {
		t.Fatalf("prepaid_tax balance = %+v", balance)
	}
}

func TestS531UnitTaxBeforeALaterSale(t *testing.T) {
	t.Parallel()
	f := newFundFixture(t)
	f.buyFund(t, "2026-05-04")
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/trades",
		f.fundOrder("2026-06-10", map[string]any{
			"side":       "sell",
			"quantity":   units(100000000, "FUNDX"),
			"unit_price": "11.00",
		}),
		http.StatusCreated,
		nil,
	)

	f.h.ExpectProblem(
		f.h.Do(http.MethodPost, corporateActionsPath, f.unitTaxBody("2026-05-29", nil)),
		http.StatusConflict, "later_sale_exists", "",
	)
}

func TestS532UnitTaxOnAStock(t *testing.T) {
	t.Parallel()
	f := newFundFixture(t)
	f.buyPETR4(t, "2026-05-04", nil)

	body := f.unitTaxBody("2026-05-29", map[string]any{
		"account_id": f.petr4,
		"quantity":   units(10, "PETR4"),
	})

	f.h.ExpectProblem(
		f.h.Do(http.MethodPost, corporateActionsPath, body),
		http.StatusUnprocessableEntity, "validation_failed", "account_id",
	)
}

func TestS533UnitTaxQuantityAndAmountBounds(t *testing.T) {
	t.Parallel()
	f := newFundFixture(t)
	f.buyFund(t, "2026-05-04")

	cases := []struct {
		name  string
		extra map[string]any
		field string
	}{
		{"all units", map[string]any{"quantity": units(1000000000, "FUNDX")}, "quantity"},
		{"zero units", map[string]any{"quantity": units(0, "FUNDX")}, "quantity"},
		{"no quantity", map[string]any{"quantity": nil}, "quantity"},
		{"zero amount", map[string]any{"amount": apitest.BRL(0)}, "amount"},
		{"no amount", map[string]any{"amount": nil}, "amount"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			f.h.ExpectProblem(
				f.h.Do(http.MethodPost, corporateActionsPath, f.unitTaxBody("2026-05-29", c.extra)),
				http.StatusUnprocessableEntity, "validation_failed", c.field,
			)
		})
	}
}

type fundFixture struct {
	investFixture
	fund string
}

// newFundFixture adds a fund instrument of six decimals and a holding of it to the invest fixture.
func newFundFixture(t *testing.T) fundFixture {
	t.Helper()

	f := newInvestFixture(t)
	instrument := security("FUNDX", "fund")
	instrument["scale"] = 6
	f.h.MustDo(http.MethodPost, "/api/v1/instruments", instrument, http.StatusCreated, nil)

	fund := f.h.Account(
		"XP FUNDX",
		"asset",
		"brokerage",
		map[string]any{"institution_id": f.institution, "parent_id": f.xp, "currency": "FUNDX"},
	)

	return fundFixture{investFixture: f, fund: fund}
}

// buyFund buys 1000.000000 units at 10.00: a cost basis of 10000.00.
func (f fundFixture) buyFund(t *testing.T, date string) {
	t.Helper()
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/trades",
		f.fundOrder(date, nil),
		http.StatusCreated,
		nil,
	)
}

func (f fundFixture) fundOrder(date string, extra map[string]any) map[string]any {
	order := map[string]any{
		"account_id":      f.fund,
		"cash_account_id": f.cash,
		"side":            "buy",
		"date":            date,
		"quantity":        units(1000000000, "FUNDX"),
		"unit_price":      "10.00",
	}
	for k, v := range extra {
		order[k] = v
	}

	return order
}

// unitTaxBody is a valid unit tax of 12.500000 units and 150.00 on the fund; a nil value in
// extra removes the key.
func (f fundFixture) unitTaxBody(date string, extra map[string]any) map[string]any {
	body := map[string]any{
		"account_id": f.fund,
		"kind":       "unit_tax",
		"date":       date,
		"ratio_from": 1,
		"ratio_to":   1,
		"quantity":   units(12500000, "FUNDX"),
		"amount":     apitest.BRL(15000),
	}
	for k, v := range extra {
		if v == nil {
			delete(body, k)

			continue
		}

		body[k] = v
	}

	return body
}

// A236 FC25: the first unit tax of a book creates prepaid_tax; the second posts to it.
func TestUnitTaxCreatesPrepaidTaxOnce(t *testing.T) {
	t.Parallel()
	f := newFundFixture(t)
	f.buyFund(t, "2026-05-04")

	if _, found := systemAccounts(f.h)["prepaid_tax"]; found {
		t.Fatal("prepaid_tax exists before the first unit tax")
	}

	var first, second actionTx

	f.h.MustDo(
		http.MethodPost, corporateActionsPath, f.unitTaxBody("2026-05-29", nil),
		http.StatusCreated, &first,
	)

	var account struct {
		Class string `json:"class"`
		Kind  string `json:"kind"`
		Name  string `json:"name"`
	}

	prepaid := systemAccounts(f.h)["prepaid_tax"]
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+prepaid, nil, http.StatusOK, &account)

	if account.Class != "asset" || account.Kind != "receivable" ||
		account.Name != "Prepaid income tax" {
		t.Fatalf("prepaid_tax = %+v", account)
	}

	f.h.MustDo(
		http.MethodPost, corporateActionsPath, f.unitTaxBody("2026-11-30", nil),
		http.StatusCreated, &second,
	)

	if first.Postings[2].AccountID != prepaid || second.Postings[2].AccountID != prepaid ||
		systemAccounts(f.h)["prepaid_tax"] != prepaid {
		t.Fatalf("prepaid_tax accounts differ: %s %s", first.Postings[2].AccountID,
			second.Postings[2].AccountID)
	}
}
