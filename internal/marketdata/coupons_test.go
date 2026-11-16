package marketdata_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestModuleCoupons(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-01-09"))
	defineFixedIncome(t, h, "CDBCUPOM2")
	h.MustDo(
		http.MethodPut,
		"/api/v1/instruments/CDBCUPOM2/terms",
		map[string]any{
			"issued_on":             "2026-01-05",
			"matures_on":            "2027-01-05",
			"spread_bp":             1200,
			"day_count":             "bus252",
			"calendar_id":           "weekend",
			"face_value":            100000,
			"interest_every_months": 12,
			"first_payment_on":      "2026-07-04",
		},
		http.StatusOK,
		nil,
	)

	got, err := h.App.Marketdata.Coupons(t.Context(), "CDBCUPOM2")
	if err != nil {
		t.Fatal(err)
	}

	want := []string{"2026-07-06", "2027-01-05"}
	if len(got) != len(want) {
		t.Fatalf("Coupons = %+v, want %d coupons", got, len(want))
	}

	for i, d := range want {
		if got[i].Date.Format(time.DateOnly) != d {
			t.Errorf("coupon %d on %s, want %s", i, got[i].Date.Format(time.DateOnly), d)
		}
	}

	if got[0].PaysOn.Format(time.DateOnly) != "2026-07-04" {
		t.Errorf("PaysOn = %s, want 2026-07-04", got[0].PaysOn.Format(time.DateOnly))
	}
}
