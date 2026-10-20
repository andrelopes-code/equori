package marketdata_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type priceAPI struct {
	Instrument      string `json:"instrument"`
	QuoteInstrument string `json:"quote_instrument"`
	Date            string `json:"date"`
	Value           string `json:"value"`
	Source          string `json:"source"`
}

func feedPrice(t *testing.T, source, date, value string) marketdata.Price {
	t.Helper()
	v, err := money.ParseRate(value)
	if err != nil {
		t.Fatal(err)
	}
	return marketdata.Price{Instrument: "USD", Quote: "BRL", Date: day(date), Value: v, Source: source}
}

// Review Focus 3: a manual price stays chosen when a feed records the same date again.
func TestManualPriceWinsOverFeed(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	md := marketdata.New(h.Pool)
	ctx := t.Context()

	if err := md.RecordPrices(ctx, []marketdata.Price{feedPrice(t, "bcb_ptax", "2026-10-30", "5.4950")}); err != nil {
		t.Fatal(err)
	}
	var created priceAPI
	h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "USD", "quote_instrument": "BRL", "date": "2026-10-30", "value": "5.5000"}, http.StatusCreated, &created)
	if created != (priceAPI{Instrument: "USD", QuoteInstrument: "BRL", Date: "2026-10-30", Value: "5.5", Source: "manual"}) {
		t.Fatalf("created = %+v", created)
	}
	if err := md.RecordPrices(ctx, []marketdata.Price{feedPrice(t, "bcb_ptax", "2026-10-30", "5.4960"), feedPrice(t, "bcb_ptax", "2026-10-29", "5.4800")}); err != nil {
		t.Fatal(err)
	}

	var list struct {
		Items []priceAPI `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/prices?instrument=USD&quote_instrument=BRL&from=2026-10-01&to=2026-10-31", nil, http.StatusOK, &list)
	want := []priceAPI{
		{Instrument: "USD", QuoteInstrument: "BRL", Date: "2026-10-29", Value: "5.48", Source: "bcb_ptax"},
		{Instrument: "USD", QuoteInstrument: "BRL", Date: "2026-10-30", Value: "5.5", Source: "manual"},
	}
	if len(list.Items) != 2 || list.Items[0] != want[0] || list.Items[1] != want[1] {
		t.Fatalf("prices = %+v", list.Items)
	}

	p, ok, err := md.PriceOnOrBefore(ctx, "USD", "BRL", day("2026-11-01"))
	if err != nil || !ok || !p.Date.Equal(day("2026-10-30")) || p.Value.String() != "5.5" || p.Source != "manual" {
		t.Fatalf("PriceOnOrBefore = %+v, %v, %v", p, ok, err)
	}
	if _, ok, err := md.PriceOnOrBefore(ctx, "USD", "BRL", day("2026-10-28")); err != nil || ok {
		t.Fatalf("price before the first = %v, %v", ok, err)
	}
}

func TestRecordPriceValidation(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	price := func(k, v string) map[string]any {
		in := map[string]any{"instrument": "USD", "quote_instrument": "BRL", "date": "2026-10-30", "value": "5.5"}
		in[k] = v
		return in
	}
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/prices", price("instrument", "PETR4")), http.StatusUnprocessableEntity, "validation_failed", "instrument")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/prices", price("quote_instrument", "USD")), http.StatusUnprocessableEntity, "validation_failed", "quote_instrument")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/prices", price("value", "0")), http.StatusUnprocessableEntity, "validation_failed", "value")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/prices", price("value", "5.4e1")), http.StatusUnprocessableEntity, "validation_failed", "value")
	// numeric(30,12) holds at most 18 integer digits.
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/prices", price("value", "1000000000000000000")), http.StatusUnprocessableEntity, "validation_failed", "value")
	h.MustDo(http.MethodPost, "/api/v1/prices", price("value", "999999999999999999"), http.StatusCreated, nil)
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/prices", price("quote_instrument", "MXRF11")), http.StatusUnprocessableEntity, "validation_failed", "quote_instrument")

	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/prices?instrument=USD&quote_instrument=BRL&from=2025-01-01&to=2026-02-04", nil), http.StatusUnprocessableEntity, "validation_failed", "to")
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/prices?instrument=USD&quote_instrument=BRL&from=2026-02-04&to=2026-02-03", nil), http.StatusUnprocessableEntity, "validation_failed", "to")
}

func TestImportPrices(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	bad := "instrument,quote_instrument,date,value\nMXRF11,BRL,2026-10-28,9.30\nMXRF11,BRL,2026-13-01,9.31\n"
	h.ExpectProblem(h.Upload("/api/v1/prices/import", "prices.csv", []byte(bad)), http.StatusUnprocessableEntity, "validation_failed", "line 3")
	header := "date,instrument,quote_instrument,value\n"
	h.ExpectProblem(h.Upload("/api/v1/prices/import", "prices.csv", []byte(header)), http.StatusUnprocessableEntity, "validation_failed", "line 1")
	unknown := "instrument,quote_instrument,date,value\nPETR4,BRL,2026-10-28,30.10\n"
	h.ExpectProblem(h.Upload("/api/v1/prices/import", "prices.csv", []byte(unknown)), http.StatusUnprocessableEntity, "validation_failed", "line 2")
	tooMany := "instrument,quote_instrument,date,value\n" + strings.Repeat("MXRF11,BRL,2026-10-28,9.30\n", 10001)
	h.ExpectProblem(h.Upload("/api/v1/prices/import", "prices.csv", []byte(tooMany)), http.StatusUnprocessableEntity, "validation_failed", "file")

	var none struct {
		Items []priceAPI `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/prices?instrument=MXRF11&quote_instrument=BRL&from=2026-10-01&to=2026-10-31", nil, http.StatusOK, &none)
	if len(none.Items) != 0 {
		t.Fatalf("a rejected file stored %+v", none.Items)
	}

	good := "instrument,quote_instrument,date,value\nMXRF11,BRL,2026-10-28,9.30\r\nMXRF11,BRL,2026-10-29,9.36\n"
	var out struct {
		Recorded int `json:"recorded"`
	}
	r := h.Upload("/api/v1/prices/import", "prices.csv", []byte(good))
	if r.Status != http.StatusOK {
		t.Fatalf("import status %d: %s", r.Status, r.Body)
	}
	r.Decode(t, &out)
	if out.Recorded != 2 {
		t.Fatalf("recorded = %d: %s", out.Recorded, r.Body)
	}
	var list struct {
		Items []priceAPI `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/prices?instrument=MXRF11&quote_instrument=BRL&from=2026-10-01&to=2026-10-31", nil, http.StatusOK, &list)
	if len(list.Items) != 2 || list.Items[1] != (priceAPI{Instrument: "MXRF11", QuoteInstrument: "BRL", Date: "2026-10-29", Value: "9.36", Source: "csv"}) {
		t.Fatalf("prices = %+v", list.Items)
	}
}
