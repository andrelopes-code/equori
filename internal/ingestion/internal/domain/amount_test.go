package domain

import "testing"

func TestMinorUnits(t *testing.T) {
	t.Parallel()
	tests := []struct {
		in      string
		decimal rune
		want    int64
		ok      bool
	}{
		{"-45.90", '.', -4590, true},
		{"1.234,56", ',', 123456, true},
		{"R$ 1.234,5", ',', 123450, true},
		{"1,234.56", '.', 123456, true},
		{"+3000", '.', 300000, true},
		{"10.000", '.', 1000, true},
		{"1.234", '.', 0, false},
		{"12.3.4", '.', 0, false},
		{"", '.', 0, false},
		{"abc", '.', 0, false},
		{"--1", '.', 0, false},
	}
	for _, tc := range tests {
		group := ','
		if tc.decimal == ',' {
			group = '.'
		}
		got, err := MinorUnits(tc.in, tc.decimal, group, 2)
		if (err == nil) != tc.ok || got != tc.want {
			t.Errorf("MinorUnits(%q, %q) = %d, %v; want %d, ok %v", tc.in, tc.decimal, got, err, tc.want, tc.ok)
		}
	}
}

func TestMinorUnitsConventions(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		in             string
		decimal, group rune
		want           int64
	}{
		{"€ 1.234,50", ',', '.', 123450},
		{"CHF 1'234.50", '.', '\'', 123450},
		{"(12.50)", '.', ',', -1250},
		{"12,50-", ',', '.', -1250},
		{"R$ 10,00", ',', '.', 1000},
		{"USD 10.00", '.', ',', 1000},
		{"10.00 USD", '.', ',', 1000},
		{"1 234,50", ',', ' ', 123450},
		{"1\u00a0234,50", ',', '\u00a0', 123450},
		{"1234,50", ',', 0, 123450},
	} {
		got, err := MinorUnits(c.in, c.decimal, c.group, 2)
		if err != nil || got != c.want {
			t.Errorf("MinorUnits(%q) = %d, %v; want %d", c.in, got, err, c.want)
		}
	}
}
