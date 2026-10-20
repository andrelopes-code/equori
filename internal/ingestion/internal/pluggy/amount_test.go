package pluggy

import (
	"errors"
	"testing"
)

// P6 amendment A37: amounts are read from the number text, never through float64.
func TestMinor(t *testing.T) {
	t.Parallel()
	tests := []struct {
		raw  Decimal
		want int64
		err  bool
	}{
		{"45.9", 4590, false},
		{"45.90", 4590, false},
		{"-0.01", -1, false},
		{"0.3", 30, false},
		{"1.5e2", 15000, false},
		{"2.50E-1", 25, false},
		{"120950", 12095000, false},
		{"90071992547409.91", 9007199254740991, false},
		{"90071992547409.92", 0, true},
		{"0.105", 0, true},
		{"1e-3", 0, true},
		{"", 0, true},
		{"abc", 0, true},
	}
	for _, tt := range tests {
		got, err := Minor(tt.raw, 2)
		if (err != nil) != tt.err || got != tt.want {
			t.Errorf("Minor(%q) = %d, %v; want %d, error %v", tt.raw, got, err, tt.want, tt.err)
		}
		if err != nil && !errors.Is(err, ErrAmount) {
			t.Errorf("Minor(%q) error %v is not ErrAmount", tt.raw, err)
		}
	}
}
