package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// execSQL runs one statement on the database of h.
func execSQL(t *testing.T, h *apitest.Harness, sql string) {
	t.Helper()

	if _, err := h.Pool.Exec(t.Context(), sql); err != nil {
		t.Fatal(err)
	}
}

// S701: the first tick over a store that was never read whole reads it whole: the hole of
// 2026-01-06 is filled, the wrong rate of 2026-01-05 takes the value of the source and the log
// names the revision (A265 RI1, RI2).
func TestIndexWholeReadRepairsHolesAndRevisions(t *testing.T) {
	t.Parallel()

	s := &sgsServer{cdi: cdiWeek}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(
		t,
		apitest.Today("2026-01-09"),
		apitest.IndexFeeds([]string{"br_cdi"}, indexURLs(srv)),
	)

	execSQL(t, h, `INSERT INTO marketdata_index_rate (index_id, date, rate, source) VALUES
		('cdi', '2006-01-09', 0.00055131, 'br_cdi'),
		('cdi', '2026-01-02', 0.00055131, 'br_cdi'),
		('cdi', '2026-01-05', 0.001, 'br_cdi'),
		('cdi', '2026-01-07', 0.00055131, 'br_cdi'),
		('cdi', '2026-01-08', 0.00055131, 'br_cdi'),
		('cdi', '2026-01-09', 0.00055131, 'br_cdi')`)

	h.App.Marketdata.TickFeeds(t.Context())

	got := indexRates(t, h, "cdi")
	if len(got) != 7 || got[2] != (indexRateRow{"2026-01-05", "0.000551310000", "br_cdi"}) ||
		got[3] != (indexRateRow{"2026-01-06", "0.000551310000", "br_cdi"}) {
		t.Fatalf("cdi = %+v, want 2026-01-05 revised and 2026-01-06 filled", got)
	}

	logs := h.Logs()
	for _, want := range []string{"index revised", "index=cdi", "rates=2", "from=2026-01-05"} {
		if !strings.Contains(logs, want) {
			t.Errorf("logs have no %q: %s", want, logs)
		}
	}
}

// S701: a hole left after a whole read is asked again on the next day, not on the same day, and an
// index without a hole is read whole again after 7 days (RI1).
func TestIndexWholeReadSchedule(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		rates     [][2]string
		checkedOn string
		want      bool
	}{
		"hole, read whole today":            {cdiWeek[:3], "2026-01-09", false},
		"hole, read whole yesterday":        {cdiWeek[:3], "2026-01-08", true},
		"complete, read whole 6 days ago":   {cdiWeek, "2026-01-03", false},
		"complete, read whole 7 days ago":   {cdiWeek, "2026-01-02", true},
		"complete, whole read of less time": {cdiWeek, "", true},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			s := &sgsServer{cdi: cdiWeek}
			srv := httptest.NewServer(s)
			t.Cleanup(srv.Close)
			h := apitest.New(
				t,
				apitest.Today("2026-01-09"),
				apitest.IndexFeeds([]string{"br_cdi"}, indexURLs(srv)),
			)

			execSQL(t, h, `INSERT INTO marketdata_index_rate (index_id, date, rate, source) VALUES
				('cdi', '2026-01-09', 0.00055131, 'br_cdi')`)

			for _, r := range tt.rates {
				execSQL(t, h, `INSERT INTO marketdata_index_rate (index_id, date, rate, source)
					VALUES ('cdi', to_date('`+r[0]+`', 'DD/MM/YYYY'), 0.00055131, 'br_cdi')
					ON CONFLICT DO NOTHING`)
			}

			from, on := "2006-01-09", tt.checkedOn
			if on == "" {
				from, on = "2007-01-01", "2026-01-09"
			}

			missing := "0"
			if len(tt.rates) == 3 {
				missing = "2"
			}

			execSQL(t, h, `INSERT INTO marketdata_index_check VALUES
				('cdi', '`+from+`', '`+on+`', `+missing+`)`)

			h.App.Marketdata.TickFeeds(t.Context())

			whole := strings.Contains(strings.Join(s.take(), " "), "dataInicial=09%2F01%2F2006")
			if whole != tt.want {
				t.Errorf("whole read = %v, want %v", whole, tt.want)
			}
		})
	}
}

