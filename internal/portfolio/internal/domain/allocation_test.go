package domain

import (
	"slices"
	"testing"
)

func TestAllocate(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		items []Holding
		want  []Group
	}{
		{"one group takes it all", []Holding{{"a", 100}, {"a", 50}}, []Group{{"a", 150, 10000}}},
		{
			"the last group takes the rounding remainder",
			[]Holding{{"currency", 40000}, {"currency", 50000}, {"reit", 10500}},
			[]Group{{"currency", 90000, 8955}, {"reit", 10500, 1045}},
		},
		{
			"groups by value, ties by key",
			[]Holding{{"b", 10}, {"a", 10}, {"c", 20}},
			[]Group{{"c", 20, 5000}, {"a", 10, 2500}, {"b", 10, 2500}},
		},
		{"zero total has no share", []Holding{{"a", 0}}, []Group{{"a", 0, 0}}},
		{"nothing held", nil, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Allocate(tt.items); !slices.Equal(got, tt.want) {
				t.Fatalf("Allocate = %+v, want %+v", got, tt.want)
			}
		})
	}
}
