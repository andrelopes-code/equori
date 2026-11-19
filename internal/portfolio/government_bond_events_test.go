package portfolio_test

import (
	"cmp"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S632 (coverage rows T-03, T-05): a Tesouro bond with half-yearly interest pays a coupon every 6
// months back from its maturity, on the next business day. An NTN-F pays 1,000.00 × (1.10^½ − 1)
// a unit; an NTN-B pays 6% a year of a nominal value the source does not publish, so its amount
// is missing. A bond without coupons matures on its date.
func TestS632GovernmentBondEvents(t *testing.T) {
	t.Parallel()

	f := newFixture(t, apitest.Today("2026-06-15"))
	accounts := map[string]string{}

	for _, code := range []string{"NTNF.20290101", "NTNB.20350515", "LTN.20270101"} {
		f.h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
			"code": code, "type": "fixed_income", "scale": 2, "name": code, "quote_currency": "BRL",
		}, http.StatusCreated, nil)

		accounts[code] = f.h.Account(code, "asset", "brokerage", map[string]any{
			"institution_id": f.institution, "parent_id": f.xp, "currency": code,
		})
		f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
			"account_id":      accounts[code],
			"cash_account_id": f.cash,
			"side":            "buy",
			"date":            "2026-01-12",
			"quantity":        units(200, code),
			"unit_price":      "900.00",
		}, http.StatusCreated, nil)
	}

	f.h.Dispatch()

	var out struct {
		Items []eventOut `json:"items"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/fixed-income-events?from=2026-06-01&to=2027-01-31",
		nil,
		http.StatusOK,
		&out,
	)

	type row struct {
		Instrument, Date, Kind string
		Gross                  int64
		Missing                bool
	}

	got := make([]row, len(out.Items))
	for i, e := range out.Items {
		got[i] = row{Instrument: e.Instrument, Date: e.Date, Kind: e.Kind, Missing: e.RateMissing}
		if e.Gross != nil {
			got[i].Gross = e.Gross.Amount
		}
	}

	slices.SortFunc(got, func(a, b row) int {
		return cmp.Or(cmp.Compare(a.Date, b.Date), cmp.Compare(a.Instrument, b.Instrument))
	})

	want := []row{
		{"NTNF.20290101", "2026-07-01", "interest", 9762, false},
		{"NTNB.20350515", "2026-11-16", "interest", 0, true},
		{"LTN.20270101", "2027-01-04", "maturity", 200000, false},
		{"NTNF.20290101", "2027-01-04", "interest", 9762, false},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("events = %+v, want %+v", got, want)
	}
}

// S633 (coverage rows T-06, T-07): an RendA+ returns its principal in 240 monthly payments on the
// 15th, the last on its maturity; each amortizes one part in the payments left of the units held,
// without amount while the IPCA of its VNA is not stored.
func TestS633IncomeBondEvents(t *testing.T) {
	t.Parallel()

	f := newFixture(t, apitest.Today("2026-06-15"))
	code := "RENDA.20491215"
	f.h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": code, "type": "fixed_income", "scale": 2, "name": code, "quote_currency": "BRL",
	}, http.StatusCreated, nil)

	account := f.h.Account(code, "asset", "brokerage", map[string]any{
		"institution_id": f.institution, "parent_id": f.xp, "currency": code,
	})
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id": account, "cash_account_id": f.cash, "side": "buy", "date": "2026-01-12",
		"quantity": units(24000, code), "unit_price": "1.00",
	}, http.StatusCreated, nil)
	f.h.Dispatch()

	var out struct {
		Items []eventOut `json:"items"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/fixed-income-events?from=2030-01-01&to=2030-03-31",
		nil,
		http.StatusOK,
		&out,
	)

	want := []eventRow{
		{"2030-01-15", "amortization", 100, 0, "upcoming"},
		{"2030-02-15", "amortization", 100, 0, "upcoming"},
		{"2030-03-15", "amortization", 100, 0, "upcoming"},
	}
	if got := rowsOf(out.Items); !reflect.DeepEqual(got, want) {
		t.Fatalf("events = %+v, want %+v", got, want)
	}

	for _, e := range out.Items {
		if !e.RateMissing {
			t.Errorf("event %+v has an amount, want rate_missing", e)
		}
	}
}

