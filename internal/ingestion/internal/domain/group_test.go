package domain

import (
	"slices"
	"testing"

	"github.com/google/uuid"
)

// A167, A168: the groups of lines that together confirm one entry.
func TestGroupsOf(t *testing.T) {
	t.Parallel()

	anchor, fee := gl(1, 20, -11440, true), gl(2, 21, -400, true)

	tests := []struct {
		name  string
		entry LedgerPosting
		lines []GroupLine
		want  [][]uuid.UUID
	}{
		{
			name:  "S234 a purchase and its fee",
			entry: entry(20, -11840),
			lines: []GroupLine{anchor, fee},
			want:  [][]uuid.UUID{grp(1, 2)},
		},
		{
			name:  "a sum that is not exact",
			entry: entry(20, -11840),
			lines: []GroupLine{gl(1, 20, -11440, true), gl(2, 21, -390, true)},
		},
		{
			name:  "S236 the anchor was created before: one new line is enough",
			entry: entry(20, -11840),
			lines: []GroupLine{gl(1, 20, -11440, false), gl(2, 21, -400, true)},
			want:  [][]uuid.UUID{grp(1, 2)},
		},
		{
			name:  "no new line",
			entry: entry(20, -11840),
			lines: []GroupLine{gl(1, 20, -11440, false), gl(2, 21, -400, false)},
		},
		{
			name:  "lines 3 days apart",
			entry: entry(19, -11840),
			lines: []GroupLine{gl(1, 17, -11440, true), gl(2, 20, -400, true)},
			want:  [][]uuid.UUID{grp(1, 2)},
		},
		{
			name:  "lines 4 days apart",
			entry: entry(19, -11840),
			lines: []GroupLine{gl(1, 17, -11440, true), gl(2, 21, -400, true)},
		},
		{
			name:  "a line 10 days from the entry",
			entry: entry(10, -11840),
			lines: []GroupLine{gl(1, 19, -11440, true), gl(2, 20, -400, true)},
			want:  [][]uuid.UUID{grp(1, 2)},
		},
		{
			name:  "a line 11 days from the entry",
			entry: entry(10, -11840),
			lines: []GroupLine{gl(1, 20, -11440, true), gl(2, 21, -400, true)},
		},
		{
			name:  "a line of the other sign",
			entry: entry(20, -11840),
			lines: []GroupLine{gl(1, 20, -12240, true), gl(2, 20, 400, true)},
		},
		{
			name:  "a line of zero is no member",
			entry: entry(20, -11840),
			lines: []GroupLine{gl(1, 20, -11440, true), gl(2, 20, -400, true), gl(3, 20, 0, true)},
			want:  [][]uuid.UUID{grp(1, 2)},
		},
		{
			name:  "no anchor",
			entry: entry(20, -100000),
			lines: []GroupLine{gl(1, 20, -50000, true), gl(2, 20, -50000, true)},
		},
		{
			name:  "an anchor",
			entry: entry(20, -100000),
			lines: []GroupLine{gl(1, 20, -90000, true), gl(2, 20, -10000, true)},
			want:  [][]uuid.UUID{grp(1, 2)},
		},
		{
			name:  "three lines",
			entry: entry(20, -10000),
			lines: []GroupLine{
				gl(1, 20, -8500, true), gl(2, 20, -1000, true), gl(3, 20, -500, true),
			},
			want: [][]uuid.UUID{grp(1, 2, 3)},
		},
		{
			name:  "two groups, ascending",
			entry: entry(20, -11840),
			lines: []GroupLine{
				gl(3, 20, -11000, true), gl(4, 20, -840, true),
				gl(1, 20, -11440, true), gl(2, 20, -400, true),
			},
			want: [][]uuid.UUID{grp(1, 2), grp(3, 4)},
		},
		{
			name:  "an entry of zero",
			entry: entry(20, 0),
			lines: []GroupLine{gl(1, 20, 0, true), gl(2, 20, 0, true)},
		},
		{
			name:  "S239 40 eligible lines are searched",
			entry: entry(20, -11840),
			lines: append([]GroupLine{anchor, fee}, fillers(38, -1)...),
			want:  [][]uuid.UUID{grp(1, 2)},
		},
		{
			name:  "S239 41 eligible lines are not",
			entry: entry(20, -11840),
			lines: append([]GroupLine{anchor, fee}, fillers(39, -1)...),
		},
		{
			name:  "a line of the other sign is not eligible",
			entry: entry(20, -11840),
			lines: append(
				[]GroupLine{anchor, fee, gl(60, 20, 1, true)}, fillers(38, -1)...,
			),
			want: [][]uuid.UUID{grp(1, 2)},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := groupsOf(tt.entry, tt.lines)
			if !slices.EqualFunc(got, tt.want, slices.Equal) {
				t.Fatalf("groups = %v, want %v", got, tt.want)
			}
		})
	}
}

func entry(day int, amount int64) LedgerPosting {
	return LedgerPosting{TransactionID: gid(200), Date: oct(day), Amount: amount}
}

func gl(id byte, day int, amount int64, fresh bool) GroupLine {
	return GroupLine{RecordID: gid(id), Date: oct(day), Amount: amount, New: fresh}
}

// fillers returns n new lines of one amount on 2026-10-20, with ids 10 and above.
func fillers(n int, amount int64) []GroupLine {
	out := make([]GroupLine, n)
	for i := range out {
		out[i] = gl(byte(10+i), 20, amount, true)
	}

	return out
}

func grp(ids ...byte) []uuid.UUID {
	out := make([]uuid.UUID, len(ids))
	for i, id := range ids {
		out[i] = gid(id)
	}

	return out
}

func gid(n byte) uuid.UUID { return uuid.UUID{15: n} }

