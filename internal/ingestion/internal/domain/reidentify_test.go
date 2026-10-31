package domain

import (
	"maps"
	"testing"
)

func TestReidentifications(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		lines  []NormalizedRecord
		seen   []string
		stored []ExternalRecord
		want   map[int]string
	}{
		{
			name:   "pairs a line with the record of its institution id",
			lines:  []NormalizedRecord{line("b", "p-1")},
			seen:   []string{"b"},
			stored: []ExternalRecord{stored("a", "p-1", StateCreated)},
			want:   map[int]string{0: "a"},
		},
		{
			name:   "a withdrawn record is paired",
			lines:  []NormalizedRecord{line("b", "p-1")},
			seen:   []string{"b"},
			stored: []ExternalRecord{stored("a", "p-1", StateWithdrawn)},
			want:   map[int]string{0: "a"},
		},
		{
			name:   "the record's external id returns",
			lines:  []NormalizedRecord{line("b", "p-1")},
			seen:   []string{"a", "b"},
			stored: []ExternalRecord{stored("a", "p-1", StateCreated)},
			want:   map[int]string{},
		},
		{
			name:   "a record holds the line's external id",
			lines:  []NormalizedRecord{line("b", "p-1")},
			seen:   []string{"b"},
			stored: []ExternalRecord{stored("a", "p-1", StateCreated), stored("b", "", StateCreated)},
			want:   map[int]string{},
		},
		{
			name:   "two lines carry the institution id",
			lines:  []NormalizedRecord{line("b", "p-1"), line("c", "p-1")},
			seen:   []string{"b", "c"},
			stored: []ExternalRecord{stored("a", "p-1", StateCreated)},
			want:   map[int]string{},
		},
		{
			name:   "two records carry the institution id",
			lines:  []NormalizedRecord{line("b", "p-1")},
			seen:   []string{"b"},
			stored: []ExternalRecord{stored("a", "p-1", StateCreated), stored("c", "p-1", StateMatched)},
			want:   map[int]string{},
		},
		{
			name:   "a record in review",
			lines:  []NormalizedRecord{line("b", "p-1")},
			seen:   []string{"b"},
			stored: []ExternalRecord{stored("a", "p-1", StateNeedsReview)},
			want:   map[int]string{},
		},
		{
			name:   "a discarded record",
			lines:  []NormalizedRecord{line("b", "p-1")},
			seen:   []string{"b"},
			stored: []ExternalRecord{stored("a", "p-1", StateDiscarded)},
			want:   map[int]string{},
		},
		{
			name:   "another institution id keeps the repeat",
			lines:  []NormalizedRecord{line("b", "p-2")},
			seen:   []string{"b"},
			stored: []ExternalRecord{stored("a", "p-1", StateCreated)},
			want:   map[int]string{},
		},
		{
			name:   "a line without institution id",
			lines:  []NormalizedRecord{line("b", "")},
			seen:   []string{"b"},
			stored: []ExternalRecord{stored("a", "", StateCreated)},
			want:   map[int]string{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := map[int]string{}
			for i, rec := range Reidentifications(tc.lines, tc.seen, tc.stored) {
				got[i] = rec.ExternalID
			}

			if !maps.Equal(got, tc.want) {
				t.Fatalf("Reidentifications = %v, want %v", got, tc.want)
			}
		})
	}
}

func line(externalID, institutionID string) NormalizedRecord {
	return NormalizedRecord{ExternalID: externalID, InstitutionID: institutionID}
}

func stored(externalID, institutionID string, state RecordState) ExternalRecord {
	return ExternalRecord{ExternalID: externalID, InstitutionID: institutionID, State: state}
}
