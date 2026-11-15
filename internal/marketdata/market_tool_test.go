package marketdata_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

func preview(
	t *testing.T,
	h *apitest.Harness,
	name string,
	args map[string]any,
) (tool.Preview, tool.Result) {
	t.Helper()

	b, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}

	p, r, err := h.App.Tools.Preview(auth.WithBooksID(t.Context(), h.OwnerID()), name, b)
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
	args := map[string]any{
		"action":         "define",
		"code":           "MXRF11",
		"name":           "Maxi Renda",
		"type":           "reit",
		"quote_currency": "BRL",
	}

	p, r := preview(t, h, "manage_instrument", args)
	if r.IsError || p.Target != "MXRF11" || p.Destructive || len(p.Changes) != 4 ||
		p.Changes[0].Field != "instrument" ||
		p.Changes[0].After.Text != "MXRF11" {
		t.Fatalf("preview = %+v %s", p, r.Content)
	}

	h.ExpectToolError(
		h.Tool("get_market_data", map[string]any{"view": "instrument", "code": "MXRF11"}),
		"not_found",
		"",
	)

	var out struct {
		Instrument toolInstrument `json:"instrument"`
	}
	toolOutput(t, h, "manage_instrument", args, &out)
	var got struct {
		Instrument toolInstrument `json:"instrument"`
	}
	toolOutput(
		t,
		h,
		"get_market_data",
		map[string]any{"view": "instrument", "code": "MXRF11"},
		&got,
	)

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

func TestManageInstrumentToolRename(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.MustDo("POST", "/api/v1/instruments", mxrf11(), 201, nil)

	args := map[string]any{"action": "rename", "code": "MXRF11", "name": "Maxi Renda FII"}

	p, r := preview(t, h, "manage_instrument", args)
	if r.IsError || len(p.Changes) != 1 || p.Changes[0].Field != "name" ||
		p.Changes[0].Before.Text != "Maxi Renda" ||
		p.Changes[0].After.Text != "Maxi Renda FII" {
		t.Fatalf("preview = %+v %s", p, r.Content)
	}

	var out struct {
		Instrument toolInstrument `json:"instrument"`
	}
	toolOutput(t, h, "manage_instrument", args, &out)
	var read instrumentAPI
	h.MustDo("GET", "/api/v1/instruments/MXRF11", nil, 200, &read)

	want := instrumentAPI{
		Code:          "MXRF11",
		Type:          "reit",
		Name:          "Maxi Renda FII",
		QuoteCurrency: "BRL",
		Exchange:      "BVMF",
	}
	if out.Instrument.Name != "Maxi Renda FII" || read != want {
		t.Fatalf("renamed %+v, read %+v", out.Instrument, read)
	}

	h.ExpectToolError(
		h.Tool("manage_instrument", map[string]any{"action": "rename", "code": "MXRF11"}),
		"invalid_arguments",
		"name",
	)
	h.ExpectToolError(
		h.Tool(
			"manage_instrument",
			map[string]any{"action": "rename", "code": "BRL", "name": "Real"},
		),
		"validation_failed",
		"code",
	)
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

	args := map[string]any{
		"action": "record_price",
		"code":   "MXRF11",
		"date":   "2026-10-22",
		"price":  "10.50",
	}

	p, r := preview(t, h, "manage_instrument", args)
	if r.IsError || len(p.Changes) != 2 || p.Changes[0].Field != "price" ||
		p.Changes[0].After.Text != "10.50 BRL" ||
		p.Changes[1].Field != "date" ||
		p.Changes[1].After.Date != "2026-10-22" {
		t.Fatalf("preview = %+v %s", p, r.Content)
	}

	var prices struct {
		Prices []struct{ Date, Value string } `json:"prices"`
	}
	view := map[string]any{
		"view":  "prices",
		"code":  "MXRF11",
		"quote": "BRL",
		"from":  "2026-10-01",
		"to":    "2026-10-31",
	}
	toolOutput(t, h, "get_market_data", view, &prices)

	if len(prices.Prices) != 0 {
		t.Fatalf("prices before = %+v", prices.Prices)
	}

	toolOutput(t, h, "manage_instrument", args, &struct{}{})
	toolOutput(t, h, "get_market_data", view, &prices)

	if len(prices.Prices) != 1 || prices.Prices[0].Date != "2026-10-22" ||
		prices.Prices[0].Value != "10.5" {
		t.Errorf("prices = %+v", prices.Prices)
	}

	h.ExpectToolError(
		h.Tool(
			"manage_instrument",
			map[string]any{
				"action": "record_price",
				"code":   "NOPE11",
				"date":   "2026-10-22",
				"price":  "1",
			},
		),
		"not_found",
		"",
	)
	h.ExpectToolError(
		h.Tool(
			"manage_instrument",
			map[string]any{
				"action": "record_price",
				"code":   "MXRF11",
				"date":   "2026-10-22",
				"price":  "-1",
			},
		),
		"invalid_arguments",
		"price",
	)
}

