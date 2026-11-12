package marketdata_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const quotesPath = "/api/v1/instrument-quotes?base=BRL"

type quotePointAPI struct {
	Date  string `json:"date"`
	Value string `json:"value"`
}

type instrumentQuoteAPI struct {
	Instrument      string         `json:"instrument"`
	QuoteInstrument string         `json:"quote_instrument"`
	Last            *quotePointAPI `json:"last"`
	References      struct {
		Week       *quotePointAPI `json:"week"`
		Month      *quotePointAPI `json:"month"`
		Quarter    *quotePointAPI `json:"quarter"`
		Year       *quotePointAPI `json:"year"`
		YearToDate *quotePointAPI `json:"year_to_date"`
	} `json:"references"`
}

// IQ2 to IQ5: the references count back from the date of the last price of each instrument, each
// the latest price on or before its date. For FULL1 the last price is 2026-11-11, so they are
// 2026-11-04, 2026-10-11, 2026-08-11, 2025-11-11 and 2025-12-31.
func TestInstrumentQuotes(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-12"))
	defineQuoted(t, h, "FULL1", "BRL")
	defineQuoted(t, h, "SHORT", "BRL")
	defineQuoted(t, h, "STALE", "BRL")
	defineQuoted(t, h, "EMPTY", "BRL")
	defineQuoted(t, h, "CLAMP", "BRL")
	defineQuoted(t, h, "PRIOR", "BRL")
	record(t, h, "FULL1", "BRL", "manual",
		"2025-11-10", "10.00",
		"2025-12-30", "11.00",
		"2026-08-11", "12.00",
		"2026-10-09", "13.00",
		"2026-11-04", "14.00",
		"2026-11-11", "15.00",
	)
	record(t, h, "SHORT", "BRL", "manual", "2026-11-01", "5.00", "2026-11-11", "6.00")
	record(t, h, "STALE", "BRL", "manual", "2025-06-01", "7.00", "2026-10-03", "8.00")
	record(
		t,
		h,
		"CLAMP",
		"BRL",
		"manual",
		"2026-02-28",
		"3.00",
		"2026-03-01",
		"4.00",
		"2026-03-31",
		"5.00",
	)
	record(t, h, "PRIOR", "BRL", "manual", "2025-12-10", "8.00", "2025-12-20", "9.00")
	record(t, h, "USD", "BRL", "csv", "2026-11-11", "5.41")
	record(t, h, "USD", "BRL", "manual", "2026-11-11", "5.40", "2026-11-04", "5.30")

	got := quotesByInstrument(t, h)

	full := got["FULL1"]
	assertPoint(t, "FULL1 last", full.Last, "2026-11-11", "15")
	assertPoint(t, "FULL1 week", full.References.Week, "2026-11-04", "14")
	assertPoint(t, "FULL1 month", full.References.Month, "2026-10-09", "13")
	assertPoint(t, "FULL1 quarter", full.References.Quarter, "2026-08-11", "12")
	assertPoint(t, "FULL1 year", full.References.Year, "2025-11-10", "10")
	assertPoint(t, "FULL1 year to date", full.References.YearToDate, "2025-12-30", "11")

	short := got["SHORT"]
	assertPoint(t, "SHORT last", short.Last, "2026-11-11", "6")
	assertPoint(t, "SHORT week", short.References.Week, "2026-11-01", "5")
	assertPoint(t, "SHORT month", short.References.Month, "", "")
	assertPoint(t, "SHORT quarter", short.References.Quarter, "", "")
	assertPoint(t, "SHORT year", short.References.Year, "", "")
	assertPoint(t, "SHORT year to date", short.References.YearToDate, "", "")

	// IQ4: a stale instrument still reads a full window that ends at its last price.
	stale := got["STALE"]
	assertPoint(t, "STALE last", stale.Last, "2026-10-03", "8")
	assertPoint(t, "STALE week", stale.References.Week, "2025-06-01", "7")
	assertPoint(t, "STALE month", stale.References.Month, "2025-06-01", "7")
	assertPoint(t, "STALE quarter", stale.References.Quarter, "2025-06-01", "7")
	assertPoint(t, "STALE year", stale.References.Year, "2025-06-01", "7")
	assertPoint(t, "STALE year to date", stale.References.YearToDate, "2025-06-01", "7")

	// IQ4: 31 March minus 1 month is 28 February, not 3 March.
	clamp := got["CLAMP"]
	assertPoint(t, "CLAMP last", clamp.Last, "2026-03-31", "5")
	assertPoint(t, "CLAMP week", clamp.References.Week, "2026-03-01", "4")
	assertPoint(t, "CLAMP month", clamp.References.Month, "2026-02-28", "3")

	// IQ4: a last price of a previous year gives no year to date.
	prior := got["PRIOR"]
	assertPoint(t, "PRIOR week", prior.References.Week, "2025-12-10", "8")
	assertPoint(t, "PRIOR year to date", prior.References.YearToDate, "", "")

	empty := got["EMPTY"]
	if empty.Instrument != "EMPTY" || empty.QuoteInstrument != "BRL" || empty.Last != nil {
		t.Fatalf("EMPTY = %+v", empty)
	}

	// C3: a currency is quoted in the base; IQ3: the manual price outranks the csv price.
	usd := got["USD"]
	if usd.QuoteInstrument != "BRL" {
		t.Fatalf("USD quote = %q", usd.QuoteInstrument)
	}

	assertPoint(t, "USD last", usd.Last, "2026-11-11", "5.4")
	assertPoint(t, "USD week", usd.References.Week, "2026-11-04", "5.3")

	if _, ok := got["BRL"]; ok {
		t.Fatal("the base currency has an item")
	}
}

