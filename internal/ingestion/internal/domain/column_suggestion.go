package domain

import (
	"errors"
	"slices"
	"strconv"
	"strings"
	"unicode"
)

// ErrColumnSuggestionUnusable: the model's answer fails the rules of a column suggestion (A206).
var ErrColumnSuggestionUnusable = errors.New("the answer does not name a usable set of columns")

// ColumnSample is what a column suggestion reads; MaskSample builds it from the file's cells.
type ColumnSample struct {
	Header []string
	Rows   [][]string
}

// ColumnPositions holds the model's answer: 1-based positions, 0 for none.
type ColumnPositions struct{ Date, Description, Amount, Debit, Credit, ID, Sign int }

// ColumnSuggestion holds header names, or positions as text for a file without a header.
type ColumnSuggestion struct {
	Date, Description, Amount, Debit, Credit, ID, Sign string
}

// MaskSample returns the sample with each row cell masked and each header cell with a digit masked.
func MaskSample(s ColumnSample) ColumnSample {
	out := ColumnSample{Rows: make([][]string, len(s.Rows))}

	for _, h := range s.Header {
		if strings.ContainsFunc(h, unicode.IsDigit) {
			h = MaskCell(h)
		}

		out.Header = append(out.Header, h)
	}

	for i, row := range s.Rows {
		out.Rows[i] = make([]string, len(row))
		for j, c := range row {
			out.Rows[i][j] = MaskCell(c)
		}
	}

	return out
}

// MaskCell writes a digit as 9 and a letter as A and removes combining marks. A run of at most two
// ASCII letters stays as written, so D and C still say what a sign column is; in other scripts two
// letters can be a whole name.
func MaskCell(s string) string {
	var b strings.Builder

	var run []rune

	flush := func() {
		if len(run) <= 2 && !slices.ContainsFunc(run, func(r rune) bool { return r > unicode.MaxASCII }) {
			b.WriteString(string(run))
		} else {
			b.WriteString(strings.Repeat("A", len(run)))
		}

		run = run[:0]
	}

	for _, r := range s {
		switch {
		case unicode.Is(unicode.Mn, r):
		case unicode.IsLetter(r):
			run = append(run, r)
		default:
			flush()

			if unicode.IsDigit(r) {
				r = '9'
			}

			b.WriteRune(r)
		}
	}

	flush()

	return b.String()
}

// NewColumnSuggestion turns an answer into column names; width is the widest row of the sample.
func NewColumnSuggestion(p ColumnPositions, header []string, width int) (ColumnSuggestion, error) {
	positions := []int{p.Date, p.Description, p.Amount, p.Debit, p.Credit, p.ID, p.Sign}

	switch {
	case p.Date == 0 || p.Description == 0:
	case p.Amount == 0 && (p.Debit == 0 || p.Credit == 0):
	case p.Amount > 0 && (p.Debit > 0 || p.Credit > 0):
	case p.Sign > 0 && p.Amount == 0:
	case slices.ContainsFunc(positions, func(n int) bool { return n < 0 || n > width }):
	case repeatsPosition(positions):
	default:
		return nameColumns(p, header)
	}

	return ColumnSuggestion{}, ErrColumnSuggestionUnusable
}

func nameColumns(p ColumnPositions, header []string) (ColumnSuggestion, error) {
	var failed bool

	name := func(n int) string {
		if n == 0 {
			return ""
		}

		if header == nil {
			return strconv.Itoa(n)
		}

		if n > len(header) || !uniqueName(header, n-1) {
			failed = true

			return ""
		}

		return header[n-1]
	}

	out := ColumnSuggestion{
		Date: name(p.Date), Description: name(p.Description), Amount: name(p.Amount), Debit: name(p.Debit),
		Credit: name(p.Credit), ID: name(p.ID), Sign: name(p.Sign),
	}

	if failed {
		return ColumnSuggestion{}, ErrColumnSuggestionUnusable
	}

	return out, nil
}

func repeatsPosition(positions []int) bool {
	seen := map[int]bool{}

	for _, n := range positions {
		if n > 0 && seen[n] {
			return true
		}

		seen[n] = true
	}

	return false
}

// uniqueName reports whether header[i] is not empty and no other header cell has the same name.
func uniqueName(header []string, i int) bool {
	name := strings.TrimSpace(header[i])
	if name == "" {
		return false
	}

	for j, h := range header {
		if j != i && strings.EqualFold(strings.TrimSpace(h), name) {
			return false
		}
	}

	return true
}