// S125 through the tool.
func TestManageInstrumentToolSetTerms(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	defineFixedIncome(t, h, "CDBXPTO")
	h.MustDo("POST", "/api/v1/instruments", mxrf11(), 201, nil)

	args := map[string]any{
		"action":              "set_terms",
		"code":                "CDBXPTO",
		"issued_on":           "2026-01-02",
		"matures_on":          "2028-01-02",
		"face_value":          "1000.00",
		"index_id":            "cdi",
		"percent_of_index_bp": 11000,
	}

	p, r := preview(t, h, "manage_instrument", args)
	if r.IsError || len(p.Changes) != 1 || p.Changes[0].Field != "terms" ||
		p.Changes[0].Before.Text != "" {
		t.Fatalf("preview = %+v %s", p, r.Content)
	}

	toolOutput(t, h, "manage_instrument", args, &struct{}{})
	var got struct {
		Instrument toolInstrument `json:"instrument"`
	}
	toolOutput(
		t,
		h,
		"get_market_data",
		map[string]any{"view": "instrument", "code": "CDBXPTO"},
		&got,
	)

	terms := got.Instrument.Terms
	if terms.MaturesOn != "2028-01-02" || terms.IndexID != "cdi" ||
		terms.PercentOfIndexBP != 11000 ||
		terms.DayCount != "bus252" ||
		terms.FaceValue.Amount != "1000.00" {
		t.Errorf("terms = %+v", terms)
	}

	h.ExpectToolError(
		h.Tool(
			"manage_instrument",
			map[string]any{
				"action":     "set_terms",
				"code":       "MXRF11",
				"issued_on":  "2026-01-02",
				"matures_on": "2028-01-02",
				"face_value": "1000.00",
			},
		),
		"validation_failed",
		"code",
	)
	h.ExpectToolError(
		h.Tool(
			"manage_instrument",
			map[string]any{
				"action":     "set_terms",
				"code":       "NOPE11",
				"issued_on":  "2026-01-02",
				"matures_on": "2028-01-02",
				"face_value": "1000.00",
			},
		),
		"not_found",
		"",
	)
	h.ExpectToolError(
		h.Tool(
			"manage_instrument",
			map[string]any{
				"action":     "set_terms",
				"code":       "CDBXPTO",
				"issued_on":  "2026-01-02",
				"matures_on": "2026-01-02",
				"face_value": "1000.00",
			},
		),
		"validation_failed",
		"matures_on",
	)
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

	if len(cals.Calendars) != 2 || cals.Calendars[0].ID != "br_banking" ||
		!reflect.DeepEqual(cals.Calendars[0].Weekend, []string{"saturday", "sunday"}) {
		t.Fatalf("calendars = %+v", cals.Calendars)
	}

	var hols struct {
		Holidays []struct{ Date, Name, Source string } `json:"holidays"`
	}
	toolOutput(
		t,
		h,
		"get_market_data",
		map[string]any{"view": "holidays", "calendar": "br_banking", "year": 2026},
		&hols,
	)

	found := false
	for _, x := range hols.Holidays {
		found = found ||
			(x.Date == "2026-09-07" && x.Name == "Independence Day" && x.Source == "rule")
	}

	if !found {
		t.Errorf("holidays = %+v", hols.Holidays)
	}

	h.ExpectToolError(
		h.Tool(
			"get_market_data",
			map[string]any{"view": "holidays", "calendar": "nope", "year": 2026},
		),
		"not_found",
		"",
	)
}

