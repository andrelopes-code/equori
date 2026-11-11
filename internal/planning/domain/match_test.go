package domain

import (
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestFitsWindow(t *testing.T) {
	t.Parallel()

	expected := time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC)
	account, counterpart := uuid.New(), uuid.New()

	for _, window := range []int{0, 2, 7} {
		for _, distance := range []int{0, 2, 3, 7, 8} {
			t.Run(fmt.Sprintf("window %d distance %d", window, distance), func(t *testing.T) {
				t.Parallel()

				c := Candidate{
					Schedule: Schedule{
						Kind: Bill, AccountID: account, CounterpartID: counterpart,
						ToleranceBP: 1000, WindowDays: window,
					},
					Occurrence: Occurrence{ExpectedOn: expected, Amount: 10000},
				}
				tx := Transaction{
					ID:   uuid.New(),
					Date: expected.AddDate(0, 0, distance),
					Postings: []Posting{
						{AccountID: account, Amount: -10000},
						{AccountID: counterpart, Amount: 10000},
					},
				}

				if got, want := Fits(tx, c), distance <= window; got != want {
					t.Fatalf("Fits = %v, want %v", got, want)
				}
			})
		}
	}
}
