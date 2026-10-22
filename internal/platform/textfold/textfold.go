// Package textfold folds text to a lowercase form without diacritics for matching in any script.
package textfold

import (
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// special folds letters that have no canonical decomposition but have a base letter.
func special(r rune) (rune, bool) {
	switch r {
	case 'ø':
		return 'o', true
	case 'đ':
		return 'd', true
	case 'ħ':
		return 'h', true
	case 'ı':
		return 'i', true
	case 'ŀ', 'ł':
		return 'l', true
	case 'ŧ':
		return 't', true
	case 'ſ':
		return 's', true
	}
	return r, false
}

// Rune returns r lowercased; a Latin letter also loses its diacritics.
func Rune(r rune) rune {
	l := unicode.ToLower(r)
	if base, ok := special(l); ok {
		return base
	}
	if !unicode.Is(unicode.Latin, l) {
		return l
	}
	for _, d := range norm.NFD.String(string(l)) {
		if !unicode.Is(unicode.Mn, d) {
			return d
		}
	}
	return l
}

// String returns s with every rune folded by Rune.
func String(s string) string { return strings.Map(Rune, s) }
