package money

import (
	"errors"
	"testing"
)

func mustNew(t *testing.T, amount int64, c Currency) Money {
	t.Helper()
	m, err := New(amount, c)
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func TestNew(t *testing.T) {
	tests := []struct {
		name     string
		amount   int64
		currency Currency
		want     error
	}{
		{name: "valid", amount: 1234, currency: "BRL"},
		{name: "max", amount: MaxAmount, currency: "BRL"},
		{name: "min", amount: -MaxAmount, currency: "BRL"},
		{name: "above max", amount: MaxAmount + 1, currency: "BRL", want: ErrOutOfRange},
		{name: "below min", amount: -MaxAmount - 1, currency: "BRL", want: ErrOutOfRange},
		{name: "unknown currency", amount: 1, currency: "XYZ", want: ErrUnknownCurrency},
		{name: "lowercase currency", amount: 1, currency: "brl", want: ErrUnknownCurrency},
		{name: "empty currency", amount: 1, currency: "", want: ErrUnknownCurrency},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m, err := New(tt.amount, tt.currency)
			if !errors.Is(err, tt.want) {
				t.Fatalf("err = %v, want %v", err, tt.want)
			}
			if err == nil && (m.Amount() != tt.amount || m.Currency() != tt.currency) {
				t.Fatalf("got %v", m)
			}
		})
	}
}

func TestArithmetic(t *testing.T) {
	a := mustNew(t, 1000, "BRL")
	b := mustNew(t, 250, "BRL")

	if sum, err := a.Add(b); err != nil || sum.Amount() != 1250 {
		t.Fatalf("Add = %v, %v", sum, err)
	}
	if diff, err := b.Sub(a); err != nil || diff.Amount() != -750 || !diff.IsNegative() {
		t.Fatalf("Sub = %v, %v", diff, err)
	}
	if n := a.Neg(); n.Amount() != -1000 || n.Currency() != "BRL" {
		t.Fatalf("Neg = %v", n)
	}
	if _, err := a.Add(mustNew(t, 1, "USD")); !errors.Is(err, ErrCurrencyMismatch) {
		t.Fatalf("Add across currencies err = %v", err)
	}
	if _, err := a.Sub(mustNew(t, 1, "USD")); !errors.Is(err, ErrCurrencyMismatch) {
		t.Fatalf("Sub across currencies err = %v", err)
	}
	if _, err := mustNew(t, MaxAmount, "BRL").Add(mustNew(t, 1, "BRL")); !errors.Is(err, ErrOutOfRange) {
		t.Fatalf("Add beyond MaxAmount err = %v", err)
	}
}

func TestString(t *testing.T) {
	tests := []struct {
		amount   int64
		currency Currency
		want     string
	}{
		{123456, "BRL", "BRL 1234.56"},
		{-5, "BRL", "BRL -0.05"},
		{0, "USD", "USD 0.00"},
		{1500, "JPY", "JPY 1500"},
		{-7, "CLP", "CLP -7"},
	}
	for _, tt := range tests {
		if got := mustNew(t, tt.amount, tt.currency).String(); got != tt.want {
			t.Errorf("String() = %q, want %q", got, tt.want)
		}
	}
}

func TestParseCurrency(t *testing.T) {
	if c, err := ParseCurrency("JPY"); err != nil || c.MinorUnits() != 0 {
		t.Fatalf("ParseCurrency(JPY) = %q, %v", c, err)
	}
	if _, err := ParseCurrency("BTC"); !errors.Is(err, ErrUnknownCurrency) {
		t.Fatalf("ParseCurrency(BTC) err = %v", err)
	}
}

func TestCurrencies(t *testing.T) {
	got := Currencies()
	if len(got) != len(minorUnits) {
		t.Fatalf("len = %d, want %d", len(got), len(minorUnits))
	}
	for i := 1; i < len(got); i++ {
		if got[i-1] >= got[i] {
			t.Fatalf("not sorted at %d: %v", i, got)
		}
	}
}
