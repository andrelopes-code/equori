package domain

import (
	"slices"
	"testing"

	"github.com/google/uuid"
)

func candidate(id string, date string, amount int64) DifferenceCandidate {
	return DifferenceCandidate{TransactionID: uuid.MustParse(id), Date: day(date), Amount: amount}
}

func ids(xs ...string) []uuid.UUID {
	out := make([]uuid.UUID, len(xs))
	for i, x := range xs {
		out[i] = uuid.MustParse(x)
	}
	return out
}

const (
	idA = "00000000-0000-7000-8000-000000000001"
	idB = "00000000-0000-7000-8000-000000000002"
	idC = "00000000-0000-7000-8000-000000000003"
)

// A137: difference = amount due − institution total.
func TestExplainDifference(t *testing.T) {
	t.Parallel()
	many := make([]DifferenceCandidate, 0, 25)
	for i := range 20 {
		many = append(many, DifferenceCandidate{TransactionID: uuid.New(), Date: day("2026-10-28"), Amount: -100000 - int64(i)})
	}
	for range 5 {
		many = append(many, DifferenceCandidate{TransactionID: uuid.New(), Date: day("2026-10-20"), Amount: -7})
	}
	tests := []struct {
		name       string
		difference int64
		lines      int
		candidates []DifferenceCandidate
		want       DifferenceExplanation
	}{
		{
			name: "S177 the latest of equal amounts", difference: 713, lines: 45,
			candidates: []DifferenceCandidate{candidate(idB, "2026-10-23", -713), candidate(idA, "2026-10-28", -713), candidate(idC, "2026-10-27", -1112)},
			want:       DifferenceExplanation{Move: ids(idA)},
		},
		{
			name: "two postings", difference: 1825, lines: 45,
			candidates: []DifferenceCandidate{candidate(idA, "2026-10-28", -713), candidate(idB, "2026-10-27", -1112), candidate(idC, "2026-10-26", -399)},
			want:       DifferenceExplanation{Move: ids(idA, idB)},
		},
		{
			name: "equal amount and date", difference: 713, lines: 45,
			candidates: []DifferenceCandidate{candidate(idB, "2026-10-28", -713), candidate(idA, "2026-10-28", -713)},
			want:       DifferenceExplanation{Move: ids(idA)},
		},
		{
			name: "a credit", difference: -500, lines: 45,
			candidates: []DifferenceCandidate{candidate(idA, "2026-10-28", 500)},
			want:       DifferenceExplanation{Move: ids(idA)},
		},
		{
			name: "S179 rounding", difference: 1, lines: 40,
			candidates: []DifferenceCandidate{candidate(idA, "2026-10-28", -713)},
			want:       DifferenceExplanation{Rounding: true},
		},
		{
			name: "no explanation", difference: 5000, lines: 40,
			candidates: []DifferenceCandidate{candidate(idA, "2026-10-28", -713)},
			want:       DifferenceExplanation{},
		},
		{name: "no difference", difference: 0, lines: 40, candidates: []DifferenceCandidate{candidate(idA, "2026-10-28", -713)}},
		{name: "only the 20 latest enter", difference: 7, lines: 5, candidates: many},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := ExplainDifference(tt.difference, tt.lines, tt.candidates)

			if !slices.Equal(got.Move, tt.want.Move) || got.Rounding != tt.want.Rounding {
				t.Fatalf("ExplainDifference = %+v, want %+v", got, tt.want)
			}
		})
	}
}
