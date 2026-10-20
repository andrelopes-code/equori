package ledger_test

import (
	"encoding/json"
	"maps"
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

// listAccountsTool reads every page of list_accounts with pages of limit accounts.
func listAccountsTool(t *testing.T, h *apitest.Harness, args map[string]any, limit int) []toolAccount {
	t.Helper()
	var all []toolAccount
	cursor := ""
	for {
		a := maps.Clone(args)
		a["limit"] = limit
		if cursor != "" {
			a["cursor"] = cursor
		}
		var out struct {
			Accounts   []toolAccount `json:"accounts"`
			NextCursor string        `json:"next_cursor"`
		}
		toolOutput(t, h, "list_accounts", a, &out)
		if len(out.Accounts) > limit || (out.NextCursor != "" && len(out.Accounts) != limit) {
			t.Fatalf("page of %d accounts with limit %d and next_cursor %q", len(out.Accounts), limit, out.NextCursor)
		}
		all = append(all, out.Accounts...)
		if cursor = out.NextCursor; cursor == "" {
			return all
		}
	}
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
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-20"))
	h.Account("Checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	groceries := h.Account("Groceries", "expense", "", map[string]any{"parent_id": food})
	old := h.Account("Old", "asset", "checking", nil)
	h.MustDo(http.MethodPost, "/api/v1/accounts/"+old+"/close", map[string]string{"closed_on": "2026-10-20"}, http.StatusOK, nil)

	expense := listAccountsTool(t, h, map[string]any{"class": "expense"}, 50)
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

	assets := listAccountsTool(t, h, map[string]any{"class": "asset"}, 50)
	if got, want := accountIDs(assets), openAccountIDs(t, h, "asset", false); !slices.Equal(got, want) || slices.Contains(got, old) {
		t.Errorf("asset ids = %v, want %v without %s", got, want, old)
	}
	withClosed := listAccountsTool(t, h, map[string]any{"class": "asset", "include_closed": true}, 50)
	if got, want := accountIDs(withClosed), openAccountIDs(t, h, "asset", true); !slices.Equal(got, want) || !slices.Contains(got, old) {
		t.Errorf("asset ids with closed = %v, want %v", got, want)
	}
	for _, a := range withClosed {
		if a.ID == old && (a.Name != "Old" || !a.Closed || a.Kind != "checking") {
			t.Errorf("Old = %+v", a)
		}
	}

	// Pages of one account cover the same accounts in the same order.
	if paged := listAccountsTool(t, h, map[string]any{"class": "expense"}, 1); !slices.Equal(paged, expense) {
		t.Errorf("pages of one = %+v, want %+v", paged, expense)
	}
	h.ExpectToolError(h.Tool("list_accounts", map[string]any{"class": "cash"}), "invalid_arguments", "")
	h.ExpectToolError(h.Tool("list_accounts", map[string]any{"limit": 51}), "invalid_arguments", "limit")
	h.ExpectToolError(h.Tool("list_accounts", map[string]any{"cursor": "bad"}), "invalid_arguments", "cursor")
}

type toolBalance struct {
	AccountID   string     `json:"account_id"`
	AccountName string     `json:"account_name"`
	Class       string     `json:"class"`
	Balance     tool.Money `json:"balance"`
}

func TestGetBalancesTool(t *testing.T) {
	t.Parallel()
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

	savings := h.Account("Savings", "asset", "savings", nil)
	h.Record("2026-10-02", apitest.Posting(checking, -300), apitest.Posting(savings, 300))
	var page1, page2 struct {
		Balances   []toolBalance `json:"balances"`
		NextCursor string        `json:"next_cursor"`
	}
	toolOutput(t, h, "get_balances", map[string]any{"limit": 1}, &page1)
	toolOutput(t, h, "get_balances", map[string]any{"limit": 1, "cursor": page1.NextCursor}, &page2)
	if len(page1.Balances) != 1 || page1.Balances[0].AccountName != "Checking" || page1.Balances[0].Balance.Amount != "-13.00" ||
		len(page2.Balances) != 1 || page2.Balances[0].AccountName != "Savings" || page2.NextCursor != "" {
		t.Errorf("pages = %+v, %+v", page1, page2)
	}

	var before output
	toolOutput(t, h, "get_balances", map[string]any{"date": "2026-09-30", "basis": "settled"}, &before)
	if before.Date != "2026-09-30" || before.Basis != "settled" || before.Balances == nil || len(before.Balances) != 0 {
		t.Errorf("get_balances before = %+v", before)
	}

	h.ExpectToolError(h.Tool("get_balances", map[string]any{"basis": "cleared"}), "invalid_arguments", "")
	h.ExpectToolError(h.Tool("get_balances", map[string]any{"class": "expense"}), "invalid_arguments", "")
}
