package reporting_test

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type historyOut struct {
	AccountID   string `json:"account_id"`
	AccountName string `json:"account_name"`
	Currency    string `json:"currency"`
	View        string `json:"view"`
	Granularity string `json:"granularity"`
	Points      []struct {
		Date    string     `json:"date"`
		Balance tool.Money `json:"balance"`
	} `json:"points"`
	Days []struct {
		Date    string     `json:"date"`
		Inflow  tool.Money `json:"inflow"`
		Outflow tool.Money `json:"outflow"`
	} `json:"days"`
}

func accountHistory(t *testing.T, h *apitest.Harness, args map[string]any) historyOut {
	t.Helper()
	r := h.Tool("get_account_history", args)
	if r.IsError {
		t.Fatalf("get_account_history = error %s", r.Content)
	}
	var out historyOut
	if err := json.Unmarshal(r.Content, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestAccountHistoryToolBalances(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-20"))
	checking := h.Account("Checking", "asset", "checking", nil)
	salary := h.Account("Salary", "income", "", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-03", apitest.Posting(checking, 100000), apitest.Posting(salary, -100000))
	h.Record("2026-10-06", apitest.Posting(checking, -2550), apitest.Posting(food, 2550))
	h.Dispatch()

	got := accountHistory(t, h, map[string]any{"account_id": checking, "view": "balances", "from": "2026-10-01", "to": "2026-10-10"})
	if got.AccountID != checking || got.AccountName != "Checking" || got.Currency != "BRL" || got.View != "balances" || got.Granularity != "day" {
		t.Errorf("header = %+v", got)
	}
	want := []string{"0.00", "0.00", "1000.00", "1000.00", "1000.00", "974.50", "974.50", "974.50", "974.50", "974.50"}
	var balances []string
	for i, p := range got.Points {
		balances = append(balances, p.Balance.Amount)
		if wantDate := "2026-10-" + []string{"01", "02", "03", "04", "05", "06", "07", "08", "09", "10"}[i]; p.Date != wantDate {
			t.Errorf("point %d date = %s, want %s", i, p.Date, wantDate)
		}
	}
	if !reflect.DeepEqual(balances, want) {
		t.Errorf("balances = %v, want %v", balances, want)
	}
	if got.Days != nil {
		t.Errorf("days = %+v, want none for balances", got.Days)
	}
}

func TestAccountHistoryToolWeekly(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-20"))
	checking := h.Account("Checking", "asset", "checking", nil)

	// 2026-01-01 to 2026-07-19 is 200 days; 2026-07-19 is a Sunday.
	got := accountHistory(t, h, map[string]any{"account_id": checking, "view": "balances", "from": "2026-01-01", "to": "2026-07-19"})
	if got.Granularity != "week" {
		t.Errorf("granularity = %q, want week", got.Granularity)
	}
	if n := len(got.Points); n != 29 {
		t.Errorf("points = %d, want 29 Sundays", n)
	}
	if first, last := got.Points[0].Date, got.Points[len(got.Points)-1].Date; first != "2026-01-04" || last != "2026-07-19" {
		t.Errorf("first, last = %s, %s; want 2026-01-04, 2026-07-19", first, last)
	}

	// 2026-07-20 is a Monday: the period's last day follows the last Sunday.
	got = accountHistory(t, h, map[string]any{"account_id": checking, "view": "balances", "from": "2026-01-01", "to": "2026-07-20"})
	if n, last := len(got.Points), got.Points[len(got.Points)-1].Date; n != 30 || last != "2026-07-20" {
		t.Errorf("points = %d ending %s; want 30 ending 2026-07-20", n, last)
	}
}

func TestAccountHistoryToolFlows(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-20"))
	checking := h.Account("Checking", "asset", "checking", nil)
	salary := h.Account("Salary", "income", "", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-03", apitest.Posting(checking, 100000), apitest.Posting(salary, -100000))
	h.Record("2026-10-06", apitest.Posting(checking, -2550), apitest.Posting(food, 2550))
	h.Dispatch()

	got := accountHistory(t, h, map[string]any{"account_id": checking, "view": "flows", "from": "2026-10-01", "to": "2026-10-31"})
	if got.View != "flows" || got.Granularity != "" || got.Points != nil || len(got.Days) != 2 {
		t.Fatalf("flows = %+v", got)
	}
	if d := got.Days[0]; d.Date != "2026-10-03" || d.Inflow.Amount != "1000.00" || d.Outflow.Amount != "0.00" {
		t.Errorf("day 0 = %+v", d)
	}
	if d := got.Days[1]; d.Date != "2026-10-06" || d.Inflow.Amount != "0.00" || d.Outflow.Amount != "25.50" {
		t.Errorf("day 1 = %+v", d)
	}
}

func TestAccountHistoryToolInvalid(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-20"))
	checking := h.Account("Checking", "asset", "checking", nil)
	h.ExpectToolError(h.Tool("get_account_history", map[string]any{"account_id": checking, "view": "flows", "from": "2026-01-01", "to": "2027-01-02"}), "invalid_arguments", "to")
	h.ExpectToolError(h.Tool("get_account_history", map[string]any{"account_id": checking, "view": "balances", "from": "2026-02-01", "to": "2026-01-31"}), "invalid_arguments", "to")
	h.ExpectToolError(h.Tool("get_account_history", map[string]any{"account_id": "x", "view": "balances", "from": "2026-01-01", "to": "2026-01-31"}), "invalid_arguments", "account_id")
}

func TestAccountHistoryToolOtherUser(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-20"))
	other := h.LoginAs("other@example.com", locale.Locale{Language: "pt", Region: "BR"}, "BRL")
	r := h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Theirs", "class": "asset", "kind": "checking", "currency": "BRL"})
	if r.Status != http.StatusCreated {
		t.Fatalf("create account status %d: %s", r.Status, r.Body)
	}
	var account struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(r.Body, &account); err != nil {
		t.Fatal(err)
	}
	for _, view := range []string{"balances", "flows"} {
		h.ExpectToolError(h.Tool("get_account_history", map[string]any{"account_id": account.ID, "view": view, "from": "2026-10-01", "to": "2026-10-10"}), "not_found", "")
	}
}
