package domain

import "testing"

func TestNewer(t *testing.T) {
	t.Parallel()

	tests := []struct {
		binary, latest string
		want           bool
	}{
		{"v1.0.0", "v1.0.1", true},
		{"v1.0.0", "v1.0.0", false},
		{"v1.0.0-rc.1", "v1.0.0", true},
		{"v1.9.0", "v1.10.0", true},
		{"v1.10.0", "v1.9.0", false},
		{"v2.0.0", "v1.99.99", false},
		{"v1.0.0", "latest", false},
		{"dev", "v1.0.0", false},
	}

	for _, tt := range tests {
		t.Run(tt.binary+" "+tt.latest, func(t *testing.T) {
			t.Parallel()

			if got := Newer(tt.binary, tt.latest); got != tt.want {
				t.Fatalf("Newer(%q, %q) = %v, want %v", tt.binary, tt.latest, got, tt.want)
			}
		})
	}
}

func TestCheckable(t *testing.T) {
	t.Parallel()

	tests := []struct {
		binary string
		want   bool
	}{
		{"v1.0.0", true},
		{"v1.0.0-rc.1", true},
		{"dev", false},
		{"unknown", false},
		{"1.0.0", false},
	}

	for _, tt := range tests {
		t.Run(tt.binary, func(t *testing.T) {
			t.Parallel()

			if got := Checkable(tt.binary); got != tt.want {
				t.Fatalf("Checkable(%q) = %v, want %v", tt.binary, got, tt.want)
			}
		})
	}
}
