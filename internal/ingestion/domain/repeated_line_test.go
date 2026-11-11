package domain

import (
	"reflect"
	"testing"

	"github.com/google/uuid"
)

func TestHeldBackLines(t *testing.T) {
	t.Parallel()

	first, second := uuid.New(), uuid.New()
	line := func(date string, amount int64) ExternalRecord {
		return ExternalRecord{ID: uuid.New(), Date: onDate(date), Amount: amount}
	}
	stored := func(id uuid.UUID, date string, amount int64) ExternalRecord {
		return ExternalRecord{ID: id, Date: onDate(date), Amount: amount}
	}

	tests := []struct {
		name    string
		lines   []ExternalRecord
		stored  []ExternalRecord
		claimed []uuid.UUID
		want    map[int]bool
	}{
		{
			name:   "no stored record",
			lines:  []ExternalRecord{line("2026-10-05", -5000)},
			stored: nil,
			want:   map[int]bool{},
		},
		{
			name:   "same date and amount",
			lines:  []ExternalRecord{line("2026-10-05", -5000)},
			stored: []ExternalRecord{stored(first, "2026-10-05", -5000)},
			want:   map[int]bool{0: true},
		},
		{
			name:   "another date",
			lines:  []ExternalRecord{line("2026-10-06", -5000)},
			stored: []ExternalRecord{stored(first, "2026-10-05", -5000)},
			want:   map[int]bool{},
		},
		{
			name:   "another amount",
			lines:  []ExternalRecord{line("2026-10-05", -5001)},
			stored: []ExternalRecord{stored(first, "2026-10-05", -5000)},
			want:   map[int]bool{},
		},
		{
			name:    "the stored line returned in the same read",
			lines:   []ExternalRecord{line("2026-10-05", -5000)},
			stored:  []ExternalRecord{stored(first, "2026-10-05", -5000)},
			claimed: []uuid.UUID{first},
			want:    map[int]bool{},
		},
		{
			name:   "each stored record holds back one line, in line order",
			lines:  []ExternalRecord{line("2026-10-05", -5000), line("2026-10-05", -5000)},
			stored: []ExternalRecord{stored(first, "2026-10-05", -5000)},
			want:   map[int]bool{0: true},
		},
		{
			name:   "two stored records hold back two lines",
			lines:  []ExternalRecord{line("2026-10-05", -5000), line("2026-10-05", -5000)},
			stored: []ExternalRecord{stored(first, "2026-10-05", -5000), stored(second, "2026-10-05", -5000)},
			want:   map[int]bool{0: true, 1: true},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := HeldBackLines(tc.lines, tc.stored, tc.claimed); !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("held back = %v, want %v", got, tc.want)
			}
		})
	}
}
