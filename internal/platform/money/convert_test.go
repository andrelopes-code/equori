package money

import (
	"errors"
	"testing"
)

func rate(t *testing.T, s string) Rate {
	t.Helper()
	r, err := ParseRate(s)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func TestConvert(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		from Money
		to   Currency
		legs []Leg
		want Money
	}{
		{name: "direct", from: mustNew(t, 10000, "USD"), to: "BRL", legs: []Leg{{Rate: rate(t, "5.4830")}}, want: mustNew(t, 54830, "BRL")},
		{name: "inverse", from: mustNew(t, 54830, "BRL"), to: "USD", legs: []Leg{{Rate: rate(t, "5.4830"), Inverse: true}}, want: mustNew(t, 10000, "USD")},
		{name: "half to even down", from: mustNew(t, 999, "USD"), to: "BRL", legs: []Leg{{Rate: rate(t, "5.5")}}, want: mustNew(t, 5494, "BRL")},
		{name: "half to even up", from: mustNew(t, 1001, "USD"), to: "BRL", legs: []Leg{{Rate: rate(t, "1.5")}}, want: mustNew(t, 1502, "BRL")},
		{name: "negative half to even", from: mustNew(t, -999, "USD"), to: "BRL", legs: []Leg{{Rate: rate(t, "5.5")}}, want: mustNew(t, -5494, "BRL")},
		{name: "security to currency", from: mustNewOf(t, 100, "MXRF11", 0), to: "BRL", legs: []Leg{{Rate: rate(t, "9.36")}}, want: mustNew(t, 93600, "BRL")},
		{name: "two legs round once", from: mustNew(t, 333, "JPY"), to: "USD", legs: []Leg{{Rate: rate(t, "0.0372")}, {Rate: rate(t, "5.5"), Inverse: true}}, want: mustNew(t, 225, "USD")},
		// 0.0335 BRL ÷ 0.5 = 0.067 USD; rounding the BRL leg first would give 0.03 ÷ 0.5 = 0.06.
		{name: "two legs differ from rounding each leg", from: mustNew(t, 1, "JPY"), to: "USD", legs: []Leg{{Rate: rate(t, "0.0335")}, {Rate: rate(t, "0.5"), Inverse: true}}, want: mustNew(t, 7, "USD")},
		{name: "no legs same currency", from: mustNew(t, 100, "BRL"), to: "BRL", want: mustNew(t, 100, "BRL")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Convert(tt.from, tt.to, tt.legs...)
			if err != nil {
				t.Fatal(err)
			}
			if got != tt.want {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestConvertRejects(t *testing.T) {
	t.Parallel()
	if _, err := Convert(mustNew(t, 1, "USD"), "XYZ", Leg{Rate: rate(t, "1")}); !errors.Is(err, ErrUnknownCurrency) {
		t.Fatalf("unknown currency err = %v", err)
	}
	if _, err := Convert(mustNew(t, 1, "USD"), "BRL"); !errors.Is(err, ErrCurrencyMismatch) {
		t.Fatalf("no legs across currencies err = %v", err)
	}
	if _, err := Convert(mustNew(t, MaxAmount, "USD"), "BRL", Leg{Rate: rate(t, "2")}); !errors.Is(err, ErrOutOfRange) {
		t.Fatalf("overflow err = %v", err)
	}
}

func TestFraction(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		m        Money
		num, den int64
		want     int64
	}{
		{name: "S21 cost of 50 of 150", m: mustNew(t, 151240, "BRL"), num: 50, den: 150, want: 50413},
		{name: "one of three", m: mustNew(t, 1000, "BRL"), num: 1, den: 3, want: 333},
		{name: "half to even", m: mustNew(t, 5, "BRL"), num: 1, den: 2, want: 2},
		{name: "whole", m: mustNew(t, 151240, "BRL"), num: 150, den: 150, want: 151240},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Fraction(tt.m, tt.num, tt.den)
			if err != nil || got.Amount() != tt.want || got.Currency() != tt.m.Currency() {
				t.Fatalf("got %v, %v", got, err)
			}
		})
	}
	if _, err := Fraction(mustNew(t, 1, "BRL"), 1, 0); err == nil {
		t.Fatal("zero denominator accepted")
	}
}

func TestQuotient(t *testing.T) {
	t.Parallel()
	got, err := Quotient(mustNew(t, 151240, "BRL"), mustNewOf(t, 150, "MXRF11", 0), 4)
	if err != nil || got.String() != "10.0827" {
		t.Fatalf("got %v, %v", got, err)
	}
	if _, err := Quotient(mustNew(t, 1, "BRL"), mustNewOf(t, 0, "MXRF11", 0), 4); err == nil {
		t.Fatal("zero divisor accepted")
	}
}

func mustNewOf(t *testing.T, amount int64, code Currency, scale int) Money {
	t.Helper()
	m, err := NewOf(amount, code, scale)
	if err != nil {
		t.Fatal(err)
	}
	return m
}
