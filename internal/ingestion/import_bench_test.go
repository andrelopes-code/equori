package ingestion_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// BenchmarkImport measures N07: an OFX file of 1,000 lines into an account with 200 manual
// transactions, 100 rules (10 of them regex) and 50 payee aliases; every line is
// deduplicated, then matched or categorized and created.
func BenchmarkImport(b *testing.B) {
	h := apitest.New(b, apitest.Today("2026-12-31"))
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	for i := range 200 {
		date := fmt.Sprintf("2026-10-%02d", 1+i%28)
		h.Record(date, apitest.Posting(checking, -int64(1000+i)), apitest.Posting(food, int64(1000+i)))
	}
	for i := range 100 {
		condition := map[string]any{"field": "description", "operator": "contains", "value": fmt.Sprintf("loja %d ", i)}
		if i < 10 {
			condition = map[string]any{"field": "description", "operator": "regex", "value": fmt.Sprintf(`^MERCADO %d\d*$`, i)}
		}
		h.MustDo(http.MethodPost, "/api/v1/rules", map[string]any{"name": fmt.Sprintf("rule %d", i), "conditions": []any{condition},
			"actions": []any{map[string]any{"type": "set_category", "category_id": food}}}, http.StatusCreated, nil)
	}
	for i := range 50 {
		var payee struct {
			ID string `json:"id"`
		}
		h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": fmt.Sprintf("Payee %d", i)}, http.StatusCreated, &payee)
		h.MustDo(http.MethodPost, "/api/v1/payee-aliases", map[string]any{"pattern": fmt.Sprintf("padaria %d", i), "match_type": "starts_with", "payee_id": payee.ID}, http.StatusCreated, nil)
	}
	names := []string{"LOJA %d CENTRO", "MERCADO %d", "PADARIA %d", "COMPRA %d"}
	run := 0
	for b.Loop() {
		run++
		lines := make([]apitest.OFXLine, 1000)
		for i := range lines {
			lines[i] = apitest.OFXLine{Date: fmt.Sprintf("202610%02d", 1+i%28), Amount: fmt.Sprintf("-%d.%02d", (1000+i)/100, (1000+i)%100), FITID: fmt.Sprintf("r%d-%d", run, i), Name: fmt.Sprintf(names[i%len(names)], i%120)}
		}
		if r := h.Import(checking, "ofx", "bench.ofx", apitest.OFX("", lines...)); r.Status != http.StatusCreated {
			b.Fatalf("import status %d: %s", r.Status, r.Body)
		}
	}
}
