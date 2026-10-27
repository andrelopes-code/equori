package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// Analytics design 4.3: an account can be left out of the liquidity indicator.
func TestAccountExcludedFromLiquidity(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	cdb := h.Account("Locked CDB", "asset", "savings", nil)
	type view struct {
		Excluded *bool `json:"excluded_from_liquidity"`
	}
	var got view
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+cdb, nil, http.StatusOK, &got)
	if got.Excluded == nil || *got.Excluded {
		t.Fatalf("new account excluded_from_liquidity = %v, want false", got.Excluded)
	}
	h.MustDo(http.MethodPatch, "/api/v1/accounts/"+cdb, map[string]any{"excluded_from_liquidity": true}, http.StatusOK, &got)
	if got.Excluded == nil || !*got.Excluded {
		t.Fatalf("patched excluded_from_liquidity = %v, want true", got.Excluded)
	}
	got = view{}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+cdb, nil, http.StatusOK, &got)
	if got.Excluded == nil || !*got.Excluded {
		t.Fatalf("read back excluded_from_liquidity = %v, want true", got.Excluded)
	}
	h.MustDo(http.MethodPatch, "/api/v1/accounts/"+cdb, map[string]any{"name": "CDB"}, http.StatusOK, &got)
	if !*got.Excluded {
		t.Fatal("a patch without the field reset excluded_from_liquidity")
	}
}
