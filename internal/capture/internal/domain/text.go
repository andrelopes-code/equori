// Package domain reads capture text into transaction drafts (docs/specs/2026-10-21-text-capture-design.md).
package domain

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/andrelopes-code/equori/internal/platform/textfold"
)

// Normalize lowercases s, removes the diacritics of Latin letters and collapses whitespace.
func Normalize(s string) string {
	words := strings.Fields(s)
	for i, w := range words {
		words[i] = textfold.String(w)
	}
	return strings.Join(words, " ")
}

const (
	leadingMarks  = "([{\"'“‘"
	trailingMarks = ")]}\"'”’.,:!?"
)

// word is a run of non-space characters of a line.
type word struct {
	start, end int // byte range in the line
	// core is the word without leading and trailing punctuation; norm is core normalized.
	core, norm string
	role       Role
	// phrase numbers the phrase that consumed the word, so the space inside a phrase takes its role.
	phrase int
}

func (w *word) free() bool { return w.role == "" }

func splitWords(line string) []word {
	var words []word
	start := -1
	for i, r := range line {
		if unicode.IsSpace(r) {
			if start >= 0 {
				words = append(words, newWord(line, start, i))
				start = -1
			}
			continue
		}
		if start < 0 {
			start = i
		}
	}
	if start >= 0 {
		words = append(words, newWord(line, start, len(line)))
	}
	return words
}

func newWord(line string, start, end int) word {
	core := strings.TrimRight(strings.TrimLeft(line[start:end], leadingMarks), trailingMarks)
	return word{start: start, end: end, core: core, norm: Normalize(core), phrase: -1}
}

// capitalize upper-cases the first letter of s.
func capitalize(s string) string {
	r, size := utf8.DecodeRuneInString(s)
	if r == utf8.RuneError {
		return s
	}
	return string(unicode.ToUpper(r)) + s[size:]
}
