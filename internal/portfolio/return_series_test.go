package portfolio_test

import (
	"fmt"
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type seriesOut struct {
	From     string `json:"from"`
	To       string `json:"to"`
	Currency string `json:"currency"`
	Opening  int64  `json:"opening"`
	Points   []struct {
		Date     string `json:"date"`
		Value    int64  `json:"value"`
		Flows    int64  `json:"flows"`
		ReturnBP *int   `json:"return_bp"`
	} `json:"points"`
	Indexes []indexOut `json:"indexes"`
}

type indexOut struct {
	Index  string `json:"index"`
	Period string `json:"period"`
	Points []struct {
		Date     string `json:"date"`
		ReturnBP int    `json:"return_bp"`
	} `json:"points"`
}

// S393: the return of a brokerage as a series of step dates (portfolio results PS1 to PS6).
func TestS393ReturnSeriesByMonth(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.seedSeries(t)

	r, got := f.seriesOf(t, "from=2025-11-01&to=2026-10-31&step=month")
	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	dates := []string{
		"2025-11-30", "2025-12-31", "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30",
		"2026-05-31", "2026-06-30", "2026-07-31", "2026-08-31", "2026-09-30", "2026-10-31",
	}
	values := []int64{
		100000, 100000, 100000, 100000, 100000, 200000,
		200000, 200000, 200000, 200000, 200000, 205000,
	}
	flows := []int64{0, 0, 0, 0, 0, 100000, 0, 0, 0, 0, 0, 0}
	returns := []int{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 250}

	if got.From != "2025-11-01" || got.To != "2026-10-31" || got.Currency != "BRL" ||
		got.Opening != 100000 || got.Indexes == nil {
		t.Fatalf("series = %+v", got)
	}

	if !reflect.DeepEqual(got.shape(), shapeOf(dates, values, flows, returns)) {
		t.Fatalf("points = %+v", got.Points)
	}

	_, report := f.returnReportOf(t, "2025-11-01", "2026-10-31")
	if report.PeriodBP == nil || *report.PeriodBP != 250 {
		t.Fatalf("period_bp = %v", report.PeriodBP)
	}

	// Without from the period starts on the first posting of the tree.
	_, got = f.seriesOf(t, "to=2026-10-31&step=month")
	last := got.Points[len(got.Points)-1]

	if got.From != "2025-10-15" || got.Opening != 0 || len(got.Points) != 13 ||
		got.Points[0].Date != "2025-10-31" || got.Points[0].Value != 100000 ||
		got.Points[0].Flows != 100000 || got.Points[0].ReturnBP == nil ||
		*got.Points[0].ReturnBP != 0 || last.ReturnBP == nil || *last.ReturnBP != 250 {
		t.Fatalf("series without from = %+v", got)
	}

	_, got = f.seriesOf(t, "from=2026-10-01&to=2026-10-31&step=week")

	if got.Opening != 200000 ||
		!reflect.DeepEqual(got.shape(), shapeOf(
			[]string{"2026-10-03", "2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31"},
			[]int64{200000, 200000, 200000, 200000, 205000},
			[]int64{0, 0, 0, 0, 0},
			[]int{0, 0, 0, 0, 250},
		)) {
		t.Fatalf("weekly series = %+v", got)
	}

	_, got = f.seriesOf(t, "from=2026-10-25&to=2026-10-27&step=day")

	if !reflect.DeepEqual(got.shape(), shapeOf(
		[]string{"2026-10-25", "2026-10-26", "2026-10-27"},
		[]int64{200000, 205000, 205000},
		[]int64{0, 0, 0},
		[]int{0, 250, 250},
	)) {
		t.Fatalf("daily series = %+v", got)
	}
}

// S394: the indexes of the region beside the series: the CDI as one point per step date, the IPCA
// as one point per whole month, and none for another currency or a region without an index
// (portfolio results PS5, PS6).
func TestS394ReturnSeriesIndexes(t *testing.T) {
	t.Parallel()

	t.Run("daily index", func(t *testing.T) {
		t.Parallel()
		b := newBenchmarkBook(t)
		b.stockBrokerage(t, "27")

		got := b.series(t, "2026-01-02", "2026-01-09", "step=day")
		last := got.Points[len(got.Points)-1]

		if len(got.Points) != 8 || last.ReturnBP == nil || *last.ReturnBP != -1000 ||
			len(got.Indexes) != 1 {
			t.Fatalf("series = %+v", got)
		}

		dates, returns := got.Indexes[0].shape()
		wantDates := []string{
			"2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05",
			"2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09",
		}

		if got.Indexes[0].Index != "cdi" || got.Indexes[0].Period != "day" ||
			!reflect.DeepEqual(dates, wantDates) ||
			!reflect.DeepEqual(returns, []int{6, 6, 6, 11, 17, 22, 28, 33}) {
			t.Fatalf("indexes = %+v", got.Indexes)
		}
	})

	t.Run("monthly index", func(t *testing.T) {
		t.Parallel()
		b := newBenchmarkBookOn(t, "2025-10-01")

		got := b.series(t, "2025-11-01", "2026-01-09", "step=month")

		var monthly []indexOut
		for _, ix := range got.Indexes {
			if ix.Index == "ipca" {
				monthly = append(monthly, ix)
			}
		}

		if len(monthly) != 1 || monthly[0].Period != "month" {
			t.Fatalf("indexes = %+v", got.Indexes)
		}

		dates, returns := monthly[0].shape()
		if !reflect.DeepEqual(dates, []string{"2025-11-30", "2025-12-31"}) ||
			!reflect.DeepEqual(returns, []int{50, 90}) {
			t.Fatalf("ipca = %+v", monthly[0])
		}
	})

	t.Run("another currency", func(t *testing.T) {
		t.Parallel()
		b := newBenchmarkBookOn(t, "2025-11-01")
		b.addUSD(t)

		got := b.series(t, "2025-11-01", "2026-01-09", "step=month&value_in=USD")
		if len(got.Indexes) != 0 {
			t.Fatalf("indexes in USD = %+v", got.Indexes)
		}
	})

	t.Run("region without an index", func(t *testing.T) {
		t.Parallel()
		b := newBenchmarkBookOn(t, "2025-11-01")

		_, err := b.h.Pool.Exec(t.Context(), `UPDATE identity_books SET region = 'US'`)
		if err != nil {
			t.Fatal(err)
		}

		got := b.series(t, "2025-11-01", "2026-01-09", "step=month")
		if len(got.Indexes) != 0 {
			t.Fatalf("indexes in region US = %+v", got.Indexes)
		}
	})
}

func TestReturnSeriesRequestErrors(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	tests := []struct {
		name   string
		query  string
		status int
		code   string
	}{
		{"reversed", "from=2026-10-26&to=2026-10-25&step=day", 400, "invalid_request"},
		{"over 400 dates", "from=2025-01-01&to=2026-10-31&step=day", 400, "invalid_request"},
		{"unknown step", "from=2026-10-01&to=2026-10-31&step=year", 400, ""},
		{"no step", "from=2026-10-01&to=2026-10-31", 400, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r, _ := f.seriesOf(t, tt.query)
			if r.Status != tt.status {
				t.Fatalf("status %d, want %d: %s", r.Status, tt.status, r.Body)
			}

			if tt.code != "" {
				f.h.ExpectProblem(r, tt.status, tt.code, "")
			}
		})
	}

	stranger := f.h.Login("stranger@example.com")
	r := f.h.Call(
		stranger,
		http.MethodGet,
		"/api/v1/reports/return/series?account_id="+f.xp+"&from=2026-10-01&to=2026-10-31&step=day",
		nil,
	)
	f.h.ExpectProblem(r, http.StatusNotFound, "not_found", "")
}

