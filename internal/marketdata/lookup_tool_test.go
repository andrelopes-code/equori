package marketdata_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// TestProbeQuoteToolS366 probes the security of S366 through the tool: one source answers and
// nothing is stored.
func TestProbeQuoteToolS366(t *testing.T) {
	t.Parallel()
	h := probeHarness(t, []string{"yahoo_chart"}, 0)

	var got struct {
		Quotes []struct {
			Source string `json:"source"`
			Date   string `json:"date"`
			Value  string `json:"value"`
			Error  string `json:"error"`
		} `json:"quotes"`
		Available []string `json:"available"`
	}
	toolOutput(t, h, "probe_quote", probeBody(nil), &got)

	if len(got.Quotes) != 1 || got.Quotes[0].Source != "yahoo_chart" ||
		got.Quotes[0].Date != "2026-11-06" || got.Quotes[0].Value != "132.25" ||
		got.Quotes[0].Error != "" || len(got.Available) != 0 {
		t.Fatalf("probe = %+v", got)
	}

	if rows := h.Rows(
		"SELECT count(*) FROM marketdata_price WHERE instrument = 'VWCE'",
	); rows[0] != "0" {
		t.Fatalf("stored prices = %v, want 0", rows)
	}

	h.ExpectToolError(
		h.Tool("probe_quote", probeBody(map[string]any{"type": "currency"})),
		"validation_failed",
		"type",
	)
}

// TestInstitutionIndicatorsTool reads the figures of S495 and the floors of S496.
func TestInstitutionIndicatorsTool(t *testing.T) {
	t.Parallel()
	h, _ := ifdataHarness(t, "2026-11-16")
	enableIFData(t, h, true)

	var got struct {
		Source           string `json:"source"`
		ConglomerateName string `json:"conglomerate_name"`
		Rule             string `json:"rule"`
		BaselMinimum     string `json:"basel_minimum"`
		Periods          []struct {
			Period string `json:"period"`
			Basel  string `json:"basel"`
			Equity struct {
				Amount string `json:"amount"`
			} `json:"equity"`
		} `json:"periods"`
	}
	toolOutput(t, h, "get_institution_indicators", map[string]any{
		"scheme": "br_ispb", "identifier": "18236120",
	}, &got)

	if got.Source != "br_ifdata" || got.ConglomerateName != "NU PAGAMENTOS - PRUDENCIAL" ||
		got.Rule != "Resolução CMN 4.958/2021" || got.BaselMinimum != "0.08" {
		t.Fatalf("header = %+v", got)
	}

	if len(got.Periods) != 2 || got.Periods[0].Period != "2026-06-30" ||
		got.Periods[0].Basel != "0.1550912564" ||
		got.Periods[0].Equity.Amount != "23344610717.36" || got.Periods[1].Basel != "" {
		t.Fatalf("periods = %+v", got.Periods)
	}
}

// TestRecordPriceSeriesToolS370 records the series of S370 through the tool; the preview counts
// what it changes and stores nothing.
func TestRecordPriceSeriesToolS370(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-09"))
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	seed := "instrument,quote_instrument,date,value\nMXRF11,BRL,2026-11-02,9.00\nMXRF11,BRL,2026-11-03,9.02\n"
	if r := h.Upload("/api/v1/prices/import", "p.csv", []byte(seed)); r.Status != http.StatusOK {
		t.Fatalf("seed status = %d: %s", r.Status, r.Body)
	}

	args := instrumentSeries(map[string]any{"code": "MXRF11"})

	var got priceCountsAPI
	toolOutput(t, h, "record_price_series", args, &got)

	if got != (priceCountsAPI{New: 3, Replaced: 1, Unchanged: 1}) {
		t.Fatalf("counts = %+v", got)
	}

	if rows := h.Rows(
		"SELECT count(*) FROM marketdata_price WHERE instrument = 'MXRF11' AND source = 'csv'",
	); rows[0] != "5" {
		t.Fatalf("csv prices = %v, want 5", rows)
	}

	h.ExpectToolError(
		h.Tool("record_price_series", map[string]any{
			"code": "NOPE", "quote_instrument": "BRL",
			"prices": []any{map[string]any{"date": "2026-11-02", "value": "1"}},
		}),
		"not_found",
		"",
	)
}
