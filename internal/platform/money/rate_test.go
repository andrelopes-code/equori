package money

import (
	"errors"
	"testing"
)

func TestParseRate(t *testing.T) {
	tests := []struct {
		in       string
		mantissa int64
		scale    int
		want     error
	}{
		{in: "5.4830", mantissa: 54830, scale: 4},
		{in: "10", mantissa: 10, scale: 0},
		{in: "0.000000000001", mantissa: 1, scale: 12},
		{in: "0", want: ErrInvalidRate},
		{in: "0.00", want: ErrInvalidRate},
		{in: "-1", want: ErrInvalidRate},
		{in: "+1", want: ErrInvalidRate},
		{in: "1e3", want: ErrInvalidRate},
		{in: "1.", want: ErrInvalidRate},
		{in: ".5", want: ErrInvalidRate},
		{in: "", want: ErrInvalidRate},
		{in: "0.0000000000001", want: ErrInvalidRate},
		{in: "99999999999999999999", want: ErrInvalidRate},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			r, err := ParseRate(tt.in)
			if !errors.Is(err, tt.want) {
				t.Fatalf("err = %v, want %v", err, tt.want)
			}
			if err == nil && (r.Mantissa() != tt.mantissa || r.Scale() != tt.scale || r.String() != tt.in) {
				t.Fatalf("got %d e-%d %q", r.Mantissa(), r.Scale(), r.String())
			}
		})
	}
}

func TestNewRate(t *testing.T) {
	if r, err := NewRate(936, 2); err != nil || r.String() != "9.36" {
		t.Fatalf("got %v, %v", r, err)
	}
	if r, err := NewRate(5, 3); err != nil || r.String() != "0.005" {
		t.Fatalf("got %v, %v", r, err)
	}
	for _, c := range []struct {
		m int64
		s int
	}{{0, 2}, {-1, 2}, {1, 13}, {1, -1}} {
		if _, err := NewRate(c.m, c.s); !errors.Is(err, ErrInvalidRate) {
			t.Fatalf("NewRate(%d, %d) err = %v", c.m, c.s, err)
		}
	}
}
