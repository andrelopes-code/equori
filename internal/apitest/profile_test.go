package apitest_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestProfiles(t *testing.T) {
	want := map[string][4]string{
		"brazil":       {"pt", "BR", "BRL", "BRL"},
		"neutral":      {"en", "NZ", "NZD", "NZD"},
		"foreign_base": {"pt", "BR", "USD", "USD"},
	}

	for _, p := range apitest.Profiles() {
		t.Run(p.Name, func(t *testing.T) {
			t.Parallel()

			exp, ok := want[p.Name]
			if !ok {
				t.Fatalf("unexpected profile %q", p.Name)
			}

			h := apitest.New(t, apitest.As(p))

			var me struct {
				Language string `json:"language"`
				Region   string `json:"region"`
			}
			h.MustDo(http.MethodGet, "/api/v1/me", nil, http.StatusOK, &me)

			var settings struct {
				BaseCurrency string `json:"base_currency"`
			}
			h.MustDo(http.MethodGet, "/api/v1/settings", nil, http.StatusOK, &settings)

			id := h.Account("Bank", "asset", "checking", nil)

			var account struct {
				Currency string `json:"currency"`
			}
			h.MustDo(http.MethodGet, "/api/v1/accounts/"+id, nil, http.StatusOK, &account)

			got := [4]string{me.Language, me.Region, settings.BaseCurrency, account.Currency}
			if got != exp {
				t.Errorf("language, region, base_currency, account currency = %v, want %v", got, exp)
			}
		})
	}
}

func TestOFXIn(t *testing.T) {
	if got := string(apitest.OFXIn("NZD", "")); !strings.Contains(got, "<CURDEF>NZD") {
		t.Errorf("OFXIn(NZD) = %q, want <CURDEF>NZD", got)
	}

	if got := string(apitest.OFX("")); !strings.Contains(got, "<CURDEF>BRL") {
		t.Errorf("OFX() = %q, want <CURDEF>BRL", got)
	}
}
