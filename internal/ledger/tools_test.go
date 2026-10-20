package ledger_test

import (
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type toolAccount struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Class      string `json:"class"`
	Kind       string `json:"kind"`
	Currency   string `json:"currency"`
	ParentID   string `json:"parent_id"`
	ParentName string `json:"parent_name"`
	SystemRole string `json:"system_role"`
	Closed     bool   `json:"closed"`
}

// toolOutput calls a tool, fails on a tool error and decodes the output into out.
func toolOutput(t *testing.T, h *apitest.Harness, name string, args any, out any) {
	t.Helper()
	r := h.Tool(name, args)
	if r.IsError {
		t.Fatalf("%s(%v) = error %s", name, args, r.Content)
	}
	if err := json.Unmarshal(r.Content, out); err != nil {
		t.Fatal(err)
	}
}

func listAccountsTool(t *testing.T, h *apitest.Harness, args any) []toolAccount {
	t.Helper()
	var out struct {
		Accounts []toolAccount `json:"accounts"`
	}
	toolOutput(t, h, "list_accounts", args, &out)
	return out.Accounts
}

// openAccountIDs returns the IDs of the accounts of class that GET /accounts lists, the
// oracle of list_accounts; closed accounts are kept when includeClosed.
func openAccountIDs(t *testing.T, h *apitest.Harness, class string, includeClosed bool) []string {
	t.Helper()
	var page struct {
		Items []struct {
			ID       string `json:"id"`
			Class    string `json:"class"`
			ClosedOn string `json:"closed_on"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &page)
	var ids []string
	for _, a := range page.Items {
		if a.Class == class && (includeClosed || a.ClosedOn == "") {
			ids = append(ids, a.ID)
		}
	}
	slices.Sort(ids)
	return ids
}

func accountIDs(as []toolAccount) []string {
	ids := make([]string, len(as))
	for i, a := range as {
		ids[i] = a.ID
	}
	slices.Sort(ids)
	return ids
}

func TestListAccountsTool(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-10-20"))
	h.Account("Checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	groceries := h.Account("Groceries", "expense", "", map[string]any{"parent_id": food})
	old := h.Account("Old", "asset", "checking", nil)
	h.MustDo(http.MethodPost, "/api/v1/accounts/"+old+"/close", map[string]string{"closed_on": "2026-10-20"}, http.StatusOK, nil)

	expense := listAccountsTool(t, h, map[string]any{"class": "expense"})
	if got, want := accountIDs(expense), openAccountIDs(t, h, "expense", false); !slices.Equal(got, want) {
		t.Fatalf("expense ids = %v, want %v", got, want)
	}
	if !slices.IsSortedFunc(expense, func(a, b toolAccount) int {
		return strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
	}) {
		t.Errorf("expense accounts are not sorted by name: %+v", expense)
	}
	for _, a := range expense {
		switch a.ID {
		case food:
			if a != (toolAccount{ID: food, Name: "Food", Class: "expense", Currency: "BRL"}) {
				t.Errorf("Food = %+v", a)
			}
		case groceries:
			if a != (toolAccount{ID: groceries, Name: "Groceries", Class: "expense", Currency: "BRL", ParentID: food, ParentName: "Food"}) {
				t.Errorf("Groceries = %+v", a)
			}
		default:
			if a.SystemRole == "" {
				t.Errorf("unexpected account %+v", a)
			}
		}
	}

	assets := listAccountsTool(t, h, map[string]any{"class": "asset"})
	if got, want := accountIDs(assets), openAccountIDs(t, h, "asset", false); !slices.Equal(got, want) || slices.Contains(got, old) {
		t.Errorf("asset ids = %v, want %v without %s", got, want, old)
	}
	withClosed := listAccountsTool(t, h, map[string]any{"class": "asset", "include_closed": true})
	if got, want := accountIDs(withClosed), openAccountIDs(t, h, "asset", true); !slices.Equal(got, want) || !slices.Contains(got, old) {
		t.Errorf("asset ids with closed = %v, want %v", got, want)
	}
	for _, a := range withClosed {
		if a.ID == old && (a.Name != "Old" || !a.Closed || a.Kind != "checking") {
			t.Errorf("Old = %+v", a)
		}
	}

	h.ExpectToolError(h.Tool("list_accounts", map[string]any{"class": "cash"}), "invalid_arguments", "")
}

type toolBalance struct {
	AccountID   string     `json:"account_id"`
	AccountName string     `json:"account_name"`
	Class       string     `json:"class"`
	Balance     tool.Money `json:"balance"`
}

func TestGetBalancesTool(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-10-20"))
	checking := h.Account("Checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-01", apitest.Posting(checking, -1000), apitest.Posting(food, 1000))

	type output struct {
		Date     string        `json:"date"`
		Basis    string        `json:"basis"`
		Balances []toolBalance `json:"balances"`
	}
	var got output
	toolOutput(t, h, "get_balances", map[string]any{}, &got)
	want := output{Date: "2026-10-20", Basis: "booked", Balances: []toolBalance{
		{AccountID: checking, AccountName: "Checking", Class: "asset", Balance: tool.Money{Amount: "-10.00", Currency: "BRL"}},
	}}
	if !slices.Equal(got.Balances, want.Balances) || got.Date != want.Date || got.Basis != want.Basis {
		t.Errorf("get_balances = %+v, want %+v", got, want)
	}

	var before output
	toolOutput(t, h, "get_balances", map[string]any{"date": "2026-09-30", "basis": "settled"}, &before)
	if before.Date != "2026-09-30" || before.Basis != "settled" || before.Balances == nil || len(before.Balances) != 0 {
		t.Errorf("get_balances before = %+v", before)
	}

	h.ExpectToolError(h.Tool("get_balances", map[string]any{"basis": "cleared"}), "invalid_arguments", "")
	h.ExpectToolError(h.Tool("get_balances", map[string]any{"class": "expense"}), "invalid_arguments", "")
}
