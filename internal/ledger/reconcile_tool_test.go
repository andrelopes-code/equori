package ledger_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type reconcileOut struct {
	Difference *struct {
		Amount string `json:"amount"`
	} `json:"difference"`
	Resolution string `json:"resolution"`
}

// TestReconcileAccountS26 follows S26: a derived balance of 3,203.27 against an assertion of 3,201.17.
func TestReconcileAccountS26(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	f.h.Record("2026-10-01", apitest.Posting(f.wallet, 320327), apitest.Posting(f.openingBalances, -320327))
	balance := map[string]any{"account_id": f.wallet, "action": "record_balance", "date": "2026-10-23", "amount": "3201.17"}
	if p := previewTool(t, f.h, "reconcile_account", balance); p.Target != "Wallet" || p.Changes[0].After.Amount != "3201.17" || p.Changes[1].After.Date != "2026-10-23" {
		t.Fatalf("preview = %+v", p)
	}
	var out reconcileOut
	toolOutput(t, f.h, "reconcile_account", balance, &out)
	if out.Difference == nil || out.Difference.Amount != "-2.10" || out.Resolution != "" {
		t.Fatalf("record_balance = %+v", out)
	}
	resolve := map[string]any{"account_id": f.wallet, "action": "resolve_difference", "resolution": "adjustment"}
	p := previewTool(t, f.h, "reconcile_account", resolve)
	if p.Basis == "" || p.Changes[0].After.Amount != "-2.10" {
		t.Fatalf("preview = %+v", p)
	}
	toolOutput(t, f.h, "reconcile_account", resolve, &out)
	if out.Resolution != "adjustment" {
		t.Fatalf("resolve = %+v", out)
	}
	f.h.ExpectToolError(f.h.Tool("reconcile_account", resolve), "invalid_arguments", "account_id")
	toolOutput(t, f.h, "reconcile_account", map[string]any{"account_id": f.wallet, "action": "unlock", "date": "2026-10-01"}, &out)
}

func TestReconcileAccountInvalidArguments(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	f.h.ExpectToolError(f.h.Tool("reconcile_account", map[string]any{"account_id": f.wallet, "action": "record_balance", "date": "2026-10-23"}), "invalid_arguments", "amount")
	f.h.ExpectToolError(f.h.Tool("reconcile_account", map[string]any{"account_id": f.wallet, "action": "unlock", "date": "2026-10-23", "amount": "1.00"}), "invalid_arguments", "amount")
}

func TestReconcileAccountOtherUser(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	foreign := otherUserAccount(t, f.h, "Foreign", "asset", "checking")
	f.h.ExpectToolError(f.h.Tool("reconcile_account", map[string]any{"account_id": foreign, "action": "record_balance", "date": "2026-10-23", "amount": "1.00"}), "not_found", "")
}
