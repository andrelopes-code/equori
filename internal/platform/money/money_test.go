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
	t.Parallel()
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
	t.Parallel()
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
	t.Parallel()
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
	t.Parallel()
	if c, err := ParseCurrency("JPY"); err != nil || c.MinorUnits() != 0 {
		t.Fatalf("ParseCurrency(JPY) = %q, %v", c, err)
	}
	if _, err := ParseCurrency("BTC"); !errors.Is(err, ErrUnknownCurrency) {
		t.Fatalf("ParseCurrency(BTC) err = %v", err)
	}
}

func TestCurrencies(t *testing.T) {
	t.Parallel()
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

func TestNewOf(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name   string
		amount int64
		code   Currency
		scale  int
		want   error
	}{
		{name: "security", amount: 150, code: "MXRF11", scale: 0},
		{name: "crypto", amount: 123456789, code: "BTC", scale: 8},
		{name: "currency keeps its scale", amount: 100, code: "BRL", scale: 2},
		{name: "scale above 12", amount: 1, code: "X1", scale: 13, want: ErrInvalidInstrument},
		{name: "negative scale", amount: 1, code: "X1", scale: -1, want: ErrInvalidInstrument},
		{name: "lowercase code", amount: 1, code: "mx", scale: 0, want: ErrInvalidInstrument},
		{name: "one letter code", amount: 1, code: "M", scale: 0, want: ErrInvalidInstrument},
		{name: "currency with another scale", amount: 1, code: "BRL", scale: 0, want: ErrInvalidInstrument},
		{name: "above max", amount: MaxAmount + 1, code: "MXRF11", scale: 0, want: ErrOutOfRange},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m, err := NewOf(tt.amount, tt.code, tt.scale)
			if !errors.Is(err, tt.want) {
				t.Fatalf("err = %v, want %v", err, tt.want)
			}
			if err == nil && (m.Amount() != tt.amount || m.Currency() != tt.code || m.Scale() != tt.scale) {
				t.Fatalf("got %v scale %d", m, m.Scale())
			}
		})
	}
}

func TestInstrumentArithmeticKeepsScale(t *testing.T) {
	t.Parallel()
	a, _ := NewOf(150, "MXRF11", 0)
	b, _ := NewOf(50, "MXRF11", 0)
	got, err := a.Sub(b)
	if err != nil {
		t.Fatal(err)
	}
	if want, _ := NewOf(100, "MXRF11", 0); got != want {
		t.Fatalf("got %v", got)
	}
	if sum, err := a.Add(b); err != nil || sum.Scale() != 0 || sum.Amount() != 200 {
		t.Fatalf("sum = %v, %v", sum, err)
	}
	if n := a.Neg(); n.Scale() != 0 || n.Amount() != -150 {
		t.Fatalf("neg = %v", n)
	}
	if brl := mustNew(t, 1, "BRL"); brl.Scale() != 2 {
		t.Fatalf("BRL scale = %d", brl.Scale())
	}
	btc, _ := NewOf(123456789, "BTC", 8)
	if got := btc.String(); got != "BTC 1.23456789" {
		t.Fatalf("String = %q", got)
	}
	if got := a.String(); got != "MXRF11 150" {
		t.Fatalf("String = %q", got)
	}
}
