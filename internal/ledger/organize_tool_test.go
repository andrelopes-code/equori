package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type manageOut struct {
	Action string `json:"action"`
	ID     string `json:"id"`
	Name   string `json:"name"`
}

// otherUserAccount creates an account owned by a second user.
func otherUserAccount(t *testing.T, h *apitest.Harness, name, class, kind string) string {
	t.Helper()
	other := h.Login("other@example.com")
	var a struct {
		ID string `json:"id"`
	}
	body := map[string]any{"name": name, "class": class, "currency": "BRL"}
	if kind != "" {
		body["kind"] = kind
	}
	h.Call(other, http.MethodPost, "/api/v1/accounts", body).Decode(t, &a)
	return a.ID
}

func TestManageAccountsCreateCategory(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	args := map[string]any{"action": "create_account", "name": "Pets", "class": "expense", "parent_id": f.food}
	p := previewTool(t, f.h, "manage_accounts_and_payees", args)
	if p.Destructive || p.Target != "Pets" || len(p.Changes) != 4 || p.Changes[0].After.Text != "Pets" || p.Changes[3].Field != "parent" || p.Changes[3].After.Text != "Food" {
		t.Fatalf("preview = %+v", p)
	}
	var out manageOut
	toolOutput(t, f.h, "manage_accounts_and_payees", args, &out)
	var a struct {
		Name     string `json:"name"`
		Class    string `json:"class"`
		ParentID string `json:"parent_id"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+out.ID, nil, http.StatusOK, &a)
	if a.Name != "Pets" || a.Class != "expense" || a.ParentID != f.food {
		t.Errorf("account = %+v", a)
	}
}

func TestManageAccountsInvalidArguments(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	f.h.ExpectToolError(f.h.Tool("manage_accounts_and_payees", map[string]any{"action": "create_account", "name": "X"}), "invalid_arguments", "class")
	f.h.ExpectToolError(f.h.Tool("manage_accounts_and_payees", map[string]any{"action": "create_account", "name": "X", "class": "asset"}), "invalid_arguments", "kind")
	f.h.ExpectToolError(f.h.Tool("manage_accounts_and_payees", map[string]any{"action": "create_payee", "name": "X", "into_id": f.food}), "invalid_arguments", "into_id")
	f.h.ExpectToolError(f.h.Tool("manage_accounts_and_payees", map[string]any{"action": "close_account", "account_id": "nope"}), "invalid_arguments", "account_id")
}

func TestManageAccountsUpdateCloseReopen(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	var out manageOut
	toolOutput(t, f.h, "manage_accounts_and_payees", map[string]any{"action": "update_account", "account_id": f.wallet, "name": "Pocket"}, &out)
	if out.Name != "Pocket" {
		t.Fatalf("out = %+v", out)
	}
	p := previewTool(t, f.h, "manage_accounts_and_payees", map[string]any{"action": "close_account", "account_id": f.wallet})
	if p.Changes[0].Before.Text != "active" || p.Changes[0].After.Text != "closed" || p.Changes[1].After.Date != "2026-10-23" {
		t.Fatalf("preview = %+v", p)
	}
	toolOutput(t, f.h, "manage_accounts_and_payees", map[string]any{"action": "close_account", "account_id": f.wallet}, &out)
	var a struct {
		ClosedOn string `json:"closed_on"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+f.wallet, nil, http.StatusOK, &a)
	if a.ClosedOn != "2026-10-23" {
		t.Errorf("closed_on = %q", a.ClosedOn)
	}
	toolOutput(t, f.h, "manage_accounts_and_payees", map[string]any{"action": "reopen_account", "account_id": f.wallet}, &out)
	a.ClosedOn = ""
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+f.wallet, nil, http.StatusOK, &a)
	if a.ClosedOn != "" {
		t.Errorf("closed_on = %q after reopen", a.ClosedOn)
	}
}

func TestManageAccountsCloseWithBalance(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	f.h.Record("2026-10-20", apitest.Posting(f.wallet, 1000), apitest.Posting(f.openingBalances, -1000))
	f.h.ExpectToolError(f.h.Tool("manage_accounts_and_payees", map[string]any{"action": "close_account", "account_id": f.wallet}), "account_not_empty", "")
}

func TestManageAccountsMergeCategory(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	id := f.h.Record("2026-10-20", apitest.Posting(f.checking, -4590), apitest.Posting(f.restaurant, 4590))
	args := map[string]any{"action": "merge_category", "account_id": f.restaurant, "into_id": f.food}
	p := previewTool(t, f.h, "manage_accounts_and_payees", args)
	if !p.Destructive || p.Changes[0].Before.Text != "Restaurant" || p.Changes[0].After.Text != "Food" {
		t.Fatalf("preview = %+v", p)
	}
	if got := amountsByAccount(f.h.Transaction(id)); got[f.restaurant] != 4590 {
		t.Fatalf("before merge = %v", got)
	}
	var out manageOut
	toolOutput(t, f.h, "manage_accounts_and_payees", args, &out)
	if got := amountsByAccount(f.h.Transaction(id)); got[f.food] != 4590 || got[f.restaurant] != 0 {
		t.Errorf("after merge = %v", got)
	}
}

func TestManageAccountsPayees(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	var a, b, merged manageOut
	toolOutput(t, f.h, "manage_accounts_and_payees", map[string]any{"action": "create_payee", "name": "Padaria"}, &a)
	toolOutput(t, f.h, "manage_accounts_and_payees", map[string]any{"action": "create_payee", "name": "Mercado"}, &b)
	rename := map[string]any{"action": "rename_payee", "payee_id": a.ID, "name": "Padaria Central"}
	if p := previewTool(t, f.h, "manage_accounts_and_payees", rename); p.Changes[0].Before.Text != "Padaria" || p.Changes[0].After.Text != "Padaria Central" {
		t.Fatalf("preview = %+v", p)
	}
	toolOutput(t, f.h, "manage_accounts_and_payees", rename, &a)
	if a.Name != "Padaria Central" {
		t.Fatalf("renamed = %+v", a)
	}
	merge := map[string]any{"action": "merge_payee", "payee_id": a.ID, "into_id": b.ID}
	if p := previewTool(t, f.h, "manage_accounts_and_payees", merge); !p.Destructive || p.Changes[0].Before.Text != "Padaria Central" || p.Changes[0].After.Text != "Mercado" {
		t.Fatalf("preview = %+v", p)
	}
	toolOutput(t, f.h, "manage_accounts_and_payees", merge, &merged)
	if merged.ID != b.ID {
		t.Errorf("merged = %+v, want payee %s", merged, b.ID)
	}
	var inst manageOut
	toolOutput(t, f.h, "manage_accounts_and_payees", map[string]any{"action": "create_institution", "name": "Inter"}, &inst)
	if inst.Name != "Inter" || inst.ID == "" {
		t.Errorf("institution = %+v", inst)
	}
}

func TestManageAccountsOtherUser(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	foreign := otherUserAccount(t, f.h, "Foreign", "asset", "checking")
	for _, args := range []map[string]any{
		{"action": "update_account", "account_id": foreign, "name": "X"},
		{"action": "close_account", "account_id": foreign},
		{"action": "reopen_account", "account_id": foreign},
		{"action": "merge_category", "account_id": foreign, "into_id": f.food},
		{"action": "rename_payee", "payee_id": foreign, "name": "X"},
		{"action": "merge_payee", "payee_id": foreign, "into_id": foreign},
	} {
		f.h.ExpectToolError(f.h.Tool("manage_accounts_and_payees", args), "not_found", "")
	}
}
