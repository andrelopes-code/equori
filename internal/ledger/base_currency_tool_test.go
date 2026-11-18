package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

// TestSetBaseCurrencyTool changes the base currency of a book without transactions and is
// refused after the first one.
func TestSetBaseCurrencyTool(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	args := map[string]any{"base_currency": "USD"}

	p, r, err := h.App.Tools.Preview(
		h.WithIdentity("owner@example.com", auth.RoleOwner),
		"set_base_currency",
		[]byte(`{"base_currency":"USD"}`),
	)
	if err != nil || r.IsError {
		t.Fatalf("preview: %v %s", err, r.Content)
	}

	if p.Action != "set_base_currency" || p.Changes[0].Before.Text != "BRL" ||
		p.Changes[0].After.Text != "USD" {
		t.Fatalf("preview = %+v", p)
	}

	var out struct {
		BaseCurrency string `json:"base_currency"`
	}
	toolOutput(t, h, "set_base_currency", args, &out)

	var settings struct {
		BaseCurrency string `json:"base_currency"`
	}
	h.MustDo(http.MethodGet, "/api/v1/settings", nil, http.StatusOK, &settings)

	if out.BaseCurrency != "USD" || settings.BaseCurrency != "USD" {
		t.Fatalf("tool %q, settings %q, want USD", out.BaseCurrency, settings.BaseCurrency)
	}

	h.ExpectToolError(
		h.Tool("set_base_currency", map[string]any{"base_currency": "XXXX"}),
		"validation_failed",
		"base_currency",
	)
	h.JoinAs("writer@example.com", h.OwnerID(), "write")
	h.ExpectToolError(
		h.ToolAs("writer@example.com", auth.RoleWrite, "set_base_currency", args),
		"book_role_required",
		"",
	)

	toolOutput(t, h, "set_base_currency", map[string]any{"base_currency": "BRL"}, &out)

	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-14", apitest.Posting(checking, -100), apitest.Posting(food, 100))

	h.ExpectToolError(h.Tool("set_base_currency", args), "settings_locked", "")
}
