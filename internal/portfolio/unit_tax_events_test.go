package portfolio_test

import (
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const fundCode = "FUNDUT"

// A236 FC26: S534 to S537.
func TestS534UnitTaxDatesOfAFund(t *testing.T) {
	t.Parallel()
	f := newFundEventFixture(t, "fixed_income_fund")

	want := []eventRow{
		{"2026-05-29", "unit_tax", 1000000000, 0, "due"},
		{"2026-11-30", "unit_tax", 1000000000, 0, "upcoming"},
	}
	es := f.unitTaxEvents(t)

	if got := rowsOf(es); !reflect.DeepEqual(got, want) {
		t.Fatalf("events = %+v, want %+v", got, want)
	}

	for _, e := range es {
		if e.AccountID != f.fund || e.Instrument != fundCode || e.Gross != nil ||
			e.Quantity.Currency != fundCode || e.RateMissing {
			t.Errorf("event = %+v", e)
		}
	}
}

func TestS535UnitTaxEventRecorded(t *testing.T) {
	t.Parallel()
	f := newFundEventFixture(t, "multimarket")
	f.h.MustDo(http.MethodPost, "/api/v1/corporate-actions", map[string]any{
		"account_id": f.fund,
		"kind":       "unit_tax",
		"date":       "2026-05-29",
		"ratio_from": 1,
		"ratio_to":   1,
		"quantity":   units(12500000, fundCode),
		"amount":     apitest.BRL(15000),
	}, http.StatusCreated, nil)
	f.h.Dispatch()

	want := []eventRow{
		{"2026-05-29", "unit_tax", 1000000000, 0, "recorded"},
		{"2026-11-30", "unit_tax", 987500000, 0, "upcoming"},
	}
	if got := rowsOf(f.unitTaxEvents(t)); !reflect.DeepEqual(got, want) {
		t.Fatalf("events = %+v, want %+v", got, want)
	}
}

func TestS536EquityFundHasNoUnitTax(t *testing.T) {
	t.Parallel()
	f := newFundEventFixture(t, "equity_fund")

	if got := f.unitTaxEvents(t); len(got) != 0 {
		t.Fatalf("events = %+v, want none", rowsOf(got))
	}
}

func TestS537RegionWithoutUnitTax(t *testing.T) {
	t.Parallel()
	f := newFundEventFixture(t, "fixed_income_fund")
	f.moveToRegion(t, "DE")

	if got := f.unitTaxEvents(t); len(got) != 0 {
		t.Fatalf("events = %+v, want none", rowsOf(got))
	}
}

type fundEventFixture struct {
	fixture
	fund string
}

// newFundEventFixture holds 1000.000000 units of a fund of subtype bought on 2026-01-05.
func newFundEventFixture(t *testing.T, subtype string) fundEventFixture {
	t.Helper()

	f := newFixture(t)
	instrument := security(fundCode, "fund")
	instrument["scale"] = 6
	instrument["subtype"] = subtype
	f.h.MustDo(http.MethodPost, "/api/v1/instruments", instrument, http.StatusCreated, nil)

	fund := f.h.Account("XP FUNDUT", "asset", "brokerage", map[string]any{
		"institution_id": f.institution,
		"parent_id":      f.xp,
		"currency":       fundCode,
	})
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id":      fund,
		"cash_account_id": f.cash,
		"side":            "buy",
		"date":            "2026-01-05",
		"quantity":        units(1000000000, fundCode),
		"unit_price":      "10.00",
	}, http.StatusCreated, nil)
	f.h.Dispatch()

	return fundEventFixture{fixture: f, fund: fund}
}

func (f fundEventFixture) unitTaxEvents(t *testing.T) []eventOut {
	t.Helper()

	var out struct {
		Items []eventOut `json:"items"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/fixed-income-events?from=2026-05-01&to=2026-12-31",
		nil,
		http.StatusOK,
		&out,
	)

	return out.Items
}
