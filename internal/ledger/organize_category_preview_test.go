package ledger_test

import (
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Assistant conversation design, section 7: a preview names a category as a category, whichever
// action of the tool changes it.
func TestManageAccountsPreviewNamesTheSubject(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))

	for _, c := range []struct {
		name         string
		args         map[string]any
		wantAction   string
		wantFirst    tool.Change
		wantCurrency string
	}{
		{
			name:       "rename a category",
			args:       map[string]any{"action": "update_account", "account_id": f.food, "name": "Meals"},
			wantAction: "update_category",
			wantFirst: tool.Change{
				Field:  "name",
				Before: tool.TextValue("Food"),
				After:  tool.TextValue("Meals"),
			},
		},
		{
			name:       "close a category",
			args:       map[string]any{"action": "close_account", "account_id": f.restaurant},
			wantAction: "close_category",
			wantFirst: tool.Change{
				Field:  "status",
				Before: tool.TextValue("active"),
				After:  tool.TextValue("archived"),
			},
		},
		{
			name: "create a category in another currency",
			args: map[string]any{
				"action": "create_account", "name": "Trips", "class": "expense", "currency": "USD",
			},
			wantAction:   "create_category",
			wantFirst:    tool.Change{Field: "name", After: tool.TextValue("Trips")},
			wantCurrency: "USD",
		},
		{
			name: "create an account",
			args: map[string]any{
				"action": "create_account", "name": "Till", "class": "asset", "kind": "cash",
			},
			wantAction:   "create_account",
			wantFirst:    tool.Change{Field: "name", After: tool.TextValue("Till")},
			wantCurrency: "BRL",
		},
		{
			name:       "rename an account",
			args:       map[string]any{"action": "update_account", "account_id": f.wallet, "name": "Pocket"},
			wantAction: "update_account",
			wantFirst: tool.Change{
				Field:  "name",
				Before: tool.TextValue("Wallet"),
				After:  tool.TextValue("Pocket"),
			},
		},
	} {
		p := previewTool(t, f.h, "manage_accounts_and_payees", c.args)

		if p.Action != "manage_accounts_and_payees."+c.wantAction {
			t.Errorf("%s: action = %q", c.name, p.Action)
		}

		if !reflect.DeepEqual(p.Changes[0], c.wantFirst) {
			t.Errorf("%s: first change = %+v, want %+v", c.name, p.Changes[0], c.wantFirst)
		}

		if got := afterText(p, "currency"); got != c.wantCurrency {
			t.Errorf("%s: currency = %q, want %q", c.name, got, c.wantCurrency)
		}
	}

	toolOutput(t, f.h, "manage_accounts_and_payees", map[string]any{
		"action": "close_account", "account_id": f.restaurant,
	}, &manageOut{})

	p := previewTool(t, f.h, "manage_accounts_and_payees", map[string]any{
		"action": "reopen_account", "account_id": f.restaurant,
	})

	want := []tool.Change{
		{Field: "status", Before: tool.TextValue("archived"), After: tool.TextValue("active")},
	}
	if p.Action != "manage_accounts_and_payees.reopen_category" ||
		!reflect.DeepEqual(p.Changes, want) {
		t.Errorf("reopen a category = %+v", p)
	}
}

func afterText(p tool.Preview, field string) string {
	for _, c := range p.Changes {
		if c.Field == field {
			return c.After.Text
		}
	}

	return ""
}