// S701: a fill back that fails after its first window is completed by the next tick (RI1).
func TestIndexFillBackResumesAfterAFailure(t *testing.T) {
	t.Parallel()

	s := &sgsServer{cdi: append(
		[][2]string{{"09/01/2006", "0.06"}, {"04/01/2016", "0.05"}},
		cdiWeek...,
	)}
	broken := true
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if broken && strings.HasSuffix(r.URL.Query().Get("dataInicial"), "/2011") {
			http.Error(w, "busy", http.StatusServiceUnavailable)
			return
		}

		s.ServeHTTP(w, r)
	}))
	t.Cleanup(srv.Close)
	h := apitest.New(
		t,
		apitest.Today("2026-01-09"),
		apitest.IndexFeeds([]string{"br_cdi"}, indexURLs(srv)),
	)

	execSQL(t, h, `INSERT INTO marketdata_index_rate (index_id, date, rate, source)
		VALUES ('cdi', '2026-01-02', 0.00055131, 'br_cdi')`)

	h.App.Marketdata.TickFeeds(t.Context())

	if got := indexRates(t, h, "cdi"); len(got) != 2 {
		t.Fatalf("cdi after the failed fill back = %+v, want 2006-01-09 and 2026-01-02", got)
	}

	broken = false

	h.App.Marketdata.TickFeeds(t.Context())

	if got := indexRates(t, h, "cdi"); len(got) != 8 || got[1].Date != "2016-01-04" {
		t.Fatalf("cdi = %+v, want 2016-01-04 and the week stored", got)
	}
}

// S702: the accrued prices of a security over a revised rate are computed again (RI2).
func TestRevisedRateRecomputesTheAccrual(t *testing.T) {
	t.Parallel()

	s := &sgsServer{cdi: cdiWeek}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	h := apitest.New(
		t,
		apitest.Today("2026-01-09"),
		apitest.IndexFeeds([]string{"br_cdi"}, indexURLs(srv)),
	)

	execSQL(
		t,
		h,
		`INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency)
		VALUES ('CDBREV', 'fixed_income', 2, 'CDB', 'BRL')`,
	)
	execSQL(t, h, `INSERT INTO marketdata_fixed_income_terms
		(instrument_code, issued_on, matures_on, face_value, index_id, percent_of_index_bp, spread_bp, day_count)
		VALUES ('CDBREV', '2026-01-02', '2027-01-04', 100000, 'cdi', 10000, 0, 'bus252')`)

	h.App.Marketdata.TickFeeds(t.Context())

	price := func() string {
		var v string
		if err := h.Pool.QueryRow(t.Context(), `SELECT value::text FROM marketdata_price
			WHERE instrument = 'CDBREV' AND date = '2026-01-07'`).Scan(&v); err != nil {
			t.Fatal(err)
		}

		return v
	}

	before := price()

	execSQL(
		t,
		h,
		`UPDATE marketdata_index_rate SET rate = 0.01 WHERE index_id = 'cdi' AND date = '2026-01-05'`,
	)
	execSQL(
		t,
		h,
		`DELETE FROM marketdata_price WHERE instrument = 'CDBREV' AND date > '2026-01-02'`,
	)
	h.App.Marketdata.TickFeeds(t.Context())

	if price() == before {
		t.Fatal("the wrong rate changed no price: the test has no signal")
	}

	execSQL(t, h, `DELETE FROM marketdata_index_check`)
	h.App.Marketdata.TickFeeds(t.Context())

	if got := price(); got != before {
		t.Errorf(
			"price of 2026-01-07 = %s, want %s, the price over the rate of the source",
			got,
			before,
		)
	}
}
