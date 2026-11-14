package portfolio_test

import (
	"net/http"
	"testing"
)

type bonusEventOut struct {
	Instrument   string         `json:"instrument"`
	IncomeType   string         `json:"income_type"`
	TaxTreatment string         `json:"tax_treatment"`
	Gross        map[string]any `json:"gross"`
	Withheld     map[string]any `json:"withheld"`
	Date         string         `json:"date"`
}

func TestS433BonusIsExemptIncome(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.petr4Trade(t, "buy", "2026-11-01", 100, "10.00")
	f.bonus(t, map[string]any{"unit_cost": "5.00", "category_id": f.dividends})

	es := f.bonusEvents(t)
	if len(es) != 1 {
		t.Fatalf("events = %+v", es)
	}

	e := es[0]
	if e.Instrument != "PETR4" || e.IncomeType != "bonus_shares" || e.TaxTreatment != "exempt" ||
		e.Gross["amount"] != float64(5000) || e.Withheld["amount"] != float64(0) ||
		e.Date != "2026-11-10" {
		t.Fatalf("event = %+v", e)
	}
}

func TestBonusWithoutCostIsNotIncome(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.petr4Trade(t, "buy", "2026-11-01", 100, "10.00")
	f.bonus(t, nil)

	if es := f.bonusEvents(t); len(es) != 0 {
		t.Fatalf("events = %+v", es)
	}
}

func (f fixture) bonus(t *testing.T, extra map[string]any) {
	t.Helper()

	body := map[string]any{
		"account_id": f.petr4,
		"kind":       "bonus",
		"date":       "2026-11-10",
		"ratio_from": 10,
		"ratio_to":   11,
	}
	for k, v := range extra {
		body[k] = v
	}

	f.h.MustDo(http.MethodPost, "/api/v1/corporate-actions", body, http.StatusCreated, nil)
}

func (f fixture) bonusEvents(t *testing.T) []bonusEventOut {
	t.Helper()
	f.h.Dispatch()

	var out struct {
		Items []bonusEventOut `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/income-events?year=2026", nil, http.StatusOK, &out)

	return out.Items
}