// C3 and X2: a security quoted in USD keeps its quote when the base is BRL.
func TestInstrumentQuotesForeignQuote(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-12"))
	defineQuoted(t, h, "AAPL", "USD")
	record(t, h, "AAPL", "USD", "manual", "2026-11-04", "200.00", "2026-11-11", "210.00")

	got := quotesByInstrument(t, h)["AAPL"]
	if got.QuoteInstrument != "USD" {
		t.Fatalf("quote = %q, want USD", got.QuoteInstrument)
	}

	assertPoint(t, "AAPL last", got.Last, "2026-11-11", "210")
	assertPoint(t, "AAPL week", got.References.Week, "2026-11-04", "200")
}

func TestInstrumentQuotesAccess(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-12"))

	h.ExpectProblem(
		h.Do(http.MethodGet, "/api/v1/instrument-quotes?base=ZZZ", nil),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"base",
	)

	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")
	if r := h.Call(reader, http.MethodGet, quotesPath, nil); r.Status != http.StatusOK {
		t.Fatalf("reader status = %d: %s", r.Status, r.Body)
	}

	h.ExpectProblem(
		h.Call(&http.Client{}, http.MethodGet, quotesPath, nil),
		http.StatusUnauthorized,
		"unauthenticated",
		"",
	)
}

func defineQuoted(t *testing.T, h *apitest.Harness, code, quote string) {
	t.Helper()

	in := mxrf11()
	in["code"] = code
	in["quote_currency"] = quote
	h.MustDo(http.MethodPost, "/api/v1/instruments", in, http.StatusCreated, nil)
}

// record stores a series of (date, value) pairs from one source.
func record(t *testing.T, h *apitest.Harness, instrument, quote, source string, pairs ...string) {
	t.Helper()

	prices := make([]marketdata.Price, 0, len(pairs)/2)

	for i := 0; i < len(pairs); i += 2 {
		value, err := money.ParseRate(pairs[i+1])
		if err != nil {
			t.Fatal(err)
		}

		prices = append(prices, marketdata.Price{
			Instrument: money.Currency(instrument),
			Quote:      money.Currency(quote),
			Date:       day(pairs[i]),
			Value:      value,
			Source:     source,
		})
	}

	if err := marketdata.New(h.Pool).RecordPrices(t.Context(), prices); err != nil {
		t.Fatal(err)
	}
}

func quotesByInstrument(t *testing.T, h *apitest.Harness) map[string]instrumentQuoteAPI {
	t.Helper()

	var list struct {
		Items []instrumentQuoteAPI `json:"items"`
	}
	h.MustDo(http.MethodGet, quotesPath, nil, http.StatusOK, &list)

	out := make(map[string]instrumentQuoteAPI, len(list.Items))
	for _, item := range list.Items {
		out[item.Instrument] = item
	}

	return out
}

// assertPoint checks a price point; an empty date states that the point is null.
func assertPoint(t *testing.T, name string, got *quotePointAPI, date, value string) {
	t.Helper()

	if date == "" {
		if got != nil {
			t.Fatalf("%s = %+v, want null", name, *got)
		}

		return
	}

	if got == nil || *got != (quotePointAPI{Date: date, Value: value}) {
		t.Fatalf("%s = %+v, want %s %s", name, got, date, value)
	}
}
