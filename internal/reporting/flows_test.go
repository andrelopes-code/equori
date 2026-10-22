package reporting_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type flowDay struct {
	Inflow, Outflow int64
}

func flows(t *testing.T, h *apitest.Harness, account, from, to string) map[string]flowDay {
	t.Helper()
	var out struct {
		Items []struct {
			Date   string `json:"date"`
			Inflow struct {
				Amount   int64  `json:"amount"`
				Currency string `json:"currency"`
			} `json:"inflow"`
			Outflow struct {
				Amount   int64  `json:"amount"`
				Currency string `json:"currency"`
			} `json:"outflow"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, fmt.Sprintf("/api/v1/reports/flows?account_id=%s&from=%s&to=%s", account, from, to), nil, http.StatusOK, &out)
	m := make(map[string]flowDay, len(out.Items))
	for _, it := range out.Items {
		if it.Inflow.Currency != "BRL" || it.Outflow.Currency != "BRL" {
			t.Fatalf("flow currencies = %q, %q, want BRL", it.Inflow.Currency, it.Outflow.Currency)
		}
		m[it.Date] = flowDay{Inflow: it.Inflow.Amount, Outflow: it.Outflow.Amount}
	}
	return m
}

// S115: an income, a purchase and a transfer on one day are split into inflow and outflow.
func TestFlowsSplitInflowAndOutflow(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	savings := h.Account("Reserva", "asset", "savings", nil)
	salary := h.Account("Salary", "income", "", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-05", apitest.Posting(checking, 100000), apitest.Posting(salary, -100000))
	h.Record("2026-10-05", apitest.Posting(checking, -2500), apitest.Posting(food, 2500))
	h.Record("2026-10-05", apitest.Posting(checking, -10000), apitest.Posting(savings, 10000))
	h.Record("2026-10-07", apitest.Posting(checking, -800), apitest.Posting(food, 800))
	h.Dispatch()

	got := flows(t, h, checking, "2026-10-01", "2026-10-31")
	want := map[string]flowDay{"2026-10-05": {Inflow: 100000, Outflow: 12500}, "2026-10-07": {Outflow: 800}}
	if fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("checking flows = %v, want %v", got, want)
	}
	if got := flows(t, h, savings, "2026-10-01", "2026-10-31"); fmt.Sprint(got) != fmt.Sprint(map[string]flowDay{"2026-10-05": {Inflow: 10000}}) {
		t.Fatalf("savings flows = %v", got)
	}
}

// S116: on a card, purchases are outflow; a refund and a statement payment are inflow.
func TestFlowsOfCreditCard(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	card := h.Card("Nubank Gold", 3, 10, "next")
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-12", apitest.Posting(card, -3000), apitest.Posting(food, 3000))
	h.Record("2026-10-12", apitest.Posting(card, -2000), apitest.Posting(food, 2000))
	h.Record("2026-10-13", apitest.Posting(card, 1000), apitest.Posting(food, -1000))
	h.Record("2026-10-13", apitest.Posting(card, 4000), apitest.Posting(checking, -4000))
	h.Dispatch()

	got := flows(t, h, card, "2026-10-12", "2026-10-13")
	want := map[string]flowDay{"2026-10-12": {Outflow: 5000}, "2026-10-13": {Inflow: 5000}}
	if fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("card flows = %v, want %v", got, want)
	}
}

// S117: a day whose inflow equals its outflow is listed, and the balance series is unchanged.
func TestFlowsListsZeroDeltaDay(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	salary := h.Account("Salary", "income", "", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-01", apitest.Posting(checking, 5000), apitest.Posting(salary, -5000))
	h.Record("2026-10-02", apitest.Posting(checking, 700), apitest.Posting(salary, -700))
	h.Record("2026-10-02", apitest.Posting(checking, -700), apitest.Posting(food, 700))
	h.Dispatch()

	if got := flows(t, h, checking, "2026-10-02", "2026-10-02"); fmt.Sprint(got) != fmt.Sprint(map[string]flowDay{"2026-10-02": {Inflow: 700, Outflow: 700}}) {
		t.Fatalf("flows = %v", got)
	}
	s := series(t, h, checking, "2026-10-01", "2026-10-03", "booked")
	if s["2026-10-01"] != 5000 || s["2026-10-02"] != 5000 || s["2026-10-03"] != 5000 {
		t.Fatalf("series = %v, want 5000 on every day", s)
	}
}

// S118: a voided transaction has no flow; the range and the owner are checked.
func TestFlowsProblems(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-01", apitest.Posting(checking, -100), apitest.Posting(food, 100))
	id := h.Record("2026-10-02", apitest.Posting(checking, -50), apitest.Posting(food, 50))
	h.Dispatch()
	h.MustDo(http.MethodPost, "/api/v1/transactions/"+id+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)
	h.Dispatch()

	if got := flows(t, h, checking, "2026-10-01", "2026-10-03"); fmt.Sprint(got) != fmt.Sprint(map[string]flowDay{"2026-10-01": {Outflow: 100}}) {
		t.Fatalf("flows after void = %v", got)
	}
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/reports/flows?account_id="+checking+"&from=2026-10-03&to=2026-10-01", nil),
		http.StatusBadRequest, "invalid_request", "to")
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/reports/flows?account_id="+checking+"&from=2026-01-01&to=2027-01-02", nil),
		http.StatusBadRequest, "invalid_request", "to")
	if got := flows(t, h, checking, "2026-01-01", "2027-01-01"); len(got) != 1 {
		t.Fatalf("366-day range = %v, want one day", got)
	}

	other := h.Login("other@example.com")
	var acc struct {
		ID string `json:"id"`
	}
	h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Cash", "class": "asset", "kind": "cash", "currency": "BRL"}).Decode(t, &acc)
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/reports/flows?account_id="+acc.ID+"&from=2026-10-01&to=2026-10-02", nil),
		http.StatusNotFound, "not_found", "")
}
