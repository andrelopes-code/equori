package marketdata_test

import (
	"errors"
	"testing"

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
