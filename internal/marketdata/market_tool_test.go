package marketdata_test

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func toolOutput(t *testing.T, h *apitest.Harness, name string, args map[string]any, out any) {
	t.Helper()
	r := h.Tool(name, args)
	if r.IsError {
		t.Fatalf("%s = error %s", name, r.Content)
	}
	if err := json.Unmarshal(r.Content, out); err != nil {
		t.Fatal(err)
	}
}

func preview(t *testing.T, h *apitest.Harness, name string, args map[string]any) (tool.Preview, tool.Result) {
	t.Helper()
	b, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}
	p, r, err := h.App.Tools.Preview(auth.WithUserID(t.Context(), h.OwnerID()), name, b)
	if err != nil {
		t.Fatalf("preview %s: %v", name, err)
	}
	return p, r
}

type toolInstrument struct {
	Code          string `json:"code"`
	Name          string `json:"name"`
	Type          string `json:"type"`
	QuoteCurrency string `json:"quote_currency"`
	Scale         int    `json:"scale"`
	Terms         struct {
		MaturesOn        string     `json:"matures_on"`
		IndexID          string     `json:"index_id"`
		PercentOfIndexBP int        `json:"percent_of_index_bp"`
		DayCount         string     `json:"day_count"`
		FaceValue        tool.Money `json:"face_value"`
	} `json:"terms"`
}

func TestManageInstrumentToolDefine(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	args := map[string]any{"action": "define", "code": "MXRF11", "name": "Maxi Renda", "type": "reit", "quote_currency": "BRL"}
	p, r := preview(t, h, "manage_instrument", args)
	if r.IsError || p.Target != "Instrument MXRF11" || p.Destructive || len(p.Changes) != 4 || p.Changes[0].Field != "instrument" || p.Changes[0].After.Text != "MXRF11" {
		t.Fatalf("preview = %+v %s", p, r.Content)
	}
	h.ExpectToolError(h.Tool("get_market_data", map[string]any{"view": "instrument", "code": "MXRF11"}), "not_found", "")

	var out struct {
		Instrument toolInstrument `json:"instrument"`
	}
	toolOutput(t, h, "manage_instrument", args, &out)
	var got struct {
		Instrument toolInstrument `json:"instrument"`
	}
	toolOutput(t, h, "get_market_data", map[string]any{"view": "instrument", "code": "MXRF11"}, &got)
	want := toolInstrument{Code: "MXRF11", Name: "Maxi Renda", Type: "reit", QuoteCurrency: "BRL"}
	if !reflect.DeepEqual(got.Instrument, want) || !reflect.DeepEqual(out.Instrument, want) {
		t.Errorf("instrument = %+v, defined %+v, want %+v", got.Instrument, out.Instrument, want)
	}
	var list struct {
		Instruments []toolInstrument `json:"instruments"`
	}
	toolOutput(t, h, "get_market_data", map[string]any{"view": "instruments"}, &list)
	var codes []string
	for _, i := range list.Instruments {
		codes = append(codes, i.Code)
	}
	if !contains(codes, "MXRF11") || !contains(codes, "BRL") {
		t.Errorf("codes = %v", codes)
	}

	h.ExpectToolError(h.Tool("manage_instrument", args), "instrument_exists", "")
	_, r = preview(t, h, "manage_instrument", args)
	h.ExpectToolError(r, "instrument_exists", "")
}

func contains(s []string, v string) bool {
	for _, x := range s {
		if x == v {
			return true
		}
	}
	return false
}

func TestManageInstrumentToolInvalidArguments(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	for _, tc := range []struct {
		args  map[string]any
		field string
		code  string
	}{
		{map[string]any{"action": "define", "code": "MXRF11", "type": "reit", "quote_currency": "BRL"}, "name", "invalid_arguments"},
		{map[string]any{"action": "define", "code": "MXRF11", "name": "x", "type": "reit", "quote_currency": "BRL", "price": "1"}, "price", "invalid_arguments"},
		{map[string]any{"action": "record_price", "code": "MXRF11", "price": "10.50"}, "date", "invalid_arguments"},
		{map[string]any{"action": "record_price", "code": "MXRF11", "date": "2026-10-22", "price": "10.50", "name": "x"}, "name", "invalid_arguments"},
		{map[string]any{"action": "set_terms", "code": "CDBXPTO", "issued_on": "2026-01-02", "matures_on": "2028-01-02"}, "face_value", "invalid_arguments"},
		{map[string]any{"action": "define", "code": "mx", "name": "x", "type": "reit", "quote_currency": "BRL"}, "code", "validation_failed"},
		{map[string]any{"action": "define", "code": "MXRF11", "name": "x", "type": "reit", "quote_currency": "MXRF11"}, "quote_currency", "validation_failed"},
	} {
		h.ExpectToolError(h.Tool("manage_instrument", tc.args), tc.code, tc.field)
		_, r := preview(t, h, "manage_instrument", tc.args)
		if !r.IsError {
			t.Errorf("preview of %v did not fail", tc.args)
		}
	}
}

