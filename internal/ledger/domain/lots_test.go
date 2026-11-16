package domain

import (
	"encoding/json"
	"errors"
	"os"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestConsumeLots(t *testing.T) {
	jan := time.Date(2026, 1, 5, 0, 0, 0, 0, time.UTC)
	feb := time.Date(2026, 2, 5, 0, 0, 0, 0, time.UTC)
	held := []Lot{
		{AcquiredOn: jan, Quantity: 10, Cost: 1000},
		{AcquiredOn: feb, Quantity: 10, Cost: 1200},
	}

	tests := []struct {
		name         string
		quantity     int64
		posted       int64
		wantConsumed []Lot
		wantRest     []Lot
		wantErr      error
	}{
		{
			name: "partial sale takes the oldest lot", quantity: 5, posted: 500,
			wantConsumed: []Lot{{AcquiredOn: jan, Quantity: 5, Cost: 500}},
			wantRest: []Lot{
				{AcquiredOn: jan, Quantity: 5, Cost: 500},
				{AcquiredOn: feb, Quantity: 10, Cost: 1200},
			},
		},
		{
			name: "sale spans two lots", quantity: 15, posted: 1600,
			wantConsumed: []Lot{
				{AcquiredOn: jan, Quantity: 10, Cost: 1000},
				{AcquiredOn: feb, Quantity: 5, Cost: 600},
			},
			wantRest: []Lot{{AcquiredOn: feb, Quantity: 5, Cost: 600}},
		},
		{
			name: "whole holding", quantity: 20, posted: 2200,
			wantConsumed: []Lot{
				{AcquiredOn: jan, Quantity: 10, Cost: 1000},
				{AcquiredOn: feb, Quantity: 10, Cost: 1200},
			},
			wantRest: nil,
		},
		{
			name: "posted at the average keeps the cost basis", quantity: 5, posted: 550,
			wantConsumed: []Lot{{AcquiredOn: jan, Quantity: 5, Cost: 550}},
			wantRest: []Lot{
				{AcquiredOn: jan, Quantity: 5, Cost: 450},
				{AcquiredOn: feb, Quantity: 10, Cost: 1200},
			},
		},
		{
			name: "single unit of the oldest lot", quantity: 1, posted: 100,
			wantConsumed: []Lot{{AcquiredOn: jan, Quantity: 1, Cost: 100}},
			wantRest: []Lot{
				{AcquiredOn: jan, Quantity: 9, Cost: 900},
				{AcquiredOn: feb, Quantity: 10, Cost: 1200},
			},
		},
		{name: "more than held", quantity: 21, posted: 2200, wantErr: ErrLotsInconsistent},
		{name: "zero quantity", quantity: 0, posted: 0, wantErr: ErrLotsInconsistent},
		{
			name: "posted cost empties a lot that has units", quantity: 5, posted: 1500,
			wantErr: ErrLotsInconsistent,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			consumed, rest, err := ConsumeLots(slices.Clone(held), tt.quantity, tt.posted)

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("error = %v, want %v", err, tt.wantErr)
			}

			if !slices.Equal(consumed, tt.wantConsumed) {
				t.Errorf("consumed = %v, want %v", consumed, tt.wantConsumed)
			}

			if !slices.Equal(rest, tt.wantRest) {
				t.Errorf("rest = %v, want %v", rest, tt.wantRest)
			}
		})
	}
}

// The web preview of a sale reads the same file (web/src/features/transactions/entry-model).
func TestFIFOCostFixture(t *testing.T) {
	raw, err := os.ReadFile("testdata/fifo-cost.json")
	if err != nil {
		t.Fatal(err)
	}

	var cases []struct {
		Name string `json:"name"`
		Lots []struct {
			Quantity int64 `json:"quantity"`
			Cost     int64 `json:"cost"`
		} `json:"lots"`
		Quantity int64 `json:"quantity"`
		Cost     int64 `json:"cost"`
	}
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}

	day := time.Date(2026, 1, 5, 0, 0, 0, 0, time.UTC)

	for _, tt := range cases {
		t.Run(tt.Name, func(t *testing.T) {
			lots := make([]Lot, len(tt.Lots))
			for i, l := range tt.Lots {
				lots[i] = Lot{AcquiredOn: day.AddDate(0, i, 0), Quantity: l.Quantity, Cost: l.Cost}
			}

			got, err := FIFOCost(lots, tt.Quantity)
			if err != nil || got != tt.Cost {
				t.Errorf("cost = %d, %v, want %d", got, err, tt.Cost)
			}
		})
	}
}