func TestGetMarketDataToolIndexes(t *testing.T) {
	t.Parallel()

	s := &sgsServer{
		cdi:  cdiWeek,
		ipca: [][2]string{{"01/01/2026", "0.42"}, {"01/02/2026", "-0.30"}},
	}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(
		t,
		apitest.Today("2026-03-15"),
		apitest.IndexFeeds([]string{"br_cdi", "br_ipca"}, indexURLs(srv)),
	)
	h.App.Marketdata.TickFeeds(t.Context())

	var list struct {
		Indexes []apiIndex `json:"indexes"`
	}
	toolOutput(t, h, "get_market_data", map[string]any{"view": "indexes"}, &list)

	want := []apiIndex{
		{"cdi", "day", "2026-01-02", "2026-01-09"},
		{"ipca", "month", "2026-01-01", "2026-02-01"},
	}
	if !reflect.DeepEqual(list.Indexes, want) {
		t.Fatalf("indexes = %+v, want %+v", list.Indexes, want)
	}

	var rates struct {
		IndexRates []apiIndexRate `json:"index_rates"`
	}
	toolOutput(
		t,
		h,
		"get_market_data",
		map[string]any{
			"view":  "index_rates",
			"index": "ipca",
			"from":  "2026-01-01",
			"to":    "2026-02-28",
		},
		&rates,
	)

	wantRates := []apiIndexRate{{"2026-01-01", "0.004200000000"}, {"2026-02-01", "-0.003000000000"}}
	if !reflect.DeepEqual(rates.IndexRates, wantRates) {
		t.Fatalf("index rates = %+v, want %+v", rates.IndexRates, wantRates)
	}

	h.ExpectToolError(
		h.Tool(
			"get_market_data",
			map[string]any{
				"view":  "index_rates",
				"index": "selic",
				"from":  "2026-01-01",
				"to":    "2026-02-28",
			},
		),
		"not_found",
		"",
	)
	h.ExpectToolError(
		h.Tool(
			"get_market_data",
			map[string]any{"view": "index_rates", "from": "2026-01-01", "to": "2026-02-28"},
		),
		"invalid_arguments",
		"index",
	)
}

func TestGetMarketDataToolInvalidArguments(t *testing.T) {
	t.Parallel()

	h := apitest.New(t)
	for _, tc := range []struct {
		args  map[string]any
		field string
	}{
		{map[string]any{"view": "prices", "code": "MXRF11", "from": "2026-10-01", "to": "2026-10-31"}, "quote"},
		{map[string]any{"view": "prices", "code": "MXRF11", "quote": "BRL", "from": "2026-01-01", "to": "2076-02-09"}, "to"},
		{map[string]any{"view": "instrument"}, "code"},
		{map[string]any{"view": "holidays", "calendar": "br_banking"}, "year"},
		{map[string]any{"view": "calendars", "code": "x"}, "code"},
	} {
		h.ExpectToolError(h.Tool("get_market_data", tc.args), "invalid_arguments", tc.field)
	}
}

// A222 MQ8 through the tool: the action previews its start and queues the history.
func TestManageInstrumentToolRequestHistory(t *testing.T) {
	t.Parallel()

	h, _ := seededPTAXHarness(t, "2026-11-09")
	args := map[string]any{"action": "request_history", "code": "USD", "from": "2010-01-01"}

	p, r := preview(t, h, "manage_instrument", args)
	if r.IsError || p.Action != "manage_instrument.request_history" || len(p.Changes) != 1 ||
		p.Changes[0].Field != "from" ||
		p.Changes[0].After.Date != "2010-01-01" {
		t.Fatalf("preview = %+v %s", p, r.Content)
	}

	toolOutput(t, h, "manage_instrument", args, &struct{}{})

	assertRows(t, historyRow(h, "bcb_ptax", "USD"), "2010-01-01 false ")

	bare := apitest.New(t, apitest.Today("2026-11-09"))
	bare.MustDo("POST", "/api/v1/instruments", mxrf11(), 201, nil)
	bare.ExpectToolError(
		bare.Tool(
			"manage_instrument",
			map[string]any{"action": "request_history", "code": "MXRF11", "from": "2010-01-01"},
		),
		"no_source",
		"",
	)
	bare.ExpectToolError(
		bare.Tool(
			"manage_instrument",
			map[string]any{"action": "rename", "code": "MXRF11", "name": "X", "from": "2010-01-01"},
		),
		"invalid_arguments",
		"from",
	)
}

// A222 MQ23, MQ24 through the tool: the instrument view reports the coverage.
func TestGetMarketDataInstrumentCoverage(t *testing.T) {
	t.Parallel()

	h, _ := seededPTAXHarness(t, "2026-11-13")
	h.App.Marketdata.TickFeeds(t.Context())

	var out struct {
		Instrument struct {
			Coverage struct {
				Last    string `json:"last"`
				Stale   bool   `json:"stale"`
				Sources []struct {
					ID       string `json:"id"`
					Enabled  bool   `json:"enabled"`
					Official bool   `json:"official"`
					Last     string `json:"last"`
				} `json:"sources"`
			} `json:"coverage"`
		} `json:"instrument"`
	}
	toolOutput(t, h, "get_market_data", map[string]any{"view": "instrument", "code": "USD"}, &out)

	c := out.Instrument.Coverage
	if c.Last != "2026-11-06" || c.Stale || len(c.Sources) != 2 {
		t.Fatalf("coverage = %+v", c)
	}

	if s := c.Sources[0]; s.ID != "bcb_ptax" || !s.Enabled || !s.Official ||
		s.Last != "2026-11-06" {
		t.Errorf("source 0 = %+v", s)
	}

	if s := c.Sources[1]; s.ID != "ecb" || s.Enabled || !s.Official || s.Last != "" {
		t.Errorf("source 1 = %+v", s)
	}
}

