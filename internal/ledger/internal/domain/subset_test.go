package domain

import (
	"slices"
	"testing"
)

func TestExactSubset(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name   string
		values []int64
		target int64
		want   []int
		found  bool
	}{
		{"two values", []int64{5000, 5000}, 10000, []int{0, 1}, true},
		{"one value", []int64{1500, 4000}, 1500, []int{0}, true},
		{"a later pair", []int64{9000, 3000, 7000}, 10000, []int{1, 2}, true},
		{"two subsets", []int64{5000, 5000, 10000}, 10000, nil, false},
		{"no subset", []int64{4000, 6000}, 5000, nil, false},
		{"no values", nil, 100, nil, false},
		{"zero target", []int64{100}, 0, nil, false},
		{"more than twenty values", slices.Repeat([]int64{1}, 21), 2, nil, false},
		{"twenty values", append(slices.Repeat([]int64{1000}, 19), 7), 7, []int{19}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, found := ExactSubset(tt.values, tt.target)
			if found != tt.found || !slices.Equal(got, tt.want) {
				t.Fatalf("ExactSubset(%v, %d) = %v, %v; want %v, %v", tt.values, tt.target, got, found, tt.want, tt.found)
			}
		})
	}
}
