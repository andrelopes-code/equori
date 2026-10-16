package ingestion_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// BenchmarkImport measures N07: an OFX file of 1,000 lines into an account with 200 manual
// transactions; every line is deduplicated and then matched or created. Categorization
// joins the measurement with phase P5.
func BenchmarkImport(b *testing.B) {
	h := apitest.New(b, apitest.Today("2026-12-31"))
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	for i := range 200 {
		date := fmt.Sprintf("2026-10-%02d", 1+i%28)
		h.Record(date, apitest.Posting(checking, -int64(1000+i)), apitest.Posting(food, int64(1000+i)))
	}
	run := 0
	for b.Loop() {
		run++
		lines := make([]ofxLine, 1000)
		for i := range lines {
			lines[i] = ofxLine{fmt.Sprintf("202610%02d", 1+i%28), fmt.Sprintf("-%d.%02d", (1000+i)/100, (1000+i)%100), fmt.Sprintf("r%d-%d", run, i), "Compra"}
		}
		if r := importFile(h, checking, "ofx", "bench.ofx", ofxFile("", lines...)); r.Status != http.StatusCreated {
			b.Fatalf("import status %d: %s", r.Status, r.Body)
		}
	}
}
