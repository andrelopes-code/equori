package domain

import "testing"

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
