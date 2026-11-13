package domain

import (
	"slices"
	"testing"
)

func TestExecute(t *testing.T) {
	tests := []struct {
		name     string
		entries  []Entry
		amount   int64
		orders   []Order
		leftover int64
	}{
		{
			name: "CN19 one share leaves the leftover",
			entries: []Entry{
				{Weight: 10000, Planned: 100000, Unit: 15000},
			},
			amount:   100000,
			orders:   []Order{{Quantity: 6, Cost: 90000}},
			leftover: 10000,
		},
		{
			name: "CN19 lowest ratio takes three steps",
			entries: []Entry{
				{Weight: 5000, Planned: 100000, Unit: 15000},
				{Weight: 5000, Planned: 50000, Unit: 4000},
			},
			amount:   150000,
			orders:   []Order{{Quantity: 6, Cost: 90000}, {Quantity: 15, Cost: 60000}},
			leftover: 0,
		},
		{
			name: "CN19 cash-like entry takes the leftover",
			entries: []Entry{
				{Weight: 5000, Planned: 100000, Unit: 15000},
				{Weight: 5000, Planned: 50000},
			},
			amount:   150000,
			orders:   []Order{{Quantity: 6, Cost: 90000}, {Quantity: 0, Cost: 60000}},
			leftover: 0,
		},
		{
			name: "CN19 coin rounds the cost up",
			entries: []Entry{
				{Weight: 10000, Planned: 100000, Unit: 30000000, Scale: 8},
			},
			amount:   100000,
			orders:   []Order{{Quantity: 333333, Cost: 100000}},
			leftover: 0,
		},
		{
			name:     "no entry leaves the whole amount",
			amount:   5000,
			orders:   []Order{},
			leftover: 5000,
		},
		{
			name: "ideal 0 never receives the leftover",
			entries: []Entry{
				{Weight: 0, Planned: 100, Unit: 40},
				{Weight: 10000, Value: 100000, Planned: 100, Unit: 40},
			},
			amount:   300,
			orders:   []Order{{Quantity: 2, Cost: 80}, {Quantity: 5, Cost: 200}},
			leftover: 20,
		},
		{
			name: "equal ratios go to the first entry in plan order",
			entries: []Entry{
				{Weight: 5000, Planned: 100, Unit: 40},
				{Weight: 5000, Planned: 100, Unit: 40},
			},
			amount:   200,
			orders:   []Order{{Quantity: 3, Cost: 120}, {Quantity: 2, Cost: 80}},
			leftover: 0,
		},
		{
			// Unit 50 at scale 8 is worth 0.0000005 minor units: step 1 costs ceil(0.0000005) = 1,
			// step 2 costs ceil(0.000001) - 1 = 0 and is never taken (CN18 amendment).
			name: "a unit worth less than one minor unit never receives a zero-cost step",
			entries: []Entry{
				{Weight: 10000, Planned: 0, Unit: 50, Scale: 8},
			},
			amount:   100,
			orders:   []Order{{Quantity: 1, Cost: 1}},
			leftover: 99,
		},
		{
			name: "cash-like entry ends the reassignment",
			entries: []Entry{
				{Weight: 5000, Planned: 100000, Unit: 15000},
				{Weight: 5000},
			},
			amount:   110000,
			orders:   []Order{{Quantity: 6, Cost: 90000}, {Quantity: 0, Cost: 20000}},
			leftover: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			orders, leftover := Execute(tt.entries, tt.amount)

			if !slices.Equal(orders, tt.orders) {
				t.Errorf("orders = %v, want %v", orders, tt.orders)
			}

			if leftover != tt.leftover {
				t.Errorf("leftover = %d, want %d", leftover, tt.leftover)
			}
		})
	}
}
