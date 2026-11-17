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
		{
			"a negative group has no share and leaves the base of the others",
			[]Holding{{"fixed", 300}, {"stock", 100}, {"currency", -350}},
			[]Group{{"fixed", 300, 7500}, {"stock", 100, 2500}, {"currency", -350, 0}},
		},
		{
			"the last positive group takes the rounding remainder",
			[]Holding{{"a", 2}, {"b", 1}, {"c", 0}, {"d", -1}},
			[]Group{{"a", 2, 6666}, {"b", 1, 3334}, {"c", 0, 0}, {"d", -1, 0}},
		},
		{
			"a negative total still shares the positive groups",
			[]Holding{{"a", 100}, {"b", -300}},
			[]Group{{"a", 100, 10000}, {"b", -300, 0}},
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
