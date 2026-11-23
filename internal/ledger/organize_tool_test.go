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

// otherUserAccount creates an account owned by a second book.
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
	args := map[string]any{
		"action":    "create_account",
		"name":      "Pets",
		"class":     "expense",
		"parent_id": f.food,
	}

	p := previewTool(t, f.h, "manage_accounts_and_payees", args)
	if p.Action != "manage_accounts_and_payees.create_account" {
		t.Fatalf("action = %q", p.Action)
	}

	if p.Destructive || p.Target != "Pets" || len(p.Changes) != 4 ||
		p.Changes[0].After.Text != "Pets" ||
		p.Changes[3].Field != "parent" ||
		p.Changes[3].After.Text != "Food" {
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

func TestManageAccountsCreatedCategoryAcceptsEarlierTransactions(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	id := f.h.Record(
		"2026-10-20",
		apitest.Posting(f.checking, -4590),
		apitest.Posting(f.restaurant, 4590),
	)

	var out manageOut
	toolOutput(
		t,
		f.h,
		"manage_accounts_and_payees",
		map[string]any{"action": "create_account", "name": "Pets", "class": "expense"},
		&out,
	)

	res := categorize(f.h, id, 1, part(out.ID, 4590))
	if res.Status != http.StatusOK {
		t.Fatalf("categorize into the new category = %d %s", res.Status, res.Body)
	}
}

func TestManageAccountsInvalidArguments(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	f.h.ExpectToolError(
		f.h.Tool(
			"manage_accounts_and_payees",
			map[string]any{"action": "create_account", "name": "X"},
		),
		"invalid_arguments",
		"class",
	)
	f.h.ExpectToolError(
		f.h.Tool(
			"manage_accounts_and_payees",
			map[string]any{"action": "create_account", "name": "X", "class": "asset"},
		),
		"invalid_arguments",
		"kind",
	)
	f.h.ExpectToolError(
		f.h.Tool(
			"manage_accounts_and_payees",
			map[string]any{"action": "create_payee", "name": "X", "into_id": f.food},
		),
		"invalid_arguments",
		"into_id",
	)
	f.h.ExpectToolError(
		f.h.Tool(
			"manage_accounts_and_payees",
			map[string]any{"action": "close_account", "account_id": "nope"},
		),
		"invalid_arguments",
		"account_id",
	)
}

func TestManageAccountsUpdateCloseReopen(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	var out manageOut
	toolOutput(
		t,
		f.h,
		"manage_accounts_and_payees",
		map[string]any{"action": "update_account", "account_id": f.wallet, "name": "Pocket"},
		&out,
	)

	if out.Name != "Pocket" {
		t.Fatalf("out = %+v", out)
	}

	p := previewTool(
		t,
		f.h,
		"manage_accounts_and_payees",
		map[string]any{"action": "close_account", "account_id": f.wallet},
	)
	if p.Changes[0].Before.Text != "active" || p.Changes[0].After.Text != "closed" ||
		p.Changes[1].After.Date != "2026-10-23" {
		t.Fatalf("preview = %+v", p)
	}

	toolOutput(
		t,
		f.h,
		"manage_accounts_and_payees",
		map[string]any{"action": "close_account", "account_id": f.wallet},
		&out,
	)
	var a struct {
		ClosedOn string `json:"closed_on"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+f.wallet, nil, http.StatusOK, &a)

	if a.ClosedOn != "2026-10-23" {
		t.Errorf("closed_on = %q", a.ClosedOn)
	}

	toolOutput(
		t,
		f.h,
		"manage_accounts_and_payees",
		map[string]any{"action": "reopen_account", "account_id": f.wallet},
		&out,
	)

	a.ClosedOn = ""
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+f.wallet, nil, http.StatusOK, &a)

	if a.ClosedOn != "" {
		t.Errorf("closed_on = %q after reopen", a.ClosedOn)
	}
}

func TestManageAccountsCloseWithBalance(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	f.h.Record(
		"2026-10-20",
		apitest.Posting(f.wallet, 1000),
		apitest.Posting(f.openingBalances, -1000),
	)
	f.h.ExpectToolError(
		f.h.Tool(
			"manage_accounts_and_payees",
			map[string]any{"action": "close_account", "account_id": f.wallet},
		),
		"account_not_empty",
		"",
	)
}

func TestManageAccountsMergeCategory(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	id := f.h.Record(
		"2026-10-20",
		apitest.Posting(f.checking, -4590),
		apitest.Posting(f.restaurant, 4590),
	)
	args := map[string]any{
		"action":     "merge_category",
		"account_id": f.restaurant,
		"into_id":    f.food,
	}

	p := previewTool(t, f.h, "manage_accounts_and_payees", args)
	if !p.Destructive || p.Changes[0].Before.Text != "Restaurant" ||
		p.Changes[0].After.Text != "Food" {
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
	toolOutput(
		t,
		f.h,
		"manage_accounts_and_payees",
		map[string]any{"action": "create_payee", "name": "Padaria"},
		&a,
	)
	toolOutput(
		t,
		f.h,
		"manage_accounts_and_payees",
		map[string]any{"action": "create_payee", "name": "Mercado"},
		&b,
	)

	rename := map[string]any{"action": "rename_payee", "payee_id": a.ID, "name": "Padaria Central"}
	if p := previewTool(
		t,
		f.h,
		"manage_accounts_and_payees",
		rename,
	); p.Changes[0].Before.Text != "Padaria" ||
		p.Changes[0].After.Text != "Padaria Central" {
		t.Fatalf("preview = %+v", p)
	}

	toolOutput(t, f.h, "manage_accounts_and_payees", rename, &a)

	if a.Name != "Padaria Central" {
		t.Fatalf("renamed = %+v", a)
	}

	merge := map[string]any{"action": "merge_payee", "payee_id": a.ID, "into_id": b.ID}
	if p := previewTool(
		t,
		f.h,
		"manage_accounts_and_payees",
		merge,
	); !p.Destructive || p.Changes[0].Before.Text != "Padaria Central" ||
		p.Changes[0].After.Text != "Mercado" {
		t.Fatalf("preview = %+v", p)
	}

	toolOutput(t, f.h, "manage_accounts_and_payees", merge, &merged)

	if merged.ID != b.ID {
		t.Errorf("merged = %+v, want payee %s", merged, b.ID)
	}

	var inst manageOut
	toolOutput(
		t,
		f.h,
		"manage_accounts_and_payees",
		map[string]any{"action": "create_institution", "name": "Inter"},
		&inst,
	)

	if inst.Name != "Inter" || inst.ID == "" {
		t.Errorf("institution = %+v", inst)
	}
}

func TestManageAccountsTags(t *testing.T) {
	t.Parallel()
	s := newTaggedSetup(t)
	h := s.c.h

	rename := map[string]any{"action": "rename_tag", "tag": "trip", "name": "Lisbon"}
	if p := previewTool(
		t,
		h,
		"manage_accounts_and_payees",
		rename,
	); p.Changes[0].Before.Text != "trip" ||
		p.Changes[0].After.Text != "lisbon" {
		t.Fatalf("preview = %+v", p)
	}

	var out manageOut
	toolOutput(t, h, "manage_accounts_and_payees", rename, &out)

	if out.Name != "lisbon" {
		t.Fatalf("renamed = %+v", out)
	}

	merge := map[string]any{"action": "merge_tag", "tag": "lisbon", "into_tag": "travel"}
	if p := previewTool(
		t,
		h,
		"manage_accounts_and_payees",
		merge,
	); !p.Destructive || p.Changes[0].Before.Text != "lisbon" ||
		p.Changes[0].After.Text != "travel" {
		t.Fatalf("preview = %+v", p)
	}

	toolOutput(t, h, "manage_accounts_and_payees", merge, &out)

	if out.Name != "travel" {
		t.Fatalf("merged = %+v", out)
	}

	del := map[string]any{"action": "delete_tag", "tag": "travel"}
	if p := previewTool(
		t,
		h,
		"manage_accounts_and_payees",
		del,
	); !p.Destructive ||
		p.Target != "travel" {
		t.Fatalf("preview = %+v", p)
	}

	toolOutput(t, h, "manage_accounts_and_payees", del, &out)

	if names := tagNames(t, h); len(names) != 0 {
		t.Fatalf("tags = %v", names)
	}

	h.ExpectToolError(
		h.Tool(
			"manage_accounts_and_payees",
			map[string]any{"action": "delete_tag", "tag": "absent"},
		),
		"not_found",
		"",
	)
	h.ExpectToolError(
		h.Tool("manage_accounts_and_payees", map[string]any{"action": "delete_tag"}),
		"invalid_arguments",
		"tag",
	)
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

func TestManageAccountsOpeningYieldAndLiquidity(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	tl := "manage_accounts_and_payees"

	type accountView struct {
		OpenedOn              string `json:"opened_on"`
		YieldMode             string `json:"yield_mode"`
		ExcludedFromLiquidity bool   `json:"excluded_from_liquidity"`
	}

	var out manageOut
	toolOutput(t, f.h, tl, map[string]any{
		"action": "create_account", "name": "Reserve CDB", "class": "asset", "kind": "savings",
		"opened_on": "2026-01-15", "yield_mode": "auto",
	}, &out)

	var got accountView
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+out.ID, nil, http.StatusOK, &got)

	if got != (accountView{OpenedOn: "2026-01-15", YieldMode: "auto"}) {
		t.Fatalf("created = %+v", got)
	}

	update := map[string]any{
		"action": "update_account", "account_id": out.ID, "opened_on": "2025-12-01",
		"yield_mode": "none", "excluded_from_liquidity": true,
	}

	p := previewTool(t, f.h, tl, update)
	if len(p.Changes) != 3 || p.Changes[0].Field != "date" ||
		p.Changes[0].Before.Date != "2026-01-15" ||
		p.Changes[0].After.Date != "2025-12-01" ||
		p.Changes[1].After.Text != "yield none" ||
		p.Changes[2].After.Text != "excluded from liquidity" {
		t.Fatalf("preview = %+v", p)
	}

	toolOutput(t, f.h, tl, update, &manageOut{})
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+out.ID, nil, http.StatusOK, &got)

	if got != (accountView{OpenedOn: "2025-12-01", YieldMode: "none", ExcludedFromLiquidity: true}) {
		t.Fatalf("updated = %+v", got)
	}

	toolOutput(
		t,
		f.h,
		tl,
		map[string]any{
			"action":                  "update_account",
			"account_id":              out.ID,
			"excluded_from_liquidity": false,
		},
		&manageOut{},
	)
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+out.ID, nil, http.StatusOK, &got)

	if got.ExcludedFromLiquidity {
		t.Errorf("excluded_from_liquidity = true after false")
	}

	f.h.ExpectToolError(
		f.h.Tool(
			tl,
			map[string]any{
				"action":     "update_account",
				"account_id": out.ID,
				"opened_on":  "2026-06-01",
			},
		),
		"validation_failed",
		"opened_on",
	)
	f.h.ExpectToolError(
		f.h.Tool(
			tl,
			map[string]any{"action": "close_account", "account_id": out.ID, "yield_mode": "auto"},
		),
		"invalid_arguments",
		"yield_mode",
	)
	f.h.ExpectToolError(
		f.h.Tool(
			tl,
			map[string]any{
				"action":                  "create_account",
				"name":                    "X",
				"class":                   "expense",
				"excluded_from_liquidity": true,
			},
		),
		"invalid_arguments",
		"excluded_from_liquidity",
	)
}
