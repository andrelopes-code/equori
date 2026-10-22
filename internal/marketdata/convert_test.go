package marketdata_test

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

func TestConvert(t *testing.T) {
	t.Parallel()
	md := marketdata.New(pgtest.New(t))
	ctx := t.Context()
	if _, err := md.DefineInstrument(ctx, marketdata.Instrument{Code: "MXRF11", Type: "fii", Scale: 0, Name: "Maxi Renda", QuoteCurrency: "BRL", Exchange: "B3"}); err != nil {
		t.Fatal(err)
	}
	price := func(instrument, quote money.Currency, date, value string) marketdata.Price {
		v, err := money.ParseRate(value)
		if err != nil {
			t.Fatal(err)
		}
		return marketdata.Price{Instrument: instrument, Quote: quote, Date: day(date), Value: v, Source: "manual"}
	}
	if err := md.RecordPrices(ctx, []marketdata.Price{
		price("USD", "BRL", "2026-10-30", "5.5"),
		price("MXRF11", "BRL", "2026-10-29", "9.36"),
	}); err != nil {
		t.Fatal(err)
	}
	amount := func(a int64, c money.Currency, scale int) money.Money {
		m, err := money.NewOf(a, c, scale)
		if err != nil {
			t.Fatal(err)
		}
		return m
	}
	tests := []struct {
		name   string
		q      money.Money
		to     money.Currency
		want   money.Money
		prices int
	}{
		{name: "same currency", q: amount(100, "BRL", 2), to: "BRL", want: amount(100, "BRL", 2)},
		{name: "direct", q: amount(100000, "USD", 2), to: "BRL", want: amount(550000, "BRL", 2), prices: 1},
		{name: "inverse", q: amount(275000, "BRL", 2), to: "USD", want: amount(50000, "USD", 2), prices: 1},
		{name: "through BRL", q: amount(100, "MXRF11", 0), to: "USD", want: amount(17018, "USD", 2), prices: 2},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := md.Convert(ctx, tt.q, tt.to, day("2026-11-01"))
			if err != nil {
				t.Fatal(err)
			}
			if got.Value != tt.want || len(got.Prices) != tt.prices {
				t.Fatalf("got %v with %d prices, want %v", got.Value, len(got.Prices), tt.want)
			}
		})
	}

	_, err := md.Convert(ctx, amount(100, "EUR", 2), "BRL", day("2026-11-01"))
	if !errors.Is(err, marketdata.ErrPriceMissing) || err.Error() != "price missing: EUR in BRL on 2026-11-01" {
		t.Fatalf("missing price err = %v", err)
	}
	if _, err := md.Convert(ctx, amount(100000, "USD", 2), "BRL", day("2026-10-29")); !errors.Is(err, marketdata.ErrPriceMissing) {
		t.Fatalf("price after the date used: err = %v", err)
	}
}

func intermediateModule(t *testing.T, prices map[string][]string) *marketdata.Module {
	t.Helper()
	h := apitest.New(t)
	for pair, entries := range prices {
		for _, e := range entries {
			date, value, _ := strings.Cut(e, "=")
			h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": pair[:3], "quote_instrument": pair[3:], "date": date, "value": value}, http.StatusCreated, nil)
		}
	}
	return marketdata.New(h.Pool)
}

func usd100(t *testing.T) money.Money {
	t.Helper()
	m, err := money.NewOf(10000, "USD", 2)
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func TestConvertThroughIntermediate(t *testing.T) {
	t.Parallel()
	md := intermediateModule(t, map[string][]string{"EURUSD": {"2026-10-01=1.10"}, "EURGBP": {"2026-10-01=0.85"}})
	got, err := md.Convert(t.Context(), usd100(t), "GBP", day("2026-10-02"))
	if err != nil {
		t.Fatal(err)
	}
	want, _ := money.NewOf(7727, "GBP", 2)
	if got.Value != want || len(got.Prices) != 2 {
		t.Fatalf("got %v with %d prices, want %v with 2", got.Value, len(got.Prices), want)
	}
}

func TestIntermediateChoice(t *testing.T) {
	t.Parallel()
	gbp := func(a int64) money.Money {
		m, _ := money.NewOf(a, "GBP", 2)
		return m
	}
	md := intermediateModule(t, map[string][]string{
		"EURUSD": {"2026-10-01=1.10"}, "EURGBP": {"2026-10-01=0.85"},
		"BRLUSD": {"2026-10-20=0.20"}, "BRLGBP": {"2026-10-20=0.15"},
	})
	got, err := md.Convert(t.Context(), usd100(t), "GBP", day("2026-10-21"))
	if err != nil {
		t.Fatal(err)
	}
	if got.Value != gbp(7500) || len(got.Prices) != 2 {
		t.Fatalf("newer intermediate: got %v, prices %+v", got.Value, got.Prices)
	}
	for _, p := range got.Prices {
		if p.Instrument != "BRL" && p.Quote != "BRL" {
			t.Fatalf("price %+v does not involve BRL", p)
		}
	}

	same := intermediateModule(t, map[string][]string{
		"EURUSD": {"2026-10-01=1.10"}, "EURGBP": {"2026-10-01=0.85"},
		"BRLUSD": {"2026-10-01=0.20"}, "BRLGBP": {"2026-10-01=0.15"},
	})
	got, err = same.Convert(t.Context(), usd100(t), "GBP", day("2026-10-02"))
	if err != nil {
		t.Fatal(err)
	}
	if got.Value != gbp(7500) {
		t.Fatalf("tie by code: got %v, want BRL path %v", got.Value, gbp(7500))
	}
}

// Review Focus 4: a stale leg does not block a conversion.
func TestIntermediateOldLeg(t *testing.T) {
	t.Parallel()
	md := intermediateModule(t, map[string][]string{"EURUSD": {"2026-03-16=1.10"}, "EURGBP": {"2026-10-02=0.85"}})
	got, err := md.Convert(t.Context(), usd100(t), "GBP", day("2026-10-02"))
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Prices) != 2 || got.Prices[0].Date != day("2026-03-16") || got.Prices[1].Date != day("2026-10-02") {
		t.Fatalf("prices = %+v", got.Prices)
	}
}

func TestNoPath(t *testing.T) {
	t.Parallel()
	md := marketdata.New(pgtest.New(t))
	if _, err := md.Convert(t.Context(), usd100(t), "GBP", day("2026-10-02")); !errors.Is(err, marketdata.ErrPriceMissing) {
		t.Fatalf("err = %v", err)
	}
}