type instrumentFacts struct {
	Name     string            `json:"name"`
	Exchange string            `json:"exchange"`
	Subtype  string            `json:"subtype"`
	Symbols  map[string]string `json:"symbols"`
}

func TestManageInstrumentToolExchangeSubtypeSymbols(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	define := map[string]any{
		"action":         "define",
		"code":           "MXRF11",
		"name":           "Maxi Renda",
		"type":           "reit",
		"quote_currency": "BRL",
		"exchange":       "BVMF",
		"subtype":        "fii_papel",
		"symbols":        []string{"yahoo_chart=MXRF11.SA"},
	}
	toolOutput(t, h, "manage_instrument", define, &struct{}{})

	var got instrumentFacts
	h.MustDo(http.MethodGet, "/api/v1/instruments/MXRF11", nil, http.StatusOK, &got)

	want := instrumentFacts{
		Name:     "Maxi Renda",
		Exchange: "BVMF",
		Subtype:  "fii_papel",
		Symbols:  map[string]string{"yahoo_chart": "MXRF11.SA"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("defined = %+v", got)
	}

	var view struct {
		Instrument struct {
			Exchange string   `json:"exchange"`
			Symbols  []string `json:"symbols"`
		} `json:"instrument"`
	}
	toolOutput(
		t,
		h,
		"get_market_data",
		map[string]any{"view": "instrument", "code": "MXRF11"},
		&view,
	)

	if view.Instrument.Exchange != "BVMF" ||
		!reflect.DeepEqual(view.Instrument.Symbols, []string{"yahoo_chart=MXRF11.SA"}) {
		t.Errorf("view = %+v", view)
	}

	edit := map[string]any{"action": "edit", "code": "MXRF11", "subtype": "fii_tijolo"}

	p, r := preview(t, h, "manage_instrument", edit)
	if r.IsError || len(p.Changes) != 1 || p.Changes[0].Before.Text != "fii_papel" ||
		p.Changes[0].After.Text != "fii_tijolo" {
		t.Fatalf("preview = %+v %s", p, r.Content)
	}

	toolOutput(t, h, "manage_instrument", edit, &struct{}{})
	h.MustDo(http.MethodGet, "/api/v1/instruments/MXRF11", nil, http.StatusOK, &got)

	want.Subtype = "fii_tijolo"
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("after a subtype edit = %+v", got)
	}

	toolOutput(
		t,
		h,
		"manage_instrument",
		map[string]any{"action": "edit", "code": "MXRF11", "symbols": []string{}},
		&struct{}{},
	)

	got = instrumentFacts{}
	h.MustDo(http.MethodGet, "/api/v1/instruments/MXRF11", nil, http.StatusOK, &got)

	if len(got.Symbols) != 0 || got.Name != "Maxi Renda" || got.Exchange != "BVMF" {
		t.Fatalf("after clearing the symbols = %+v", got)
	}

	h.ExpectToolError(
		h.Tool("manage_instrument", map[string]any{"action": "edit", "code": "MXRF11"}),
		"invalid_arguments",
		"name",
	)
	h.ExpectToolError(
		h.Tool(
			"manage_instrument",
			map[string]any{"action": "edit", "code": "MXRF11", "exchange": "B3"},
		),
		"validation_failed",
		"exchange",
	)
	h.ExpectToolError(
		h.Tool(
			"manage_instrument",
			map[string]any{"action": "edit", "code": "MXRF11", "symbols": []string{"yahoo"}},
		),
		"invalid_arguments",
		"symbols",
	)
	h.ExpectToolError(
		h.Tool(
			"manage_instrument",
			map[string]any{"action": "edit", "code": "MXRF11", "symbols": []string{"nowhere=X"}},
		),
		"validation_failed",
		"symbols.nowhere",
	)
	h.ExpectToolError(
		h.Tool("manage_instrument", map[string]any{"action": "edit", "code": "NOPE", "name": "x"}),
		"not_found",
		"",
	)
	h.ExpectToolError(
		h.Tool(
			"manage_instrument",
			map[string]any{"action": "rename", "code": "MXRF11", "name": "x", "subtype": "fii"},
		),
		"invalid_arguments",
		"subtype",
	)
}

