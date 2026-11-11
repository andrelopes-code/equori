package marketdata_test

import (
	"net/http"
	"reflect"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
)

const instrumentPricesPath = "/api/v1/instruments/MXRF11/prices"

type priceCountsAPI struct {
	New       int `json:"new"`
	Replaced  int `json:"replaced"`
	Unchanged int `json:"unchanged"`
	BelowFeed int `json:"below_feed"`
}

// S370: a series is counted, then stored as source csv, and the same series changes nothing (MQ32).
func TestS370InstrumentPrices(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-11-09"))
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	seed := "instrument,quote_instrument,date,value\nMXRF11,BRL,2026-11-02,9.00\nMXRF11,BRL,2026-11-03,9.02\n"
	if r := h.Upload("/api/v1/prices/import", "p.csv", []byte(seed)); r.Status != http.StatusOK {
		t.Fatalf("seed status = %d: %s", r.Status, r.Body)
	}

	feed := feedPrice(t, "b3_consolidated", "2026-11-04", "9.05")
	feed.Instrument = "MXRF11"

	if err := h.App.Marketdata.RecordPrices(t.Context(), []marketdata.Price{feed}); err != nil {
		t.Fatal(err)
	}

	series := instrumentSeries(nil)
	dryRun := instrumentSeries(map[string]any{"dry_run": true})

	tests := []struct {
		name   string
		body   map[string]any
		counts priceCountsAPI
		prices []priceAPI
	}{
		{
			"dry run", dryRun, priceCountsAPI{New: 3, Replaced: 1, Unchanged: 1, BelowFeed: 1},
			[]priceAPI{
				csvPrice("2026-11-02", "9"), csvPrice("2026-11-03", "9.02"),
				{"MXRF11", "BRL", "2026-11-04", "9.05", "b3_consolidated"},
			},
		},
		{
			"stored", series, priceCountsAPI{New: 3, Replaced: 1, Unchanged: 1, BelowFeed: 1},
			[]priceAPI{
				csvPrice("2026-11-02", "9.1"), csvPrice("2026-11-03", "9.02"),
				csvPrice("2026-11-04", "9.06"), csvPrice("2026-11-05", "9.07"),
				csvPrice("2026-11-06", "9.08"),
			},
		},
		{
			"again", series, priceCountsAPI{Unchanged: 5, BelowFeed: 1},
			[]priceAPI{
				csvPrice("2026-11-02", "9.1"), csvPrice("2026-11-03", "9.02"),
				csvPrice("2026-11-04", "9.06"), csvPrice("2026-11-05", "9.07"),
				csvPrice("2026-11-06", "9.08"),
			},
		},
	}

	for _, tt := range tests {
		var got priceCountsAPI
		h.MustDo(http.MethodPost, instrumentPricesPath, tt.body, http.StatusOK, &got)

		if got != tt.counts {
			t.Fatalf("%s: counts = %+v, want %+v", tt.name, got, tt.counts)
		}

		if prices := pricesOf(t, h, "MXRF11"); !reflect.DeepEqual(prices, tt.prices) {
			t.Fatalf("%s: prices = %+v, want %+v", tt.name, prices, tt.prices)
		}
	}
}

// S371: an invalid series, an unknown instrument or a bad quote stores nothing (MQ32).
func TestS371InstrumentPricesRejected(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-11-09"))
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	point := func(date, value string) map[string]any { return map[string]any{"date": date, "value": value} }
	valid := []any{point("2026-11-02", "9.10")}

	tests := []struct {
		name   string
		path   string
		body   map[string]any
		status int
		code   string
		field  string
	}{
		{
			"zero value", instrumentPricesPath,
			instrumentSeriesOf([]any{point("2026-11-02", "9.10"), point("2026-11-03", "9.02"), point("2026-11-04", "0")}),
			http.StatusUnprocessableEntity, "validation_failed", "prices[2]",
		},
		{
			"repeated date", instrumentPricesPath,
			instrumentSeriesOf([]any{point("2026-11-02", "9.10"), point("2026-11-02", "9.11")}),
			http.StatusUnprocessableEntity, "validation_failed", "prices[1]",
		},
		{
			"quote is the instrument", instrumentPricesPath,
			map[string]any{"quote_instrument": "MXRF11", "prices": valid},
			http.StatusUnprocessableEntity, "validation_failed", "quote_instrument",
		},
		{
			"empty series", instrumentPricesPath, instrumentSeriesOf([]any{}),
			http.StatusBadRequest, "invalid_request", "",
		},
		{
			"unknown instrument", "/api/v1/instruments/NOPE/prices", instrumentSeriesOf(valid),
			http.StatusNotFound, "not_found", "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h.ExpectProblem(h.Do(http.MethodPost, tt.path, tt.body), tt.status, tt.code, tt.field)
		})
	}

	if prices := pricesOf(t, h, "MXRF11"); len(prices) != 0 {
		t.Fatalf("prices = %+v, want none", prices)
	}
}

func TestInstrumentPricesRoles(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-11-09"))
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	body := instrumentSeries(nil)

	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")
	h.ExpectProblem(h.Call(reader, http.MethodPost, instrumentPricesPath, body),
		http.StatusForbidden, "book_role_required", "")

	writer := h.JoinAs("writer@example.com", h.OwnerID(), "write")
	if r := h.Call(writer, http.MethodPost, instrumentPricesPath, body); r.Status != http.StatusOK {
		t.Fatalf("writer status = %d: %s", r.Status, r.Body)
	}

	h.ExpectProblem(h.Call(&http.Client{}, http.MethodPost, instrumentPricesPath, body),
		http.StatusUnauthorized, "unauthenticated", "")
}

// 20,000 prices of 12 decimals pass the body limit of the operation (D18).
func TestInstrumentPricesBodyLimit(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-11-09"))
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	const n = 20000

	points := make([]any, n)
	date := time.Date(1960, 1, 1, 0, 0, 0, 0, time.UTC)

	for i := range points {
		points[i] = map[string]any{"date": date.AddDate(0, 0, i).Format(time.DateOnly), "value": "1234567.123456789012"}
	}

	var got priceCountsAPI
	h.MustDo(http.MethodPost, instrumentPricesPath,
		map[string]any{"quote_instrument": "BRL", "prices": points, "dry_run": true}, http.StatusOK, &got)

	if got != (priceCountsAPI{New: n}) {
		t.Fatalf("counts = %+v, want %d new", got, n)
	}
}

func instrumentSeries(extra map[string]any) map[string]any {
	body := instrumentSeriesOf([]any{
		map[string]any{"date": "2026-11-02", "value": "9.10"},
		map[string]any{"date": "2026-11-03", "value": "9.02"},
		map[string]any{"date": "2026-11-04", "value": "9.06"},
		map[string]any{"date": "2026-11-05", "value": "9.07"},
		map[string]any{"date": "2026-11-06", "value": "9.08"},
	})

	for k, v := range extra {
		body[k] = v
	}

	return body
}

func instrumentSeriesOf(points []any) map[string]any {
	return map[string]any{"quote_instrument": "BRL", "prices": points}
}

func csvPrice(date, value string) priceAPI {
	return priceAPI{Instrument: "MXRF11", QuoteInstrument: "BRL", Date: date, Value: value, Source: "csv"}
}
