package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

func TestProvisioningUsesTheChosenCurrency(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	c := h.LoginAs("de@example.com", locale.Locale{Language: "en", Region: "DE"}, "EUR")
	var s struct {
		BaseCurrency string `json:"base_currency"`
	}
	r := h.Call(c, http.MethodGet, "/api/v1/settings", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status %d", r.Status)
	}
	r.Decode(t, &s)
	if s.BaseCurrency != "EUR" {
		t.Fatalf("base = %s", s.BaseCurrency)
	}
}
