package marketdata_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S626 and S627 (progressive rate design PR1 to PR4): a pre-fixed CDB of 6% a year that pays 12%
// after 31 days held is valued at the step each day reached, under the rule of its terms, and the
// terms return the steps they were given.
func TestRateStepsAccrue(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		apply string
		want  map[string]string
	}{
		{"retroactive", map[string]string{
			"2026-01-30": "1004.640317564163", "2026-02-03": "1010.298826697262",
		}},
		{"stepped", map[string]string{
			"2026-01-30": "1004.640317564163", "2026-02-03": "1005.433705882182",
		}},
	} {
		t.Run(tc.apply, func(t *testing.T) {
			t.Parallel()

			h := apitest.New(t, apitest.Today("2026-02-03"))
			defineFixedIncome(t, h, "CDBPROG")

			var terms struct {
				RateSteps []struct {
					AfterDays int `json:"after_days"`
					SpreadBP  int `json:"spread_bp"`
				} `json:"rate_steps"`
				RateStepsApply string `json:"rate_steps_apply"`
			}
			h.MustDo(http.MethodPut, "/api/v1/instruments/CDBPROG/terms", map[string]any{
				"issued_on":  "2026-01-01",
				"matures_on": "2030-01-01",
				"spread_bp":  600,
				"day_count":  "act365",
				"face_value": 100000,
				"rate_steps": []map[string]any{
					{"after_days": 31, "percent_of_index_bp": 0, "spread_bp": 1200},
				},
				"rate_steps_apply": tc.apply,
			}, http.StatusOK, &terms)

			if len(terms.RateSteps) != 1 || terms.RateSteps[0].AfterDays != 31 ||
				terms.RateSteps[0].SpreadBP != 1200 || terms.RateStepsApply != tc.apply {
				t.Fatalf("terms = %+v", terms)
			}

			h.App.Marketdata.TickFeeds(t.Context())

			got := pricesBetween(t, h, "CDBPROG", "2026-01-01", "2026-02-28")
			for d, v := range tc.want {
				if got[d].Value != v {
					t.Errorf("price on %s = %+v, want %s", d, got[d], v)
				}
			}
		})
	}
}

// PR1: steps out of order, or without their rule, are refused; the table refuses a rule without
// steps.
func TestRateStepsRefused(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-02-03"))
	defineFixedIncome(t, h, "CDBPROG")

	base := map[string]any{
		"issued_on": "2026-01-01", "matures_on": "2030-01-01", "spread_bp": 600,
		"day_count": "act365", "face_value": 100000,
	}
	for _, extra := range []map[string]any{
		{"rate_steps": []map[string]any{{"after_days": 31, "percent_of_index_bp": 0, "spread_bp": 1200}}},
		{"rate_steps_apply": "stepped"},
	} {
		body := map[string]any{}
		for k, v := range base {
			body[k] = v
		}

		for k, v := range extra {
			body[k] = v
		}

		h.ExpectProblem(
			h.Do(http.MethodPut, "/api/v1/instruments/CDBPROG/terms", body),
			http.StatusUnprocessableEntity,
			"validation_failed",
			"",
		)
	}

	h.MustDo(http.MethodPut, "/api/v1/instruments/CDBPROG/terms", base, http.StatusOK, nil)

	if _, err := h.Pool.Exec(
		t.Context(),
		`UPDATE marketdata_fixed_income_terms SET rate_steps_apply = 'stepped' WHERE instrument_code = 'CDBPROG'`,
	); err == nil {
		t.Error("a rule without steps: no error, want a check violation")
	}
}

// Coverage row F-05: set_rate_steps proposes and writes the steps of stored terms and keeps the
// other terms.
func TestSetRateStepsTool(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-02-03"))
	defineFixedIncome(t, h, "CDBPROG")
	h.MustDo(http.MethodPut, "/api/v1/instruments/CDBPROG/terms", map[string]any{
		"issued_on": "2026-01-01", "matures_on": "2030-01-01", "index_id": "cdi",
		"percent_of_index_bp": 10000, "day_count": "bus252", "face_value": 100000,
	}, http.StatusOK, nil)

	args := map[string]any{"code": "CDBPROG", "apply": "retroactive", "steps": []any{
		map[string]any{"after_days": 180, "percent_of_index_bp": 10500},
		map[string]any{"after_days": 365, "percent_of_index_bp": 11000},
	}}
	toolOutput(t, h, "set_rate_steps", args, &struct{}{})

	var terms struct {
		IndexID   string `json:"index_id"`
		RateSteps []struct {
			AfterDays        int `json:"after_days"`
			PercentOfIndexBP int `json:"percent_of_index_bp"`
		} `json:"rate_steps"`
		RateStepsApply string `json:"rate_steps_apply"`
	}
	h.MustDo(http.MethodGet, "/api/v1/instruments/CDBPROG/terms", nil, http.StatusOK, &terms)

	if terms.IndexID != "cdi" || len(terms.RateSteps) != 2 || terms.RateSteps[1].AfterDays != 365 ||
		terms.RateSteps[1].PercentOfIndexBP != 11000 || terms.RateStepsApply != "retroactive" {
		t.Errorf("terms = %+v", terms)
	}

	h.ExpectToolError(
		h.Tool("set_rate_steps", map[string]any{"code": "CDBPROG", "steps": []any{
			map[string]any{"after_days": 180, "percent_of_index_bp": 10500},
		}}),
		"validation_failed",
		"",
	)
}
