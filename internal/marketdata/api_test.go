package marketdata_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
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

func TestCalendarListDefault(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	for _, tc := range []struct{ email, region, want string }{
		{"br@example.com", "BR", "br_banking"},
		{"de@example.com", "DE", "weekend"},
	} {
		c := h.LoginAs(tc.email, locale.Locale{Language: "en", Region: tc.region}, "EUR")
		r := h.Call(c, http.MethodGet, "/api/v1/calendars", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("%s: status = %d, body %s", tc.region, r.Status, r.Body)
		}
		var out struct {
			Default string `json:"default"`
		}
		r.Decode(t, &out)
		if out.Default != tc.want {
			t.Errorf("%s: default = %q, want %q", tc.region, out.Default, tc.want)
		}
	}
}
