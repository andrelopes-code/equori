package reporting_test

import (
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type amount struct {
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
}

type ratio struct {
	BP     *int64 `json:"bp"`
	Reason string `json:"reason"`
}

func (r ratio) String() string {
	if r.BP != nil {
		return strconv.FormatInt(*r.BP, 10)
	}
	return r.Reason
}

type indicatorMonth struct {
	Month               string  `json:"month"`
	Income              amount  `json:"income"`
	Expense             amount  `json:"expense"`
	Committed           amount  `json:"committed"`
	DebtService         amount  `json:"debt_service"`
	LiquidBalance       amount  `json:"liquid_balance"`
	Liabilities         amount  `json:"liabilities"`
	MeanIncome          *amount `json:"mean_income"`
	MeanExpense         *amount `json:"mean_expense"`
	SavingsRate         ratio   `json:"savings_rate"`
	TrailingSavingsRate ratio   `json:"trailing_savings_rate"`
	Liquidity           ratio   `json:"liquidity"`
	CommittedShare      ratio   `json:"committed_share"`
	DebtServiceShare    ratio   `json:"debt_service_share"`
}

type indicatorReport struct {
	Currency string           `json:"currency"`
	Months   []indicatorMonth `json:"months"`
}

func indicators(t *testing.T, h *apitest.Harness, month string) indicatorReport {
	t.Helper()
	var out indicatorReport
	h.MustDo(http.MethodGet, "/api/v1/reports/indicators?month="+month, nil, http.StatusOK, &out)
	return out
}

func interestAccount(t *testing.T, h *apitest.Harness) string {
	t.Helper()
	var out struct {
		Items []struct {
			ID         string `json:"id"`
			SystemRole string `json:"system_role"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &out)
	for _, a := range out.Items {
		if a.SystemRole == "interest" {
			return a.ID
		}
	}
	t.Fatal("no system account interest")
	return ""
}

// opened is the extra field of every account of these tests, so postings from 2026-04 fall inside
// the account's life; more adds other fields.
func opened(more map[string]any) map[string]any {
	out := map[string]any{"opened_on": "2026-01-01"}
	for k, v := range more {
		out[k] = v
	}
	return out
}

func months(from, to int) []string {
	var out []string
	for m := from; m <= to; m++ {
		out = append(out, fmt.Sprintf("2026-%02d", m))
	}
	return out
}

func ratios(report indicatorReport, pick func(indicatorMonth) ratio) []string {
	out := make([]string, len(report.Months))
	for i, m := range report.Months {
		out[i] = pick(m).String()
	}
	return out
}

func times(s string, n int) []string { return slices.Repeat([]string{s}, n) }

func TestS154(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-20"))
	checking := h.Account("Checking", "asset", "checking", opened(nil))
	savings := h.Account("Savings", "asset", "savings", opened(nil))
	cdb := h.Account("Locked CDB", "asset", "savings", opened(nil))
	meal := h.Account("Meal card", "asset", "benefit", opened(nil))
	dollars := h.Account("Dollars", "asset", "wallet", opened(map[string]any{"currency": "USD"}))
	loan := h.Account("Personal loan", "liability", "loan", opened(nil))
	salary := h.Account("Salary", "income", "", opened(nil))
	rent := h.Account("Rent", "expense", "", opened(nil))
	food := h.Account("Food", "expense", "", opened(nil))
	streaming := h.Account("Streaming", "expense", "", opened(nil))
	interest := interestAccount(t, h)

	for _, m := range months(4, 10) {
		h.Record(m+"-05", apitest.Posting(checking, 500000), apitest.Posting(salary, -500000))
		h.Record(m+"-10", apitest.Posting(checking, -150000), apitest.Posting(rent, 150000))
		h.Record(m+"-15", apitest.Posting(checking, -100000), apitest.Posting(food, 100000))
	}
	h.Record("2026-06-01", apitest.Posting(checking, 1000000), apitest.Posting(loan, -1000000))
	for _, m := range months(7, 10) {
		h.Record(m+"-20", apitest.Posting(checking, -125000), apitest.Posting(loan, 90000), apitest.Posting(interest, 35000))
	}
	h.Record("2026-08-01", apitest.Posting(checking, -300000), apitest.Posting(savings, 300000))
	h.Record("2026-08-02", apitest.Posting(checking, -400000), apitest.Posting(cdb, 400000))
	h.Record("2026-10-01", apitest.Posting(checking, -60000), apitest.Posting(meal, 60000))
	h.MustDo(http.MethodPost, "/api/v1/exchanges", map[string]any{
		"from_account_id": checking, "to_account_id": dollars, "date": "2026-10-01",
		"from_amount": apitest.BRL(50000), "to_amount": map[string]any{"amount": 10000, "currency": "USD"},
	}, http.StatusCreated, nil)
	h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument": "USD", "quote_instrument": "BRL", "date": "2026-10-20", "value": "5",
	}, http.StatusCreated, nil)
	h.MustDo(http.MethodPatch, "/api/v1/accounts/"+cdb, map[string]any{"excluded_from_liquidity": true}, http.StatusOK, nil)
	h.MustDo(http.MethodPost, "/api/v1/schedules", map[string]any{
		"kind": "subscription", "account_id": checking, "counterpart_id": streaming, "description": "Streaming",
		"amount":     apitest.BRL(5000),
		"recurrence": map[string]any{"frequency": "monthly", "interval": 1, "day_of_month": 25, "start": "2026-10-25"},
	}, http.StatusCreated, nil)
	h.Dispatch()

	var commitments struct {
		Total amount `json:"total"`
	}
	r := h.Do(http.MethodGet, "/api/v1/commitments?month=2026-10", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("commitments = %d: %s", r.Status, r.Body)
	}
	r.Decode(t, &commitments)
	if commitments.Total.Amount != 5000 {
		t.Fatalf("commitments of 2026-10 = %s, want total 5000", r.Body)
	}

	got := indicators(t, h, "2026-10")
	if got.Currency != "BRL" || len(got.Months) != 12 || got.Months[0].Month != "2025-11" || got.Months[11].Month != "2026-10" {
		t.Fatalf("report = %+v", got)
	}
	last := got.Months[11]
	brl := func(v int64) amount { return amount{Amount: v, Currency: "BRL"} }
	for _, c := range []struct {
		name      string
		got, want amount
	}{
		{"income", last.Income, brl(500000)},
		{"expense", last.Expense, brl(285000)},
		{"committed", last.Committed, brl(5000)},
		{"debt_service", last.DebtService, brl(125000)},
		{"liquid_balance", last.LiquidBalance, brl(1790000)},
		{"liabilities", last.Liabilities, brl(640000)},
	} {
		if c.got != c.want {
			t.Errorf("%s = %+v, want %+v", c.name, c.got, c.want)
		}
	}
	if last.MeanIncome == nil || *last.MeanIncome != brl(500000) || last.MeanExpense == nil || *last.MeanExpense != brl(267500) {
		t.Errorf("means = %+v, %+v", last.MeanIncome, last.MeanExpense)
	}
	for _, c := range []struct {
		name string
		got  ratio
		want string
	}{
		{"savings_rate", last.SavingsRate, "4300"},
		{"trailing_savings_rate", last.TrailingSavingsRate, "4650"},
		{"liquidity", last.Liquidity, "66915"},
		{"committed_share", last.CommittedShare, "100"},
		{"debt_service_share", last.DebtServiceShare, "2500"},
	} {
		if c.got.String() != c.want {
			t.Errorf("%s = %s, want %s", c.name, c.got, c.want)
		}
	}
	wantSavings := slices.Concat(times("no_income", 5), times("5000", 3), times("4300", 4))
	if s := ratios(got, func(m indicatorMonth) ratio { return m.SavingsRate }); !slices.Equal(s, wantSavings) {
		t.Errorf("savings rates = %v, want %v", s, wantSavings)
	}
	wantTrailing := slices.Concat(times("insufficient_history", 8), []string{"5000", "4825", "4720", "4650"})
	if s := ratios(got, func(m indicatorMonth) ratio { return m.TrailingSavingsRate }); !slices.Equal(s, wantTrailing) {
		t.Errorf("trailing savings rates = %v, want %v", s, wantTrailing)
	}
}

func TestS155(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-20"))
	other := h.Login("other@example.com")
	create := func(body map[string]any) string {
		r := h.Call(other, http.MethodPost, "/api/v1/accounts", body)
		if r.Status != http.StatusCreated {
			t.Fatalf("create account = %d: %s", r.Status, r.Body)
		}
		var out struct {
			ID string `json:"id"`
		}
		r.Decode(t, &out)
		return out.ID
	}
	checking := create(map[string]any{"name": "Checking", "class": "asset", "kind": "checking", "currency": "BRL", "opened_on": "2026-01-01"})
	salary := create(map[string]any{"name": "Salary", "class": "income", "currency": "BRL", "opened_on": "2026-01-01"})
	r := h.Call(other, http.MethodPost, "/api/v1/transactions", map[string]any{
		"date": "2026-10-05", "description": "salary",
		"postings": []map[string]any{apitest.Posting(checking, 500000), apitest.Posting(salary, -500000)},
	})
	if r.Status != http.StatusCreated {
		t.Fatalf("record = %d: %s", r.Status, r.Body)
	}

	got := indicators(t, h, "2026-10")
	if len(got.Months) != 12 {
		t.Fatalf("months = %d", len(got.Months))
	}
	last := got.Months[11]
	zero := amount{Currency: "BRL"}
	for _, a := range []amount{last.Income, last.Expense, last.Committed, last.DebtService, last.LiquidBalance, last.Liabilities} {
		if a != zero {
			t.Errorf("amount = %+v, want 0 BRL in %+v", a, last)
		}
	}
	if last.MeanIncome != nil || last.MeanExpense != nil {
		t.Errorf("means = %+v, %+v", last.MeanIncome, last.MeanExpense)
	}
	if last.SavingsRate.String() != "no_income" {
		t.Errorf("savings_rate = %s", last.SavingsRate)
	}
	for _, r := range []ratio{last.TrailingSavingsRate, last.Liquidity, last.CommittedShare, last.DebtServiceShare} {
		if r.String() != "insufficient_history" {
			t.Errorf("ratio = %s, want insufficient_history", r)
		}
	}
}

// salaryBooks records the books of S156.
func salaryBooks(h *apitest.Harness) {
	checking := h.Account("Checking", "asset", "checking", opened(nil))
	salary := h.Account("Salary", "income", "", opened(nil))
	for _, m := range months(7, 10) {
		h.Record(m+"-05", apitest.Posting(checking, 500000), apitest.Posting(salary, -500000))
	}
}

func TestS156(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-20"))
	salaryBooks(h)
	last := indicators(t, h, "2026-10").Months[11]
	for _, c := range []struct {
		name string
		got  ratio
		want string
	}{
		{"savings_rate", last.SavingsRate, "10000"},
		{"trailing_savings_rate", last.TrailingSavingsRate, "10000"},
		{"liquidity", last.Liquidity, "no_expense"},
		{"committed_share", last.CommittedShare, "0"},
		{"debt_service_share", last.DebtServiceShare, "0"},
	} {
		if c.got.String() != c.want {
			t.Errorf("%s = %s, want %s", c.name, c.got, c.want)
		}
	}
}

func TestIndicatorsMonthProblems(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-20"))
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/reports/indicators?month=2026-11", nil), http.StatusBadRequest, "invalid_request", "month")
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/reports/indicators?month=2026-13", nil), http.StatusBadRequest, "invalid_request", "")
}

func TestIndicatorsPriceMissing(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-20"))
	checking := h.Account("Checking", "asset", "checking", opened(nil))
	dollars := h.Account("Dollars", "asset", "wallet", opened(map[string]any{"currency": "USD"}))
	h.MustDo(http.MethodPost, "/api/v1/exchanges", map[string]any{
		"from_account_id": checking, "to_account_id": dollars, "date": "2026-10-01",
		"from_amount": apitest.BRL(50000), "to_amount": map[string]any{"amount": 10000, "currency": "USD"},
	}, http.StatusCreated, nil)
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/reports/indicators?month=2026-10", nil), http.StatusUnprocessableEntity, "price_missing", "")
}
