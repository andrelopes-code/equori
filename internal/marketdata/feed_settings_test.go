package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type feedAPI struct {
	ID        string  `json:"id"`
	Kind      string  `json:"kind"`
	Enabled   bool    `json:"enabled"`
	Suggested bool    `json:"suggested"`
	Last      *string `json:"last"`
	Stale     bool    `json:"stale"`
	LastRun   *string `json:"last_run"`
	Error     *string `json:"error"`
}

func feedsOf(t *testing.T, h *apitest.Harness) map[string]feedAPI {
	t.Helper()
	var list struct {
		Items []feedAPI `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/market-data/feeds", nil, http.StatusOK, &list)
	out := make(map[string]feedAPI, len(list.Items))
	ids := make([]string, len(list.Items))
	for i, f := range list.Items {
		out[f.ID] = f
		ids[i] = f.ID
	}
	want := []string{"b3_cotahist", "bcb_ptax", "ecb", "br_cdi", "br_ipca", "eu_estr", "ea_hicp", "us_sofr", "us_cpi", "br_focus"}
	if !slices.Equal(ids, want) {
		t.Fatalf("feeds = %v, want %v", ids, want)
	}
	return out
}

// ADR 025 F2, F3, F5: the variables seed the enabled set; the caller's region names suggestions.
func TestFeedSettingsList(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-01"), apitest.PriceFeeds([]string{"bcb_ptax"}, nil))
	fs := feedsOf(t, h)
	if f := fs["bcb_ptax"]; f.Kind != "price" || !f.Enabled || !f.Suggested || f.Last != nil || f.Stale || f.LastRun != nil || f.Error != nil {
		t.Fatalf("bcb_ptax = %+v", f)
	}
	if f := fs["br_cdi"]; f.Kind != "index" || f.Enabled || !f.Suggested {
		t.Fatalf("br_cdi = %+v", f)
	}
	if f := fs["us_sofr"]; f.Enabled || f.Suggested {
		t.Fatalf("us_sofr = %+v", f)
	}
}

// ADR 025 F2, F6: the first write stores the seeded set, so bcb_ptax stays enabled; a tick
// then fetches both, and records its run and its failure.
func TestFeedSettingsEnable(t *testing.T) {
	t.Parallel()
	f := &feedServer{failPTAX: "USD"}
	srv := httptest.NewServer(f)
	t.Cleanup(srv.Close)
	h := apitest.New(t, apitest.Today("2026-11-01"), apitest.PriceFeeds([]string{"bcb_ptax"}, feedURLs(srv)))
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	var got feedAPI
	h.MustDo(http.MethodPut, "/api/v1/market-data/feeds/b3_cotahist", map[string]bool{"enabled": true}, http.StatusOK, &got)
	if got.ID != "b3_cotahist" || !got.Enabled {
		t.Fatalf("PUT = %+v", got)
	}
	h.App.Marketdata.TickFeeds(t.Context())
	var b3, ptax bool
	for _, r := range f.take() {
		b3 = b3 || strings.HasPrefix(r, "/b3/")
		ptax = ptax || strings.HasPrefix(r, "/ptax/")
	}
	if !b3 || !ptax {
		t.Fatalf("b3 %v, ptax %v", b3, ptax)
	}
	fs := feedsOf(t, h)
	if b := fs["b3_cotahist"]; !b.Enabled || b.Last == nil || *b.Last != "2026-10-30" || b.Stale || b.LastRun == nil || b.Error != nil {
		t.Fatalf("b3_cotahist = %+v", b)
	}
	if p := fs["bcb_ptax"]; !p.Enabled || p.LastRun == nil || p.Error == nil {
		t.Fatalf("bcb_ptax = %+v", p)
	}

	h.MustDo(http.MethodPut, "/api/v1/market-data/feeds/bcb_ptax", map[string]bool{"enabled": false}, http.StatusOK, nil)
	h.App.Marketdata.TickFeeds(t.Context())
	for _, r := range f.take() {
		if strings.HasPrefix(r, "/ptax/") {
			t.Fatalf("disabled bcb_ptax requested %s", r)
		}
	}
}

// ADR 025 F6: an unknown feed.
func TestFeedSettingsUnknown(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.ExpectProblem(h.Do(http.MethodPut, "/api/v1/market-data/feeds/nyse", map[string]bool{"enabled": true}), http.StatusNotFound, "not_found", "")
}

// ADR 025 F8: only an admin changes the instance's feeds.
func TestFeedSettingsAdminRequired(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	member := h.LoginMember("member@example.com")
	h.ExpectProblem(h.Call(member, http.MethodPut, "/api/v1/market-data/feeds/br_cdi", map[string]bool{"enabled": true}), http.StatusForbidden, "admin_required", "")
	h.ExpectProblem(h.Call(member, http.MethodPost, "/api/v1/market-data/refresh", nil), http.StatusForbidden, "admin_required", "")
	if r := h.Call(member, http.MethodGet, "/api/v1/market-data/feeds", nil); r.Status != http.StatusOK {
		t.Fatalf("member GET status %d", r.Status)
	}
}

// ADR 025 F7: a refresh runs one tick; a second one while it runs is refused.
func TestFeedSettingsRefresh(t *testing.T) {
	t.Parallel()
	f := &feedServer{}
	srv := httptest.NewServer(f)
	t.Cleanup(srv.Close)
	release := make(chan struct{})
	block := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-release
		f.ServeHTTP(w, r)
	}))
	t.Cleanup(block.Close)
	h := apitest.New(t, apitest.Today("2026-11-01"), apitest.PriceFeeds([]string{"b3_cotahist"}, map[string]string{"b3_cotahist": block.URL + "/b3"}))
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	h.MustDo(http.MethodPost, "/api/v1/market-data/refresh", nil, http.StatusAccepted, nil)
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/market-data/refresh", nil), http.StatusConflict, "refresh_running", "")
	close(release)
	h.App.Marketdata.WaitRefresh()
	if got := pricesOf(t, h, "MXRF11"); len(got) != 2 {
		t.Fatalf("prices = %+v", got)
	}
	h.MustDo(http.MethodPost, "/api/v1/market-data/refresh", nil, http.StatusAccepted, nil)
	h.App.Marketdata.WaitRefresh()
}

// ADR 025 F9: a daily feed is stale once today passes the day after its last date plus 5 days.
// Last 2026-10-30: due by 2026-10-31 + 5 = 2026-11-05.
func TestFeedSettingsStale(t *testing.T) {
	t.Parallel()
	for today, stale := range map[string]bool{"2026-11-05": false, "2026-11-06": true} {
		t.Run(today, func(t *testing.T) {
			t.Parallel()
			f := &feedServer{}
			srv := httptest.NewServer(f)
			t.Cleanup(srv.Close)
			h := apitest.New(t, apitest.Today(today), apitest.PriceFeeds([]string{"b3_cotahist"}, feedURLs(srv)))
			h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)
			h.App.Marketdata.TickFeeds(t.Context())
			if b := feedsOf(t, h)["b3_cotahist"]; b.Stale != stale || b.Last == nil || *b.Last != "2026-10-30" {
				t.Fatalf("b3_cotahist = %+v", b)
			}
		})
	}
}
