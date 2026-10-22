package capture_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

// A user of region DE who writes English reads 12,50 as 12.50 (comma decimal, English words).
func TestPreviewReadsByTheProfileConventions(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-21"))
	c := h.LoginAs("de@example.com", locale.Locale{Language: "en", Region: "DE"}, "EUR")
	r := h.Call(c, http.MethodPost, "/api/v1/capture/preview", map[string]any{"text": "lunch 12,50"})
	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
	var out struct {
		Lines []lineView `json:"lines"`
	}
	r.Decode(t, &out)
	if len(out.Lines) != 1 || amount(out.Lines[0]) != 1250 {
		t.Fatalf("lines = %+v, want one line of 1250", out.Lines)
	}
}

func TestPreviewReadsDatesByTheProfileOrder(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-21"))
	c := h.LoginAs("us@example.com", locale.Locale{Language: "en", Region: "US"}, "USD")
	r := h.Call(c, http.MethodPost, "/api/v1/capture/preview", map[string]any{"text": "lunch 25.90 05/11"})
	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
	var out struct {
		Lines []lineView `json:"lines"`
	}
	r.Decode(t, &out)
	if len(out.Lines) != 1 || out.Lines[0].Date != "2026-05-11" || amount(out.Lines[0]) != 2590 {
		t.Fatalf("lines = %+v, want one line of 2590 on 2026-05-11", out.Lines)
	}
}
