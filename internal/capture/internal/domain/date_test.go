package domain

import (
	"testing"
	"time"
)

// wednesday is 2026-10-21, the scenarios' today.
var wednesday = time.Date(2026, 10, 21, 0, 0, 0, 0, time.UTC)

func TestReadDate(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		text  string
		today time.Time
		want  string
		valid bool
		words int
	}{
		{"hoje", wednesday, "2026-10-21", true, 1},
		{"Ontem", wednesday, "2026-10-20", true, 1},
		{"anteontem", wednesday, "2026-10-19", true, 1},
		{"yesterday", wednesday, "2026-10-20", true, 1},
		{"quarta", wednesday, "2026-10-21", true, 1},
		{"sexta", wednesday, "2026-10-16", true, 1},
		{"sexta-feira", wednesday, "2026-10-16", true, 1},
		{"sábado", wednesday, "2026-10-17", true, 1},
		{"thursday", wednesday, "2026-10-15", true, 1},
		{"dia 12", wednesday, "2026-10-12", true, 2},
		{"dia 21", wednesday, "2026-10-21", true, 2},
		{"dia 25", wednesday, "2026-09-25", true, 2},
		{"dia 31", wednesday, "", false, 2},
		{"dia 25", time.Date(2026, 1, 10, 0, 0, 0, 0, time.UTC), "2025-12-25", true, 2},
		{"12/10", wednesday, "2026-10-12", true, 1},
		{"25/12", wednesday, "2025-12-25", true, 1},
		{"5/1/27", wednesday, "2027-01-05", true, 1},
		{"05/01/2027", wednesday, "2027-01-05", true, 1},
		{"2026-11-03", wednesday, "2026-11-03", true, 1},
		{"31/02", wednesday, "", false, 1},
		{"10/13", wednesday, "", false, 1},
		{"0/10", wednesday, "", false, 1},
		{"29/02/2028", wednesday, "2028-02-29", true, 1},
	} {
		t.Run(c.text, func(t *testing.T) {
			t.Parallel()
			p, ok := readDate(splitWords(c.text), 0, c.today, Merge(Portuguese(), English()), DMY)
			if !ok {
				t.Fatal("not read as a date")
			}
			if p.valid != c.valid || p.words != c.words || (c.valid && p.date.Format(time.DateOnly) != c.want) {
				t.Fatalf("got %s valid %v words %d, want %s %v %d", p.date.Format(time.DateOnly), p.valid, p.words, c.want, c.valid, c.words)
			}
		})
	}
	for _, text := range []string{"dia", "dia x", "12", "1/2/3", "domingueira"} {
		if _, ok := readDate(splitWords(text), 0, wednesday, Merge(Portuguese(), English()), DMY); ok {
			t.Errorf("%q read as a date", text)
		}
	}
}

func TestReadInstallments(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		text  string
		count int
		valid bool
		each  int64
		words int
	}{
		{"3x", 3, true, 0, 1},
		{"em 3x", 3, true, 0, 2},
		{"3 x", 3, true, 0, 2},
		{"10 vezes", 10, true, 0, 2},
		{"em 12 parcelas", 12, true, 0, 3},
		{"parcelado em 4", 4, true, 0, 3},
		{"parcelada em 4x", 4, true, 0, 3},
		{"3x de 19,90", 3, true, 1990, 3},
		{"3x de R$ 19,90", 3, true, 1990, 4},
		{"1x", 0, true, 0, 1},
		{"à vista", 0, true, 0, 2},
		{"421x", 421, false, 0, 1},
		{"0x", 0, false, 0, 1},
	} {
		t.Run(c.text, func(t *testing.T) {
			t.Parallel()
			p, ok := readInstallments(splitWords(c.text), 0, Merge(Portuguese(), English()), Conventions{',', '.', DMY})
			if !ok {
				t.Fatal("not read as installments")
			}
			var each int64
			if p.each != nil {
				each, _ = p.each.value.minor(2)
			}
			if p.count != c.count || p.valid != c.valid || each != c.each || p.words != c.words {
				t.Fatalf("got count %d valid %v each %d words %d, want %d %v %d %d", p.count, p.valid, each, p.words, c.count, c.valid, c.each, c.words)
			}
		})
	}
	for _, text := range []string{"em casa", "parcelado", "3", "x3", "3 dias"} {
		if _, ok := readInstallments(splitWords(text), 0, Merge(Portuguese(), English()), Conventions{',', '.', DMY}); ok {
			t.Errorf("%q read as installments", text)
		}
	}
}
