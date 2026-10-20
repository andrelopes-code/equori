package domain

import (
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestCandidates(t *testing.T) {
	t.Parallel()
	day := func(d int) time.Time { return time.Date(2026, 10, d, 0, 0, 0, 0, time.UTC) }
	a, b, c, d, e := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	postings := []LedgerPosting{
		{a, day(2), -5000}, {e, day(4), -5000}, {e, day(4), -5000}, {d, day(5), -4999}, {b, day(7), -5000}, {c, day(9), -5000},
	}
	got := Candidates(day(5), -5000, postings, map[uuid.UUID]bool{b: true})
	if want := []uuid.UUID{a, e}; !slices.Equal(got, want) {
		t.Fatalf("candidates = %v, want %v (window ±3 days, same amount, not taken, each transaction once)", got, want)
	}
}
