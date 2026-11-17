package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const curveFile = "Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;" +
	"PU Compra Manha;PU Venda Manha;PU Base Manha\n" +
	"Tesouro Prefixado;01/01/2030;16/11/2026;13,40;13,52;680,10;678,00;678,00\n" +
	"Tesouro Prefixado;01/01/2028;16/11/2026;13,10;13,22;870,10;869,00;869,00\n" +
	"Tesouro Prefixado;01/01/2029;13/11/2026;12,00;12,12;780,10;779,00;779,00\n" +
	"Tesouro Prefixado;01/01/2027;16/11/2026;0,00;13,00;0,00;985,00;985,00\n" +
	"Tesouro IPCA+;15/05/2029;16/11/2026;7,50;7,62;3700,10;3690,00;3690,00\n" +
	"Tesouro IPCA+ com Juros Semestrais;15/08/2030;16/11/2026;7,40;7,52;4300,10;4290,00;" +
	"4290,00\n" +
	"Tesouro Selic;01/03/2029;16/11/2026;0,05;0,06;20289,60;20274,60;20274,60\n"

type curvePointAPI struct {
	Maturity string `json:"maturity"`
	Rate     string `json:"rate"`
}

type curveAPI struct {
	ID       string          `json:"id"`
	Kind     string          `json:"kind"`
	Index    *string         `json:"index"`
	Currency string          `json:"currency"`
	BaseDate string          `json:"base_date"`
	Source   string          `json:"source"`
	Points   []curvePointAPI `json:"points"`
}

func curveHarness(t *testing.T, today string) *apitest.Harness {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(curveFile))
	}))
	t.Cleanup(srv.Close)

	return apitest.New(
		t,
		apitest.Today(today),
		apitest.IndexFeeds(nil, map[string]string{"br_tesouro": srv.URL}),
	)
}

func setCurveFeed(t *testing.T, h *apitest.Harness, enabled bool) {
	t.Helper()

	h.MustDo(
		http.MethodPut,
		"/api/v1/market-data/feeds/br_tesouro",
		map[string]bool{"enabled": enabled},
		http.StatusOK,
		nil,
	)
}

func wantCurves() []curveAPI {
	ipca := "ipca"

	return []curveAPI{
		{
			ID:       "br_tesouro_prefixed",
			Kind:     "nominal",
			Currency: "BRL",
			BaseDate: "2026-11-16",
			Source:   "br_tesouro",
			Points: []curvePointAPI{
				{"2028-01-01", "0.131000000000"},
				{"2030-01-01", "0.134000000000"},
			},
		},
		{
			ID:       "br_tesouro_ipca",
			Kind:     "real",
			Index:    &ipca,
			Currency: "BRL",
			BaseDate: "2026-11-16",
			Source:   "br_tesouro",
			Points:   []curvePointAPI{{"2029-05-15", "0.075000000000"}},
		},
	}
}

// S555, S556, S557 (indexer comparison IC12): the stored curves follow the feed.
func TestS555Curves(t *testing.T) {
	t.Parallel()

	h := curveHarness(t, "2026-11-17")
	setCurveFeed(t, h, true)
	h.App.Marketdata.TickFeeds(t.Context())

	var counts []struct {
		ID string
		N  int
	}

	rows, err := h.Pool.Query(
		t.Context(),
		`SELECT curve_id, count(*) FROM marketdata_curve_point GROUP BY curve_id ORDER BY curve_id`,
	)
	if err != nil {
		t.Fatal(err)
	}

	defer rows.Close()

	for rows.Next() {
		var c struct {
			ID string
			N  int
		}
		if err := rows.Scan(&c.ID, &c.N); err != nil {
			t.Fatal(err)
		}

		counts = append(counts, c)
	}

	want := []struct {
		ID string
		N  int
	}{{"br_tesouro_ipca", 1}, {"br_tesouro_prefixed", 2}}
	if !reflect.DeepEqual(counts, want) {
		t.Fatalf("stored points = %+v, want %+v", counts, want)
	}

	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")

	var got struct {
		Items []curveAPI `json:"items"`
	}

	r := h.Call(reader, http.MethodGet, "/api/v1/curves", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("GET /curves = %d %s", r.Status, r.Body)
	}

	r.Decode(t, &got)

	if !reflect.DeepEqual(got.Items, wantCurves()) {
		t.Fatalf("curves = %+v, want %+v", got.Items, wantCurves())
	}

	h.ExpectProblem(
		h.Call(&http.Client{}, http.MethodGet, "/api/v1/curves", nil),
		http.StatusUnauthorized,
		"unauthenticated",
		"",
	)

	setCurveFeed(t, h, false)

	var empty struct {
		Items []curveAPI `json:"items"`
	}

	h.MustDo(http.MethodGet, "/api/v1/curves", nil, http.StatusOK, &empty)

	if empty.Items == nil || len(empty.Items) != 0 {
		t.Fatalf("curves of a disabled feed = %+v", empty.Items)
	}
}

// S558: the file of 2026-11-16 leaves the next one due after 2026-11-16 + 2 + 5 = 2026-11-23, so
// 2026-12-01 is stale.
func TestS558CurveFeedStale(t *testing.T) {
	t.Parallel()

	for today, stale := range map[string]bool{"2026-11-17": false, "2026-12-01": true} {
		t.Run(today, func(t *testing.T) {
			t.Parallel()

			h := curveHarness(t, today)
			setCurveFeed(t, h, true)
			h.App.Marketdata.TickFeeds(t.Context())

			f := feedsOf(t, h)["br_tesouro"]
			if f.Kind != "curve" || !f.Enabled || f.Last == nil || *f.Last != "2026-11-16" ||
				f.Stale != stale || f.Error != nil {
				t.Fatalf("br_tesouro = %+v", f)
			}
		})
	}
}

// S559: a book of region US gets no suggestion for the Brazilian expectation and curve feeds.
func TestS559CurveFeedNotSuggestedOutsideBrazil(t *testing.T) {
	t.Parallel()

	h := curveHarness(t, "2026-11-17")
	us := h.LoginAs("us@example.com", locale.Locale{Language: "en", Region: "US"}, "USD")

	var list struct {
		Items []feedAPI `json:"items"`
	}

	h.Call(us, http.MethodGet, "/api/v1/market-data/feeds", nil).Decode(t, &list)

	seen := map[string]bool{}

	for _, f := range list.Items {
		if f.ID == "br_tesouro" || f.ID == "br_focus_ipca" {
			seen[f.ID] = true

			if f.Suggested {
				t.Fatalf("%s is suggested to a US book", f.ID)
			}
		}
	}

	if len(seen) != 2 {
		t.Fatalf("listed feeds = %v", seen)
	}
}

// IC12: the assistant reads the curves through get_market_data.
func TestCurvesTool(t *testing.T) {
	t.Parallel()

	h := curveHarness(t, "2026-11-17")
	setCurveFeed(t, h, true)
	h.App.Marketdata.TickFeeds(t.Context())

	var out struct {
		Curves []curveAPI `json:"curves"`
	}

	toolOutput(t, h, "get_market_data", map[string]any{"view": "curves"}, &out)

	if !reflect.DeepEqual(out.Curves, wantCurves()) {
		t.Fatalf("curves = %+v, want %+v", out.Curves, wantCurves())
	}
}