func TestConsumeLotsRoundsHalfToEven(t *testing.T) {
	day := time.Date(2026, 1, 5, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name     string
		cost     int64
		wantCost int64
	}{
		{name: "tie rounds down to even", cost: 5, wantCost: 2},
		{name: "tie rounds up to even", cost: 7, wantCost: 4},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lots := []Lot{{AcquiredOn: day, Quantity: 2, Cost: tt.cost}}

			consumed, _, err := ConsumeLots(lots, 1, tt.wantCost)
			if err != nil {
				t.Fatalf("error = %v", err)
			}

			if got := lotShare(
				tt.cost,
				1,
				2,
			); got != tt.wantCost ||
				consumed[0].Cost != tt.wantCost {
				t.Errorf("share = %d, consumed = %d, want %d", got, consumed[0].Cost, tt.wantCost)
			}
		})
	}
}

func TestReplayLots(t *testing.T) {
	jan := time.Date(2026, 1, 5, 0, 0, 0, 0, time.UTC)
	feb := time.Date(2026, 2, 5, 0, 0, 0, 0, time.UTC)
	mar := time.Date(2026, 3, 5, 0, 0, 0, 0, time.UTC)
	source := uuid.New()

	sourceLots := func(LotPosting) ([]Lot, error) {
		return []Lot{
			{AcquiredOn: jan, Quantity: 10, Cost: 1000},
			{AcquiredOn: feb, Quantity: 10, Cost: 1200},
		}, nil
	}

	tests := []struct {
		name     string
		postings []LotPosting
		want     []Lot
	}{
		{
			name: "sale posted at the average keeps the lots equal to the cost basis",
			postings: []LotPosting{
				{Date: jan, Quantity: 10, Cost: 1000},
				{Date: feb, Quantity: 10, Cost: 1200},
				{Date: mar, Quantity: -5, Cost: -550},
			},
			want: []Lot{
				{AcquiredOn: jan, Quantity: 5, Cost: 450},
				{AcquiredOn: feb, Quantity: 10, Cost: 1200},
			},
		},
		{
			name: "transfer in keeps the acquisition dates of the source",
			postings: []LotPosting{
				{Date: mar, Quantity: 15, Cost: 1600, Source: source},
			},
			want: []Lot{
				{AcquiredOn: jan, Quantity: 10, Cost: 1000},
				{AcquiredOn: feb, Quantity: 5, Cost: 600},
			},
		},
		{
			name: "transferred lot older than a purchase goes first",
			postings: []LotPosting{
				{Date: feb, Quantity: 4, Cost: 480},
				{Date: mar, Quantity: 5, Cost: 500, Source: source},
			},
			want: []Lot{
				{AcquiredOn: jan, Quantity: 5, Cost: 500},
				{AcquiredOn: feb, Quantity: 4, Cost: 480},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ReplayLots(tt.postings, sourceLots)
			if err != nil {
				t.Fatalf("error = %v", err)
			}

			if !slices.Equal(got, tt.want) {
				t.Errorf("lots = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestReplayLotsRejectsASaleOfMoreThanHeld(t *testing.T) {
	day := time.Date(2026, 1, 5, 0, 0, 0, 0, time.UTC)

	_, err := ReplayLots([]LotPosting{
		{Date: day, Quantity: 10, Cost: 1000},
		{Date: day, Quantity: -11, Cost: -1100},
	}, nil)

	if !errors.Is(err, ErrLotsInconsistent) {
		t.Fatalf("error = %v, want %v", err, ErrLotsInconsistent)
	}
}
