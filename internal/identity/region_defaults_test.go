package identity

import (
	"testing"
	"time"
)

func TestDefaultTimeZone(t *testing.T) {
	t.Parallel()

	tests := []struct {
		region string
		want   string
	}{
		{region: "BR", want: "America/Sao_Paulo"},
		{region: "PT", want: "UTC"},
		{region: "US", want: "UTC"},
		{region: "", want: "UTC"},
	}

	for _, tt := range tests {
		t.Run(tt.region, func(t *testing.T) {
			t.Parallel()

			got := DefaultTimeZone(tt.region)
			if got != tt.want {
				t.Fatalf("DefaultTimeZone(%q) = %q, want %q", tt.region, got, tt.want)
			}

			if _, err := time.LoadLocation(got); err != nil {
				t.Fatalf("LoadLocation(%q): %v", got, err)
			}
		})
	}
}
