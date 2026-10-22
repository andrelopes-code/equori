package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type incomeOut struct {
	IncomeType string         `json:"income_type"`
	Gross      map[string]any `json:"gross"`
	Withheld   map[string]any `json:"withheld"`
	AccountID  string         `json:"account_id"`
}

type incomeTx struct {
	ID       string       `json:"id"`
	Version  int          `json:"version"`
	Postings []postingOut `json:"postings"`
	Income   *incomeOut   `json:"investment_income"`
}

type incomeFixture struct {
	investFixture
	dividends, jcp, incomeTax string
}

func newIncomeFixture(t *testing.T) incomeFixture {
	f := incomeFixture{investFixture: newInvestFixture(t)}
	f.dividends = f.h.Account("Dividends", "income", "", nil)
	f.jcp = f.h.Account("JCP", "income", "", nil)
	f.incomeTax = f.h.Account("Income tax", "expense", "", map[string]any{"parent_id": systemAccount(t, f.h, "taxes")})
	return f
}

func (f incomeFixture) income(t *testing.T, body map[string]any) incomeTx {
	t.Helper()
	var out incomeTx
	r := f.h.Do(http.MethodPost, "/api/v1/investment-income", body)
	if r.Status != http.StatusCreated {
		t.Fatalf("income: %d %s", r.Status, r.Body)
	}
	r.Decode(t, &out)
	return out
}

func TestS22InvestmentIncome(t *testing.T) {
	t.Parallel()
	f := newIncomeFixture(t)
	dividend := f.income(t, map[string]any{
		"account_id": f.mxrf11, "cash_account_id": f.cash, "income_type": "dividend", "date": "2026-10-26",
		"gross": apitest.BRL(1000), "category_id": f.dividends,
	})
	expectPostings(t, dividend.Postings, [3]any{f.cash, int64(1000), int64(1000)}, [3]any{f.dividends, int64(-1000), int64(-1000)})

	jcp := f.income(t, map[string]any{
		"account_id": f.petr4, "cash_account_id": f.cash, "income_type": "jcp", "date": "2026-10-26",
		"gross": apitest.BRL(4500), "category_id": f.jcp, "withheld_category_id": f.incomeTax,
	})
	expectPostings(t, jcp.Postings, [3]any{f.cash, int64(3825), int64(3825)}, [3]any{f.incomeTax, int64(675), int64(675)}, [3]any{f.jcp, int64(-4500), int64(-4500)})

	var read incomeTx
	f.h.MustDo(http.MethodGet, "/api/v1/transactions/"+jcp.ID, nil, http.StatusOK, &read)
	if read.Income == nil || read.Income.IncomeType != "jcp" || read.Income.AccountID != f.petr4 || read.Income.Gross["amount"] != float64(4500) || read.Income.Withheld["amount"] != float64(675) {
		t.Fatalf("income detail = %+v", read.Income)
	}
}

func TestInvestmentIncomeRules(t *testing.T) {
	t.Parallel()
	f := newIncomeFixture(t)
	h := f.h
	order := func(k string, v any) map[string]any {
		body := map[string]any{
			"account_id": f.petr4, "cash_account_id": f.cash, "income_type": "jcp", "date": "2026-10-26",
			"gross": apitest.BRL(4500), "category_id": f.jcp,
		}
		body[k] = v
		return body
	}
	zero := f.income(t, order("withheld", apitest.BRL(0)))
	if len(zero.Postings) != 2 || zero.Postings[0].Amount["amount"] != float64(4500) {
		t.Fatalf("JCP without withholding = %+v", zero.Postings)
	}
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/investment-income", order("withheld", apitest.BRL(4500))), http.StatusUnprocessableEntity, "validation_failed", "withheld")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/investment-income", order("category_id", f.travel)), http.StatusUnprocessableEntity, "validation_failed", "category_id")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/investment-income", order("income_type", "Bad!")), http.StatusBadRequest, "invalid_request", "")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/investment-income", order("account_id", f.cash)), http.StatusUnprocessableEntity, "validation_failed", "account_id")
	h.ExpectProblem(h.Do(http.MethodPut, "/api/v1/transactions/"+zero.ID, map[string]any{
		"expected_version": zero.Version, "date": "2026-10-26", "description": "edit", "reason": "edit",
		"postings": []map[string]any{apitest.Posting(f.cash, 100), apitest.Posting(f.jcp, -100)},
	}), http.StatusConflict, "investment_transaction", "")
}