// S640 (coverage row T-05): the coupon of an NTN-B is its VNA on the 15th, 1,000.00 times the IPCA
// numbers of the IBGE from June 2000 to the month before, times 0.02956301, truncated to 6
// decimals (Tesouro Nacional, Metodologia de Cálculo, the example of 2008-05-15: 51.053144).
func TestS640NTNBCouponFromTheIPCA(t *testing.T) {
	t.Parallel()

	// June 2000 and October 2026 carry the numbers of the example; the months between hold June's.
	var levels []string
	for m := time.Date(2000, time.June, 1, 0, 0, 0, 0, time.UTC); m.Before(
		time.Date(2026, time.October, 1, 0, 0, 0, 0, time.UTC),
	); m = m.AddDate(0, 1, 0) {
		levels = append(levels, fmt.Sprintf(`{"V":"1614.62","D3C":%q}`, m.Format("200601")))
	}

	levels = append(levels, `{"V":"2788.33","D3C":"202610"}`)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		first, last, _ := strings.Cut(r.URL.Path[strings.LastIndex(r.URL.Path, "/")+1:], "-")
		out := []string{`{"V":"Valor","D3C":"Mês (Código)"}`}
		for _, l := range levels {
			if m := l[len(l)-8 : len(l)-2]; m >= first && m <= last {
				out = append(out, l)
			}
		}
		fmt.Fprintf(w, "[%s]", strings.Join(out, ","))
	}))
	t.Cleanup(srv.Close)

	f := newFixture(
		t,
		apitest.Today("2026-11-20"),
		apitest.IndexFeeds([]string{"br_ipca"}, map[string]string{"br_ipca": srv.URL}),
	)
	f.h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "NTNB.20350515", "type": "fixed_income", "scale": 2, "name": "NTNB 2035",
		"quote_currency": "BRL",
	}, http.StatusCreated, nil)

	account := f.h.Account("NTNB", "asset", "brokerage", map[string]any{
		"institution_id": f.institution, "parent_id": f.xp, "currency": "NTNB.20350515",
	})
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id": account, "cash_account_id": f.cash, "side": "buy", "date": "2026-01-12",
		"quantity": units(200, "NTNB.20350515"), "unit_price": "900.00",
	}, http.StatusCreated, nil)
	f.h.App.Marketdata.TickFeeds(t.Context())
	f.h.Dispatch()

	var out struct {
		Items []eventOut `json:"items"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/fixed-income-events?from=2026-11-01&to=2026-11-30",
		nil,
		http.StatusOK,
		&out,
	)

	// 2.00 units × 51.053144 = 102.106288.
	want := []eventRow{{"2026-11-16", "interest", 200, 10211, "due"}}
	if got := rowsOf(out.Items); !reflect.DeepEqual(got, want) {
		t.Fatalf("events = %+v, want %+v", got, want)
	}
}

// S641 (coverage rows T-08, T-01): the coupon of the NTN-C of 2031 is 12% a year on its VNA by the
// IGP-M of SGS series 28655, 1.12^½ − 1 = 0.05830052; an LFT pays at maturity its VNA by the Selic
// of each business day from 2000-07-01 (Tesouro Nacional, Metodologia de Cálculo).
func TestS641NTNCAndLFTFromTheirIndexes(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name, code, feed, today, from, to string
		series                            int
		rates                             [][2]string
		want                              eventRow
	}{
		{
			// 1,000.00 × 2.102805518521 = 2,102.805518; × 0.05830052 = 122.594655 a unit.
			"NTN-C 2031", "NTNC.20310101", "br_igpm", "2026-07-05", "2026-06-15", "2026-07-31",
			28655, monthlyRates(
				time.Date(2000, time.July, 1, 0, 0, 0, 0, time.UTC),
				time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC),
				"110.2805518521",
			), eventRow{"2026-07-01", "interest", 200, 24519, "due"},
		},
		{
			// 1,000.00 × 1.0007^21 = 1,014.803357 at the maturity of 2000-08-01.
			"LFT", "LFT.20000801", "br_selic", "2000-08-02", "2000-07-15", "2000-08-15",
			11, weekdayRates(
				time.Date(2000, time.July, 3, 0, 0, 0, 0, time.UTC),
				time.Date(2000, time.July, 31, 0, 0, 0, 0, time.UTC),
				"0.07",
			), eventRow{"2000-08-01", "maturity", 100, 101480, "due"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			srv := httptest.NewServer(sgsSeries(tc.series, tc.rates))
			t.Cleanup(srv.Close)

			f := newFixture(
				t,
				apitest.Today(tc.today),
				apitest.IndexFeeds([]string{tc.feed}, map[string]string{tc.feed: srv.URL}),
			)
			f.h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
				"code": tc.code, "type": "fixed_income", "scale": 2, "name": tc.code,
				"quote_currency": "BRL",
			}, http.StatusCreated, nil)

			account := f.h.Account(tc.code, "asset", "brokerage", map[string]any{
				"institution_id": f.institution, "parent_id": f.xp, "currency": tc.code,
			})
			bought := time.Date(2000, time.July, 10, 0, 0, 0, 0, time.UTC).Format(time.DateOnly)
			if tc.series == 28655 {
				bought = "2026-01-12"
			}

			f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
				"account_id": account, "cash_account_id": f.cash, "side": "buy", "date": bought,
				"quantity": units(tc.want.Quantity, tc.code), "unit_price": "900.00",
			}, http.StatusCreated, nil)
			f.h.App.Marketdata.TickFeeds(t.Context())
			f.h.Dispatch()

			var out struct {
				Items []eventOut `json:"items"`
			}
			f.h.MustDo(
				http.MethodGet,
				"/api/v1/fixed-income-events?from="+tc.from+"&to="+tc.to,
				nil,
				http.StatusOK,
				&out,
			)

			if got := rowsOf(out.Items); !reflect.DeepEqual(got, []eventRow{tc.want}) {
				t.Fatalf("events = %+v, want %+v", got, tc.want)
			}
		})
	}
}

// monthlyRates are the percents of the months from first to last: value for the first, 0 after.
func monthlyRates(first, last time.Time, value string) [][2]string {
	var out [][2]string
	for m := first; !m.After(last); m = m.AddDate(0, 1, 0) {
		v := "0"
		if m.Equal(first) {
			v = value
		}

		out = append(out, [2]string{m.Format("02/01/2006"), v})
	}

	return out
}

// weekdayRates are value percent on each weekday from first to last.
func weekdayRates(first, last time.Time, value string) [][2]string {
	var out [][2]string
	for d := first; !d.After(last); d = d.AddDate(0, 0, 1) {
		if d.Weekday() != time.Saturday && d.Weekday() != time.Sunday {
			out = append(out, [2]string{d.Format("02/01/2006"), value})
		}
	}

	return out
}

// sgsSeries answers the rows of one SGS series between dataInicial and dataFinal, 404 when none.
func sgsSeries(series int, rows [][2]string) http.Handler {
	path := fmt.Sprintf("/dados/serie/bcdata.sgs.%d/dados", series)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		from, _ := time.Parse("02/01/2006", r.URL.Query().Get("dataInicial"))
		to, _ := time.Parse("02/01/2006", r.URL.Query().Get("dataFinal"))

		var items []string
		for _, row := range rows {
			d, _ := time.Parse("02/01/2006", row[0])
			if r.URL.Path == path && !d.Before(from) && !d.After(to) {
				items = append(items, fmt.Sprintf(`{"data":%q,"valor":%q}`, row[0], row[1]))
			}
		}

		if len(items) == 0 {
			http.NotFound(w, r)

			return
		}

		fmt.Fprintf(w, "[%s]", strings.Join(items, ","))
	})
}
