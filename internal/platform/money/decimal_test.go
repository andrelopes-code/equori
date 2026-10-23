package money

import (
	"errors"
	"testing"
)

func TestParseDecimal(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		in    string
		code  Currency
		scale int
		want  int64
		err   bool
	}{
		{"fraction", "125.90", "BRL", 2, 12590, false},
		{"negative", "-0.5", "BRL", 2, -50, false},
		{"integer", "7", "BRL", 2, 700, false},
		{"too many decimals", "1.234", "BRL", 2, 0, true},
		{"comma", "1,50", "BRL", 2, 0, true},
		{"empty", "", "BRL", 2, 0, true},
		{"plus sign", "+1", "BRL", 2, 0, true},
		{"fraction on scale 0", "10.5", "MXRF11", 0, 0, true},
		{"integer on scale 0", "10", "MXRF11", 0, 10, false},
		{"scale 8", "0.00000001", "BTC", 8, 1, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := ParseDecimal(tt.in, tt.code, tt.scale)
			if tt.err {
				if !errors.Is(err, ErrInvalidDecimal) {
					t.Fatalf("err = %v, want ErrInvalidDecimal", err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if got.Amount() != tt.want || got.Currency() != tt.code || got.Scale() != tt.scale {
				t.Errorf("got %v scale %d, want %d %s scale %d", got, got.Scale(), tt.want, tt.code, tt.scale)
			}
		})
	}
}
