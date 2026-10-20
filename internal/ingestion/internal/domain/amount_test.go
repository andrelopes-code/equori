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
		got, err := MinorUnits(tc.in, tc.decimal, 2)
		if (err == nil) != tc.ok || got != tc.want {
			t.Errorf("MinorUnits(%q, %q) = %d, %v; want %d, ok %v", tc.in, tc.decimal, got, err, tc.want, tc.ok)
		}
	}
}
