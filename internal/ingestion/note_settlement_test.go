package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S702 (A272 NS2): the bank debits a note of two orders in one line; the line confirms the note's
// settlement and creates nothing.
func TestS702BankLineConfirmsTheNoteSettlement(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-05"))
	for _, code := range []string{"PETR4", "VALE3"} {
		h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
			"code":           code,
			"type":           "stock",
			"scale":          0,
			"name":           code,
			"quote_currency": "BRL",
			"exchange":       "BVMF",
		}, http.StatusCreated, nil)
	}

	var inst struct {
		ID string `json:"id"`
	}
	h.MustDo(
		http.MethodPost,
		"/api/v1/institutions",
		map[string]string{"name": "Inter"},
		http.StatusCreated,
		&inst,
	)
	at := map[string]any{"institution_id": inst.ID}
	brokerage := h.Account("Inter Investimentos", "asset", "brokerage", at)
	h.Account("Caixa", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
		"parent_id":      brokerage,
		"currency":       "BRL",
	})
	checking := h.Account("Banco Inter", "asset", "checking", at)
	order := func(code string, quantity int64, price string) map[string]any {
		return map[string]any{
			"side":       "buy",
			"instrument": code,
			"quantity":   map[string]any{"amount": quantity, "currency": code},
			"unit_price": price,
		}
	}
	h.MustDo(http.MethodPost, "/api/v1/brokerage-notes", map[string]any{
		"brokerage_id":    brokerage,
		"cash_account_id": checking,
		"date":            "2026-10-20",
		"fees":            apitest.BRL(251),
		"orders":          []any{order("PETR4", 100, "30.00"), order("VALE3", 50, "60.10")},
	}, http.StatusCreated, nil)
	before := transactionCount(t, h)

	file := apitest.OFX("", apitest.OFXLine{
		Date:   "20261022",
		Amount: "-6007.51",
		FITID:  "n1",
		Name:   "Débito B3 - Nota Bov 20/10/2026",
	})
	b := mustImport(t, h, checking, "ofx", "outubro.ofx", file)

	if got := counts(b); got != "received 1 ignored 0 matched 1 created 0 review 0" {
		t.Fatalf("import: %s", got)
	}

	if after := transactionCount(t, h); after != before {
		t.Fatalf("transactions = %d, want %d", after, before)
	}
}