// A168: a group is proposed for an entry with exactly one group, not shared with another entry.
func TestFindGroups(t *testing.T) {
	t.Parallel()

	e1 := LedgerPosting{TransactionID: gid(201), Date: oct(20), Amount: -11840}
	e2 := LedgerPosting{TransactionID: gid(202), Date: oct(20), Amount: -11840}
	e3 := LedgerPosting{TransactionID: gid(203), Date: oct(20), Amount: -11500}
	e4 := LedgerPosting{TransactionID: gid(204), Date: oct(20), Amount: -5000}
	fee := []GroupLine{gl(1, 20, -11440, true), gl(2, 21, -400, true)}

	tests := []struct {
		name    string
		entries []LedgerPosting
		lines   []GroupLine
		want    []GroupMatch
	}{
		{
			name:    "S234 one entry, one group",
			entries: []LedgerPosting{e1},
			lines:   fee,
			want:    []GroupMatch{{TransactionID: gid(201), RecordIDs: grp(1, 2)}},
		},
		{
			name:    "S237 two entries with the same group",
			entries: []LedgerPosting{e1, e2},
			lines:   fee,
		},
		{
			name:    "two groups for one entry",
			entries: []LedgerPosting{e1},
			lines: []GroupLine{
				gl(1, 20, -11440, true), gl(2, 20, -400, true),
				gl(3, 20, -11000, true), gl(4, 20, -840, true),
			},
		},
		{
			name:    "a line shared by two entries removes both",
			entries: []LedgerPosting{e1, e3},
			lines:   append(slices.Clone(fee), gl(3, 20, -60, true)),
		},
		{
			name:    "independent entries are both proposed, in entry order",
			entries: []LedgerPosting{e1, e4},
			lines:   append(slices.Clone(fee), gl(3, 20, -4800, true), gl(4, 20, -200, true)),
			want: []GroupMatch{
				{TransactionID: gid(201), RecordIDs: grp(1, 2)},
				{TransactionID: gid(204), RecordIDs: grp(3, 4)},
			},
		},
		{
			name:    "an entry listed twice is searched once",
			entries: []LedgerPosting{e1, e1},
			lines:   fee,
			want:    []GroupMatch{{TransactionID: gid(201), RecordIDs: grp(1, 2)}},
		},
		{
			name:    "no entry",
			entries: nil,
			lines:   fee,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := FindGroups(tt.entries, tt.lines)
			if !slices.EqualFunc(got, tt.want, sameMatch) {
				t.Fatalf("matches = %v, want %v", got, tt.want)
			}

			checkMatches(t, tt.entries, tt.lines, got)
		})
	}
}

// The result does not depend on the order of the input or on the sign of the amounts.
func TestFindGroupsSymmetry(t *testing.T) {
	t.Parallel()

	entries := []LedgerPosting{
		{TransactionID: gid(201), Date: oct(20), Amount: -11840},
		{TransactionID: gid(204), Date: oct(20), Amount: -5000},
	}
	lines := []GroupLine{
		gl(1, 20, -11440, true), gl(2, 21, -400, true),
		gl(3, 20, -4800, true), gl(4, 20, -200, true),
	}
	want := []GroupMatch{
		{TransactionID: gid(201), RecordIDs: grp(1, 2)},
		{TransactionID: gid(204), RecordIDs: grp(3, 4)},
	}

	reversedEntries := slices.Clone(entries)
	slices.Reverse(reversedEntries)

	reversedLines := slices.Clone(lines)
	slices.Reverse(reversedLines)

	got := FindGroups(reversedEntries, reversedLines)
	slices.Reverse(got)

	if !slices.EqualFunc(got, want, sameMatch) {
		t.Fatalf("reversed input: matches = %v, want %v", got, want)
	}

	negated := FindGroups(negate(entries, lines))
	if !slices.EqualFunc(negated, want, sameMatch) {
		t.Fatalf("negated amounts: matches = %v, want %v", negated, want)
	}
}

func sameMatch(a, b GroupMatch) bool {
	return a.TransactionID == b.TransactionID && slices.Equal(a.RecordIDs, b.RecordIDs)
}

// checkMatches verifies the conditions of A167 on every match, independently of the search.
func checkMatches(t *testing.T, entries []LedgerPosting, lines []GroupLine, got []GroupMatch) {
	t.Helper()

	byEntry := map[uuid.UUID]LedgerPosting{}
	for _, e := range entries {
		byEntry[e.TransactionID] = e
	}

	byLine := map[uuid.UUID]GroupLine{}
	for _, l := range lines {
		byLine[l.RecordID] = l
	}

	for _, m := range got {
		e := byEntry[m.TransactionID]

		var sum int64

		anchor, fresh := false, false

		for _, id := range m.RecordIDs {
			l := byLine[id]
			sum += l.Amount
			anchor = anchor || withinBound(l.Amount, e.Amount)
			fresh = fresh || l.New

			if dayGap(l.Date, e.Date) > MatchHardLimit {
				t.Fatalf("line %s is %d days from the entry", id, dayGap(l.Date, e.Date))
			}
		}

		if len(m.RecordIDs) < 2 || len(m.RecordIDs) > 3 || sum != e.Amount || !anchor || !fresh {
			t.Fatalf("match %v breaks A167: sum %d, entry %d, anchor %t, new %t",
				m, sum, e.Amount, anchor, fresh)
		}
	}
}

func negate(entries []LedgerPosting, lines []GroupLine) ([]LedgerPosting, []GroupLine) {
	es, ls := slices.Clone(entries), slices.Clone(lines)
	for i := range es {
		es[i].Amount = -es[i].Amount
	}

	for i := range ls {
		ls[i].Amount = -ls[i].Amount
	}

	return es, ls
}
