package domain

import (
	"testing"
	"time"
)

func TestMethodAt(t *testing.T) {
	t.Parallel()

	month := func(s string) time.Time {
		m, err := time.Parse("2006-01", s)
		if err != nil {
			t.Fatal(err)
		}

		return m
	}
	full := []Bucket{{Name: "All", ShareBP: 10000}}
	two := []Method{
		{From: month("2026-09"), Buckets: full},
		{From: month("2026-11"), Buckets: full},
	}
	ended := []Method{{From: month("2026-09"), Buckets: full}, {From: month("2026-11")}}

	tests := []struct {
		name     string
		versions []Method
		month    string
		from     string
	}{
		{"between versions", two, "2026-10", "2026-09"},
		{"on a version", two, "2026-11", "2026-11"},
		{"after the last", two, "2027-03", "2026-11"},
		{"before the first", two, "2026-06", "2026-09"},
		{"without versions", nil, "2026-10", ""},
		{"after the end", ended, "2026-12", ""},
		{"before the end", ended, "2026-10", "2026-09"},
	}
	for _, tt := range tests {
		got, ok := MethodAt(tt.versions, month(tt.month))
		if (tt.from != "") != ok || (ok && !got.From.Equal(month(tt.from))) {
			t.Errorf("%s: MethodAt = %v %t, want from %q", tt.name, got.From, ok, tt.from)
		}
	}

	if next, ok := NextFrom(two, month("2026-10")); !ok || !next.Equal(month("2026-11")) {
		t.Errorf("NextFrom of 2026-10 = %v %t, want 2026-11", next, ok)
	}

	if _, ok := NextFrom(two, month("2026-12")); ok {
		t.Error("NextFrom after the last version reports a next one")
	}
}

func TestLeadingEmpty(t *testing.T) {
	t.Parallel()

	month := func(s string) time.Time {
		m, err := time.Parse("2006-01", s)
		if err != nil {
			t.Fatal(err)
		}

		return m
	}
	full := []Bucket{{Name: "All", ShareBP: 10000}}

	got := LeadingEmpty([]Method{
		{From: month("2026-09")},
		{From: month("2026-10")},
		{From: month("2026-11"), Buckets: full},
		{From: month("2026-12")},
	})
	if len(got) != 2 || !got[0].Equal(month("2026-09")) || !got[1].Equal(month("2026-10")) {
		t.Errorf("LeadingEmpty = %v, want 2026-09 and 2026-10", got)
	}

	got = LeadingEmpty([]Method{{From: month("2026-09"), Buckets: full}, {From: month("2026-10")}})
	if len(got) != 0 {
		t.Errorf("LeadingEmpty = %v, want none", got)
	}
}