func (b benchmarkBook) series(t *testing.T, from, to, query string) seriesOut {
	t.Helper()
	b.h.Dispatch()

	path := fmt.Sprintf(
		"/api/v1/reports/return/series?account_id=%s&from=%s&to=%s&%s",
		b.savings,
		from,
		to,
		query,
	)
	r := b.h.Do(http.MethodGet, path, nil)

	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	var out seriesOut
	r.Decode(t, &out)

	return out
}

// addUSD records the dollar and its price, as TestS309NoIndexForTheRegionOrCurrency does.
func (b benchmarkBook) addUSD(t *testing.T) {
	t.Helper()
	b.h.Do(
		http.MethodPost,
		"/api/v1/instruments",
		map[string]any{"code": "USD", "type": "currency", "scale": 2, "name": "Dollar"},
	)
	b.h.MustDo(
		http.MethodPost,
		"/api/v1/prices",
		map[string]any{
			"instrument":       "USD",
			"quote_instrument": "BRL",
			"date":             "2025-10-01",
			"value":            "5",
		},
		http.StatusCreated,
		nil,
	)
}

func (f fixture) seedSeries(t *testing.T) {
	t.Helper()

	checking := f.h.Account("Checking", "asset", "checking", nil)
	f.h.Record("2025-10-15", apitest.Posting(checking, -100000), apitest.Posting(f.cash, 100000))
	f.income(t, f.mxrf11, "dividend", 5000, f.dividends)
	f.h.Record("2026-04-30", apitest.Posting(checking, -100000), apitest.Posting(f.cash, 100000))
}

func (f fixture) seriesOf(t *testing.T, query string) (apitest.Response, seriesOut) {
	t.Helper()
	f.h.Dispatch()

	path := "/api/v1/reports/return/series?account_id=" + f.xp + "&value_in=BRL&" + query
	r := f.h.Do(http.MethodGet, path, nil)

	var out seriesOut
	if r.Status == http.StatusOK {
		r.Decode(t, &out)
	}

	return r, out
}

type reportOut struct {
	PeriodBP *int `json:"period_bp"`
}

func (f fixture) returnReportOf(t *testing.T, from, to string) (apitest.Response, reportOut) {
	t.Helper()

	path := fmt.Sprintf(
		"/api/v1/reports/return?account_id=%s&value_in=BRL&from=%s&to=%s",
		f.xp,
		from,
		to,
	)
	r := f.h.Do(http.MethodGet, path, nil)

	var out reportOut
	r.Decode(t, &out)

	return r, out
}

type pointShape struct {
	date  string
	value int64
	flows int64
	bp    int
}

func (ix indexOut) shape() ([]string, []int) {
	dates := make([]string, len(ix.Points))
	returns := make([]int, len(ix.Points))

	for i, p := range ix.Points {
		dates[i], returns[i] = p.Date, p.ReturnBP
	}

	return dates, returns
}

func (s seriesOut) shape() []pointShape {
	out := make([]pointShape, len(s.Points))
	for i, p := range s.Points {
		bp := -1
		if p.ReturnBP != nil {
			bp = *p.ReturnBP
		}

		out[i] = pointShape{p.Date, p.Value, p.Flows, bp}
	}

	return out
}

func shapeOf(dates []string, values, flows []int64, returns []int) []pointShape {
	out := make([]pointShape, len(dates))
	for i := range dates {
		out[i] = pointShape{dates[i], values[i], flows[i], returns[i]}
	}

	return out
}
