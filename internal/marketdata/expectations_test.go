package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// expectationServer answers the SGS with no rate and Olinda with one Focus survey.
func expectationServer(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ExpectativasMercadoAnuais":
			_, _ = w.Write([]byte(`{"value":[
{"Data":"2026-10-23","DataReferencia":"2026","Mediana":13.25},
{"Data":"2026-10-23","DataReferencia":"2027","Mediana":11.75}]}`))
		default:
			_, _ = w.Write([]byte(`[]`))
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

// ADR 026 E3 to E5.
func TestIndexExpectations(t *testing.T) {
	t.Parallel()
	srv := expectationServer(t)
	h := apitest.New(t, apitest.Today("2026-10-27"), apitest.IndexFeeds([]string{"br_cdi"}, map[string]string{"br_cdi": srv.URL, "br_focus": srv.URL}))
	if _, err := h.Pool.Exec(t.Context(), `INSERT INTO marketdata_index_rate (index_id, date, rate, source) VALUES ('cdi', '2026-10-26', 0.00050788, 'br_cdi')`); err != nil {
		t.Fatal(err)
	}
	h.MustDo(http.MethodPut, "/api/v1/market-data/feeds/br_focus", map[string]bool{"enabled": true}, http.StatusOK, nil)
	h.App.Marketdata.TickFeeds(t.Context())

	var list struct {
		Items []struct {
			ID       string `json:"id"`
			Expected bool   `json:"expected"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/indexes", nil, http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].ID != "cdi" || !list.Items[0].Expected {
		t.Fatalf("indexes = %+v", list.Items)
	}

	type point struct {
		Date string `json:"date"`
		Rate string `json:"rate"`
	}
	var got struct {
		SurveyDate string  `json:"survey_date"`
		Items      []point `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/indexes/cdi/expectations", nil, http.StatusOK, &got)
	want := []point{{"2026-12-31", "0.131500000000"}, {"2027-12-31", "0.116500000000"}}
	if got.SurveyDate != "2026-10-23" || !reflect.DeepEqual(got.Items, want) {
		t.Fatalf("expectations = %+v", got)
	}
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/indexes/ipca/expectations", nil), http.StatusNotFound, "not_found", "")

	f := feedsOf(t, h)["br_focus"]
	if f.Kind != "expectation" || !f.Enabled || !f.Suggested || f.Last == nil || *f.Last != "2026-10-23" || f.Stale || f.Error != nil {
		t.Fatalf("br_focus = %+v", f)
	}
}

// ADR 026 E4: a survey older than 7 days after its day is overdue.
func TestIndexExpectationsStale(t *testing.T) {
	t.Parallel()
	srv := expectationServer(t)
	h := apitest.New(t, apitest.Today("2026-11-01"), apitest.IndexFeeds(nil, map[string]string{"br_focus": srv.URL}))
	h.MustDo(http.MethodPut, "/api/v1/market-data/feeds/br_focus", map[string]bool{"enabled": true}, http.StatusOK, nil)
	h.App.Marketdata.TickFeeds(t.Context())
	if f := feedsOf(t, h)["br_focus"]; !f.Stale {
		t.Fatalf("br_focus = %+v", f)
	}
}

// ADR 026 E10: the assistant reads the expected path through get_market_data.
func TestIndexExpectationsTool(t *testing.T) {
	t.Parallel()
	srv := expectationServer(t)
	h := apitest.New(t, apitest.Today("2026-10-27"), apitest.IndexFeeds(nil, map[string]string{"br_focus": srv.URL}))
	h.MustDo(http.MethodPut, "/api/v1/market-data/feeds/br_focus", map[string]bool{"enabled": true}, http.StatusOK, nil)
	h.App.Marketdata.TickFeeds(t.Context())
	var out struct {
		IndexExpectations struct {
			SurveyDate string         `json:"survey_date"`
			Points     []apiIndexRate `json:"points"`
		} `json:"index_expectations"`
	}
	toolOutput(t, h, "get_market_data", map[string]any{"view": "index_expectations", "index": "cdi"}, &out)
	if x := out.IndexExpectations; x.SurveyDate != "2026-10-23" || len(x.Points) != 2 || x.Points[0] != (apiIndexRate{"2026-12-31", "0.131500000000"}) {
		t.Fatalf("index_expectations = %+v", x)
	}
	h.ExpectToolError(h.Tool("get_market_data", map[string]any{"view": "index_expectations", "index": "ipca"}), "not_found", "")
	h.ExpectToolError(h.Tool("get_market_data", map[string]any{"view": "index_expectations"}), "invalid_arguments", "index")
}