func TestManageInstrumentToolDayCount(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	defineFixedIncome(t, h, "CDBXPTO")

	args := map[string]any{
		"action":     "set_terms",
		"code":       "CDBXPTO",
		"issued_on":  "2026-01-02",
		"matures_on": "2028-01-02",
		"face_value": "1000.00",
		"index_id":   "cdi",
		"day_count":  "act365",
	}
	toolOutput(t, h, "manage_instrument", args, &struct{}{})

	var got struct {
		Instrument toolInstrument `json:"instrument"`
	}
	toolOutput(
		t,
		h,
		"get_market_data",
		map[string]any{"view": "instrument", "code": "CDBXPTO"},
		&got,
	)

	if got.Instrument.Terms.DayCount != "act365" {
		t.Errorf("day count = %q", got.Instrument.Terms.DayCount)
	}

	args["index_id"], args["day_count"] = "", "bus252"
	delete(args, "index_id")
	h.ExpectToolError(h.Tool("manage_instrument", args), "validation_failed", "")
}

func TestMarketToolCatalog(t *testing.T) {
	t.Parallel()

	h := tesouroHarness(t, http.StatusOK)

	var out struct {
		Catalog []map[string]any `json:"catalog"`
	}

	toolOutput(t, h, "get_market_data", map[string]any{"view": "catalog", "query": "selic"}, &out)

	want := []map[string]any{{
		"code": "LFT.20270301", "name": "Tesouro Selic 2027", "type": "fixed_income",
		"quote_currency": "BRL", "source": "tesouro_direto", "defined": false,
	}}
	if !reflect.DeepEqual(out.Catalog, want) {
		t.Fatalf("catalog = %v, want %v", out.Catalog, want)
	}

	h.ExpectToolError(
		h.Tool("get_market_data", map[string]any{"view": "catalog"}),
		"invalid_arguments",
		"query",
	)
}

// A223 RM4: the action delete previews the removal and then deletes the security.
func TestManageInstrumentToolDelete(t *testing.T) {
	t.Parallel()

	h := apitest.New(t)
	h.MustDo("POST", "/api/v1/instruments", mxrf11(), 201, nil)

	args := map[string]any{"action": "delete", "code": "MXRF11"}

	p, r := preview(t, h, "manage_instrument", args)
	if r.IsError || p.Action != "manage_instrument.delete" || len(p.Changes) != 1 ||
		p.Changes[0].Field != "instrument" {
		t.Fatalf("preview = %+v %s", p, r.Content)
	}

	toolOutput(t, h, "manage_instrument", args, &struct{}{})
	h.ExpectProblem(h.Do("GET", "/api/v1/instruments/MXRF11", nil), 404, "not_found", "")

	h.ExpectToolError(h.Tool("manage_instrument", args), "not_found", "")
	h.ExpectToolError(
		h.Tool("manage_instrument", map[string]any{"action": "delete", "code": "BRL"}),
		"validation_failed",
		"code",
	)
	h.ExpectToolError(
		h.Tool(
			"manage_instrument",
			map[string]any{"action": "delete", "code": "MXRF11", "name": "X"},
		),
		"invalid_arguments",
		"name",
	)
}

// S410: the edit action of manage_instrument previews and applies a type change, and refuses
// one outside the four types of scale 0 (amendment A224).
func TestManageInstrumentToolEditType(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.MustDo("POST", "/api/v1/instruments", mxrf11(), 201, nil)

	args := map[string]any{"action": "edit", "code": "MXRF11", "type": "etf"}

	p, r := preview(t, h, "manage_instrument", args)
	if r.IsError || len(p.Changes) != 1 || p.Changes[0].Field != "kind" ||
		p.Changes[0].Before.Text != "reit" || p.Changes[0].After.Text != "etf" {
		t.Fatalf("preview = %+v %s", p, r.Content)
	}

	var out struct {
		Instrument toolInstrument `json:"instrument"`
	}
	toolOutput(t, h, "manage_instrument", args, &out)

	var read instrumentAPI
	h.MustDo("GET", "/api/v1/instruments/MXRF11", nil, 200, &read)

	if read.Type != "etf" {
		t.Fatalf("type = %q, want etf", read.Type)
	}

	h.ExpectToolError(
		h.Tool(
			"manage_instrument",
			map[string]any{"action": "edit", "code": "MXRF11", "type": "crypto"},
		),
		"validation_failed",
		"type",
	)
}
