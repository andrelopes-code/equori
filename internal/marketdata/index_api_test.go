package marketdata_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

type apiIndex struct {
	ID     string `json:"id"`
	Period string `json:"period"`
	First  string `json:"first"`
	Last   string `json:"last"`
}

type apiIndexRate struct {
	Date string `json:"date"`
	Rate string `json:"rate"`
}

func TestS157IndexHistory(t *testing.T) {
	t.Parallel()
	s := &sgsServer{cdi: cdiWeek, ipca: [][2]string{{"01/01/2026", "0.42"}, {"01/02/2026", "-0.30"}}}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(t, apitest.Today("2026-03-15"), apitest.IndexFeeds([]string{"br_cdi", "br_ipca"}, indexURLs(srv)))

	h.App.Marketdata.TickFeeds(t.Context())
	var cdi, ipca []string
	for _, r := range s.take() {
		if strings.Contains(r, "bcdata.sgs.12/") {
			cdi = append(cdi, r)
		} else {
			ipca = append(ipca, r)
		}
	}
	if len(cdi) == 0 || !strings.Contains(cdi[0], "dataInicial=15%2F03%2F2006") || len(ipca) == 0 || !strings.Contains(ipca[0], "dataInicial=15%2F03%2F2006") {
		t.Fatalf("requests: cdi %v, ipca %v", cdi, ipca)
	}
	for _, r := range cdi {
		u, err := url.Parse(r)
		if err != nil {
			t.Fatal(err)
		}
		from, _ := time.Parse("02/01/2006", u.Query().Get("dataInicial"))
		to, _ := time.Parse("02/01/2006", u.Query().Get("dataFinal"))
		if days := int(to.Sub(from).Hours()/24) + 1; days > 1826 {
			t.Errorf("request %s spans %d days", r, days)
		}
	}

	var list struct {
		Items []apiIndex `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/indexes", nil, http.StatusOK, &list)
	want := []apiIndex{{"cdi", "day", "2026-01-02", "2026-01-09"}, {"ipca", "month", "2026-01-01", "2026-02-01"}}
	if !reflect.DeepEqual(list.Items, want) {
		t.Fatalf("indexes = %+v, want %+v", list.Items, want)
	}

	var rates struct {
		Items []apiIndexRate `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/indexes/ipca/rates?from=2026-01-01&to=2026-02-28", nil, http.StatusOK, &rates)
	wantRates := []apiIndexRate{{"2026-01-01", "0.004200000000"}, {"2026-02-01", "-0.003000000000"}}
	if !reflect.DeepEqual(rates.Items, wantRates) {
		t.Fatalf("rates = %+v, want %+v", rates.Items, wantRates)
	}

	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/indexes/selic/rates?from=2026-01-01&to=2026-02-28", nil), http.StatusNotFound, "not_found", "")
	// 2006-01-01 to 2026-01-17 is 7,321 days.
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/indexes/ipca/rates?from=2006-01-01&to=2026-01-17", nil), http.StatusUnprocessableEntity, "validation_failed", "to")
}

// ADR 025 F3: the indexes of the caller's region come first, the others in the registry's order.
func TestIndexesOfTheRegionFirst(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.IndexFeeds([]string{"br_cdi", "eu_estr", "us_sofr"}, nil))
	for _, id := range []string{"cdi", "estr", "sofr"} {
		if _, err := h.Pool.Exec(t.Context(), `INSERT INTO marketdata_index_rate (index_id, date, rate, source) VALUES ($1, '2026-10-26', 0.0005, 'test')`, id); err != nil {
			t.Fatal(err)
		}
	}
	for region, want := range map[string][]string{
		"BR": {"cdi", "estr", "sofr"},
		"US": {"sofr", "cdi", "estr"},
		"DE": {"estr", "cdi", "sofr"},
		"JP": {"cdi", "estr", "sofr"},
	} {
		c := h.LoginAs(strings.ToLower(region)+"@example.com", locale.Locale{Language: "en", Region: region}, "USD")
		r := h.Call(c, http.MethodGet, "/api/v1/indexes", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("%s: status %d", region, r.Status)
		}
		var list struct {
			Items []apiIndex `json:"items"`
		}
		if err := json.Unmarshal(r.Body, &list); err != nil {
			t.Fatal(err)
		}
		got := make([]string, len(list.Items))
		for i, x := range list.Items {
			got[i] = x.ID
		}
		if !slices.Equal(got, want) {
			t.Errorf("%s: indexes = %v, want %v", region, got, want)
		}
	}
}
