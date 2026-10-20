package marketdata_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestHolidaysAPI(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	var out struct {
		Items []struct {
			Date   string `json:"date"`
			Name   string `json:"name"`
			Source string `json:"source"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/calendars/br_banking/holidays?year=2026", nil, http.StatusOK, &out)
	if len(out.Items) != 13 || out.Items[1].Date != "2026-02-16" || out.Items[1].Source != "rule" {
		t.Fatalf("holidays = %+v", out.Items)
	}
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/calendars/mars/holidays?year=2026", nil), http.StatusNotFound, "not_found", "")
}
