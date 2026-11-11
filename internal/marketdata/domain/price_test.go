package domain

import (
	"errors"
	"testing"
	"time"
)

func TestPriority(t *testing.T) {
	t.Parallel()

	unofficial := UnofficialSources{"yahoo_chart"}

	tests := []struct {
		source  string
		want    int16
		wantErr bool
	}{
		{source: "manual", want: 1},
		{source: "csv", want: 2},
		{source: "bcb_ptax", want: 3},
		{source: "accrual", want: 4},
		{source: "yahoo_chart", want: 5},
		{source: "BCB", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.source, func(t *testing.T) {
			got, err := Priority(tt.source, unofficial)
			if (err != nil) != tt.wantErr {
				t.Fatalf("error = %v, want error %v", err, tt.wantErr)
			}

			if got != tt.want {
				t.Fatalf("priority = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestValidRange(t *testing.T) {
	t.Parallel()

	from := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)

	if err := ValidRange(from, time.Date(2050, 2, 7, 0, 0, 0, 0, time.UTC)); err != nil {
		t.Fatalf("18300 days: %v", err)
	}

	err := ValidRange(from, time.Date(2050, 2, 8, 0, 0, 0, 0, time.UTC))

	var fe *FieldError
	if !errors.As(err, &fe) || fe.Field != "to" {
		t.Fatalf("18301 days: err = %v, want field to", err)
	}
}