func TestManageInstrumentToolRecordPrice(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.MustDo("POST", "/api/v1/instruments", mxrf11(), 201, nil)
	args := map[string]any{"action": "record_price", "code": "MXRF11", "date": "2026-10-22", "price": "10.50"}
	p, r := preview(t, h, "manage_instrument", args)
	if r.IsError || len(p.Changes) != 2 || p.Changes[0].Field != "price" || p.Changes[0].After.Text != "10.50 BRL" || p.Changes[1].Field != "date" || p.Changes[1].After.Date != "2026-10-22" {
		t.Fatalf("preview = %+v %s", p, r.Content)
	}
	var prices struct {
		Prices []struct{ Date, Value string } `json:"prices"`
	}
	view := map[string]any{"view": "prices", "code": "MXRF11", "quote": "BRL", "from": "2026-10-01", "to": "2026-10-31"}
	toolOutput(t, h, "get_market_data", view, &prices)
	if len(prices.Prices) != 0 {
		t.Fatalf("prices before = %+v", prices.Prices)
	}
	toolOutput(t, h, "manage_instrument", args, &struct{}{})
	toolOutput(t, h, "get_market_data", view, &prices)
	if len(prices.Prices) != 1 || prices.Prices[0].Date != "2026-10-22" || prices.Prices[0].Value != "10.5" {
		t.Errorf("prices = %+v", prices.Prices)
	}
	h.ExpectToolError(h.Tool("manage_instrument", map[string]any{"action": "record_price", "code": "NOPE11", "date": "2026-10-22", "price": "1"}), "not_found", "")
	h.ExpectToolError(h.Tool("manage_instrument", map[string]any{"action": "record_price", "code": "MXRF11", "date": "2026-10-22", "price": "-1"}), "invalid_arguments", "price")
}

// S125 through the tool.
func TestManageInstrumentToolSetTerms(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	defineFixedIncome(t, h, "CDBXPTO")
	h.MustDo("POST", "/api/v1/instruments", mxrf11(), 201, nil)
	args := map[string]any{"action": "set_terms", "code": "CDBXPTO", "issued_on": "2026-01-02", "matures_on": "2028-01-02", "face_value": "1000.00", "index_id": "cdi", "percent_of_index_bp": 11000}
	p, r := preview(t, h, "manage_instrument", args)
	if r.IsError || len(p.Changes) != 1 || p.Changes[0].Field != "terms" || p.Changes[0].Before.Text != "" {
		t.Fatalf("preview = %+v %s", p, r.Content)
	}
	toolOutput(t, h, "manage_instrument", args, &struct{}{})
	var got struct {
		Instrument toolInstrument `json:"instrument"`
	}
	toolOutput(t, h, "get_market_data", map[string]any{"view": "instrument", "code": "CDBXPTO"}, &got)
	terms := got.Instrument.Terms
	if terms.MaturesOn != "2028-01-02" || terms.IndexID != "cdi" || terms.PercentOfIndexBP != 11000 || terms.DayCount != "bus252" || terms.FaceValue.Amount != "1000.00" {
		t.Errorf("terms = %+v", terms)
	}
	h.ExpectToolError(h.Tool("manage_instrument", map[string]any{"action": "set_terms", "code": "MXRF11", "issued_on": "2026-01-02", "matures_on": "2028-01-02", "face_value": "1000.00"}), "validation_failed", "code")
	h.ExpectToolError(h.Tool("manage_instrument", map[string]any{"action": "set_terms", "code": "NOPE11", "issued_on": "2026-01-02", "matures_on": "2028-01-02", "face_value": "1000.00"}), "not_found", "")
	h.ExpectToolError(h.Tool("manage_instrument", map[string]any{"action": "set_terms", "code": "CDBXPTO", "issued_on": "2026-01-02", "matures_on": "2026-01-02", "face_value": "1000.00"}), "validation_failed", "matures_on")
}

func TestGetMarketDataToolCalendars(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	var cals struct {
		Calendars []struct {
			ID      string   `json:"id"`
			Weekend []string `json:"weekend"`
		} `json:"calendars"`
	}
	toolOutput(t, h, "get_market_data", map[string]any{"view": "calendars"}, &cals)
	if len(cals.Calendars) != 2 || cals.Calendars[0].ID != "br_banking" || !reflect.DeepEqual(cals.Calendars[0].Weekend, []string{"saturday", "sunday"}) {
		t.Fatalf("calendars = %+v", cals.Calendars)
	}
	var hols struct {
		Holidays []struct{ Date, Name, Source string } `json:"holidays"`
	}
	toolOutput(t, h, "get_market_data", map[string]any{"view": "holidays", "calendar": "br_banking", "year": 2026}, &hols)
	found := false
	for _, x := range hols.Holidays {
		found = found || (x.Date == "2026-09-07" && x.Name == "Independence Day" && x.Source == "rule")
	}
	if !found {
		t.Errorf("holidays = %+v", hols.Holidays)
	}
	h.ExpectToolError(h.Tool("get_market_data", map[string]any{"view": "holidays", "calendar": "nope", "year": 2026}), "not_found", "")
}

func TestGetMarketDataToolInvalidArguments(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	for _, tc := range []struct {
		args  map[string]any
		field string
	}{
		{map[string]any{"view": "prices", "code": "MXRF11", "from": "2026-10-01", "to": "2026-10-31"}, "quote"},
		{map[string]any{"view": "prices", "code": "MXRF11", "quote": "BRL", "from": "2026-01-01", "to": "2027-06-01"}, "to"},
		{map[string]any{"view": "instrument"}, "code"},
		{map[string]any{"view": "holidays", "calendar": "br_banking"}, "year"},
		{map[string]any{"view": "calendars", "code": "x"}, "code"},
	} {
		h.ExpectToolError(h.Tool("get_market_data", tc.args), "invalid_arguments", tc.field)
	}
}
